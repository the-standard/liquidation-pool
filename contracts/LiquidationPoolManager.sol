// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "contracts/LiquidationPool.sol";
import "contracts/interfaces/ILiquidationPoolManager.sol";
import "contracts/interfaces/ISmartVaultManager.sol";
import "contracts/interfaces/ITokenManager.sol";

contract LiquidationPoolManager is Ownable {
    using SafeERC20 for IERC20;

    uint32 public constant HUNDRED_PC = 100000;

    address private immutable TST;
    address private immutable EUROs;
    address public immutable smartVaultManager;
    address public immutable pool;

    address payable public protocol;
    uint32 public poolFeePercentage;
    uint16 public poolHolderLimit;
    
    constructor(address _TST, address _EUROs, address _smartVaultManager, address _eurUsd, address payable _protocol, uint32 _poolFeePercentage, uint16 _poolHolderLimit) Ownable(msg.sender) {
        pool = address(new LiquidationPool(_TST, _EUROs, _eurUsd, ISmartVaultManager(_smartVaultManager).tokenManager()));
        TST = _TST;
        EUROs = _EUROs;
        smartVaultManager = _smartVaultManager;
        protocol = _protocol;
        poolFeePercentage = _poolFeePercentage;
        poolHolderLimit = _poolHolderLimit;
    }

    receive() external payable {}

    function distributeEUROsFees() private {
        IERC20 eurosToken = IERC20(EUROs);
        uint256 _feesForPool = eurosToken.balanceOf(address(this)) * poolFeePercentage / HUNDRED_PC;
        if (_feesForPool > 0) {
            eurosToken.approve(pool, _feesForPool);
            LiquidationPool(pool).distributeFees(_feesForPool);
        }
        eurosToken.transfer(protocol, eurosToken.balanceOf(address(this)));
    }

    function forwardAssetsToPool() private {
        bool distribute;
        ISmartVaultManager _manager = ISmartVaultManager(smartVaultManager);
        ITokenManager.Token[] memory tokens = ITokenManager(_manager.tokenManager()).getAcceptedTokens();
        ILiquidationPoolManager.Asset[] memory assets = new ILiquidationPoolManager.Asset[](tokens.length);
        uint256 ethBalance;
        for (uint256 i = 0; i < tokens.length; i++) {
            ITokenManager.Token memory token = tokens[i];
            if (token.addr == address(0)) {
                ethBalance = address(this).balance;
                if (ethBalance > 0) {
                    assets[i] = ILiquidationPoolManager.Asset(token, ethBalance);
                    distribute = true;
                }
            } else {
                IERC20 ierc20 = IERC20(token.addr);
                uint256 erc20balance = ierc20.balanceOf(address(this));
                if (erc20balance > 0) {
                    assets[i] = ILiquidationPoolManager.Asset(token, erc20balance);
                    ierc20.approve(pool, erc20balance);
                    distribute = true;
                }
            }
        }
        if (distribute) {
            LiquidationPool(pool).distributeAssets{value: ethBalance}(assets, _manager.collateralRate(), _manager.HUNDRED_PC());
        }
    }

    function distributeFees() external {
        LiquidationPool(pool).consolidatePendingStakes();
        distributeEUROsFees();
        forwardAssetsToPool();
    }

    function refundAssetsToProtocol() external onlyOwner() {
        ITokenManager.Token[] memory _tokens = ITokenManager(ISmartVaultManager(smartVaultManager).tokenManager()).getAcceptedTokens();
        for (uint256 i = 0; i < _tokens.length; i++) {
            ITokenManager.Token memory _token = _tokens[i];
            if (_token.addr == address(0)) {
                uint256 balance = address(this).balance;
                if (balance > 0) {
                    (bool _sent,) = protocol.call{value: balance}("");
                    require(_sent);
                }
            } else {
                uint256 balance = IERC20(_token.addr).balanceOf(address(this));
                if (balance > 0) IERC20(_token.addr).safeTransfer(protocol, balance);
            }
        }
    }

    function rewardDrop() external onlyOwner() {
        forwardAssetsToPool();
    }

    function runLiquidation(uint256 _tokenId) external {
        LiquidationPool(pool).consolidatePendingStakes();
        distributeEUROsFees();
        ISmartVaultManager manager = ISmartVaultManager(smartVaultManager);
        manager.liquidateVault(_tokenId);
        forwardAssetsToPool();
    }

    function setPoolFeePercentage(uint32 _poolFeePercentage) external onlyOwner {
        poolFeePercentage = _poolFeePercentage;
    }

    function setPoolHolderLimit(uint16 _poolHolderLimit) external onlyOwner {
        poolHolderLimit = _poolHolderLimit;
    }

    function setProtocol(address payable _protocol) external onlyOwner {
        protocol = _protocol;
    }

    function setEmergency(bool _emergency) external onlyOwner {
        LiquidationPool(pool).setEmergency(_emergency);
    }
}
