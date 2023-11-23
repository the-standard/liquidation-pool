// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol" as Chainlink;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "contracts/interfaces/IEUROs.sol";
import "contracts/interfaces/ILiquidationPool.sol";
import "contracts/interfaces/ILiquidationPoolManager.sol";
import "contracts/interfaces/ISmartVaultManager.sol";

contract LiquidationPool is ILiquidationPool {
    using SafeERC20 for IERC20;

    address private immutable TST;
    address private immutable EUROs;
    address private immutable eurUsd;

    Position[] private positions;
    Reward[] private rewards;
    bytes32[] private rewardTokens;
    address payable public manager;

    struct Position {  address holder; uint256 TST; uint256 EUROs; }
    struct Reward { address holder; bytes32 symbol; uint256 amount; }

    constructor(address _TST, address _EUROs, address _eurUsd) {
        TST = _TST;
        EUROs = _EUROs;
        eurUsd = _eurUsd;
        manager = payable(msg.sender);
    }

    modifier onlyManager {
        require(msg.sender == manager, "err-invalid-user");
        _;
    }

    function stake(Position memory _position) private pure returns (uint256) {
        return _position.TST > _position.EUROs ? _position.EUROs : _position.TST;
    }

    function stakeTotals() private view returns (uint256 _tst, uint256 _euros, uint256 _stakes) {
        for (uint256 i = 0; i < positions.length; i++) {
            Position memory _position = positions[i];
            _tst += _position.TST;
            _euros += _position.EUROs;
            _stakes += stake(_position);
        }
    }

    function findPosition(address _holder) private view returns (Position memory, uint256) {
        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i].holder == _holder) return (positions[i], i);
        }
    }

    function findReward(address _holder, bytes32 _symbol) private view returns (Reward memory) {
        for (uint256 i = 0; i < rewards.length; i++) {
            Reward memory _reward = rewards[i];
            if (_reward.holder == _holder && _reward.symbol == _symbol) return _reward;
        }
    }

    function findRewards(address _holder) private view returns (Reward[] memory) {
        Reward[] memory _rewards = new Reward[](rewardTokens.length);
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            _rewards[i] = findReward(_holder, rewardTokens[i]);
        }
        return _rewards;
    }
    
    function position(address _holder) external view returns(Position memory _position, Reward[] memory _rewards) {
        (_position,) = findPosition(_holder);
        (uint256 tstTotal,,) = stakeTotals();
        if (_position.TST > 0) _position.EUROs += IERC20(EUROs).balanceOf(manager) * _position.TST / tstTotal;
        _rewards = findRewards(_holder);
    }

    function empty(Position memory _position) private pure returns (bool) {
        return _position.TST == 0 && _position.EUROs == 0;
    }

    function deletePosition(uint256 _index) private {
        positions[_index] = positions[positions.length - 1];
        positions.pop();
    }

    function savePosition(Position memory _position, uint256 _index) private {
        if (empty(_position)) {
            deletePosition(_index);
        } else if (_position.holder == address(0)) {
            _position.holder = msg.sender;
            positions.push(_position);
        } else {
            positions[_index] = _position;
        }
    }

    function increasePosition(uint256 _tstVal, uint256 _eurosVal) external {
        ILiquidationPoolManager(manager).distributeFees();

        (Position memory _position, uint256 _index) = findPosition(msg.sender);

        if (_tstVal > 0) {
            IERC20(TST).safeTransferFrom(msg.sender, address(this), _tstVal);
            _position.TST += _tstVal;
        }

        if (_eurosVal > 0) {
            IERC20(EUROs).safeTransferFrom(msg.sender, address(this), _eurosVal);
            _position.EUROs += _eurosVal;
        }

        savePosition(_position, _index);
    }

    function decreasePosition(uint256 _tstVal, uint256 _eurosVal) external {
        ILiquidationPoolManager(manager).distributeFees();

        (Position memory _position, uint256 _index) = findPosition(msg.sender);
        require(_tstVal <= _position.TST && _eurosVal <= _position.EUROs, "invalid-decr-amount");

        if (_tstVal > 0 && _tstVal <= _position.TST) {
            IERC20(TST).safeTransfer(msg.sender, _tstVal);
            _position.TST -= _tstVal;
        }

        if (_eurosVal > 0 && _eurosVal <= _position.EUROs) {
            IERC20(EUROs).safeTransfer(msg.sender, _eurosVal);
            _position.EUROs -= _eurosVal;
        }

        savePosition(_position, _index);
    }

    function distributeFees(uint256 _amount) external onlyManager {
        (uint256 tstTotal,,) = stakeTotals();
        if (tstTotal > 0) {
            IERC20(EUROs).safeTransferFrom(msg.sender, address(this), _amount);
            for (uint256 i = 0; i < positions.length; i++) {
                Position memory _position = positions[i];
                _position.EUROs += _amount * _position.TST / tstTotal;
                savePosition(_position, i);
            }
        }
    }

    function addUniqueRewardToken(bytes32 _symbol) private {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            if (rewardTokens[i] == _symbol) return;
        }
        rewardTokens.push(_symbol);
    }

    function returnUnpurchasedNative(ILiquidationPoolManager.Asset[] memory _assets, uint256 _nativePurchased) private {
        for (uint256 i = 0; i < _assets.length; i++) {
            if (_assets[i].token.addr == address(0) && _assets[i].token.symbol != bytes32(0)) {
                manager.call{value: _assets[i].amount - _nativePurchased}("");
            }
        }
    }

    function distributeAssets(ILiquidationPoolManager.Asset[] memory _assets, uint256 _collateralRate, uint256 _hundredPC) external payable {
        (,int256 priceEurUsd,,,) = Chainlink.AggregatorV3Interface(eurUsd).latestRoundData();
        (,,uint256 stakeTotal) = stakeTotals();
        uint256 burnEuros;
        uint256 nativePurchased;
        for (uint256 j = 0; j < positions.length; j++) {
            Position memory _position = positions[j];
            uint256 _positionStake = stake(_position);
            if (_positionStake > 0) {
                for (uint256 i = 0; i < _assets.length; i++) {
                    ILiquidationPoolManager.Asset memory asset = _assets[i];
                    if (asset.amount > 0 && _position.EUROs > 0) {
                        addUniqueRewardToken(asset.token.symbol);
                        (,int256 assetPriceUsd,,,) = Chainlink.AggregatorV3Interface(asset.token.clAddr).latestRoundData();
                        uint256 _portion = asset.amount * _positionStake / stakeTotal;
                        uint256 costInEuros = _portion * 10 ** (18 - asset.token.dec) * uint256(assetPriceUsd) / uint256(priceEurUsd)
                            * _hundredPC / _collateralRate;
                        if (costInEuros > _position.EUROs) {
                            _portion = _portion * _position.EUROs / costInEuros;
                            costInEuros = _position.EUROs;
                        }
                        _position.EUROs -= costInEuros;
                        rewards.push(Reward(_position.holder, asset.token.symbol, _portion));
                        burnEuros += costInEuros;
                        if (asset.token.addr == address(0)) {
                            nativePurchased += _portion;
                        } else {
                            IERC20(asset.token.addr).safeTransferFrom(manager, address(this), _portion);
                        }
                    }
                }
                savePosition(_position, j);
            }
        }
        IEUROs(EUROs).burn(address(this), burnEuros);
        returnUnpurchasedNative(_assets, nativePurchased);
    }
}
