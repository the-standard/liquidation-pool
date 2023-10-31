// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "contracts/interfaces/ILiquidationPool.sol";
import "contracts/interfaces/ILiquidationPoolManager.sol";

import "hardhat/console.sol";

contract LiquidationPool is ILiquidationPool {
    using SafeERC20 for IERC20;

    address private immutable TST;
    address private immutable EUROs;

    uint256 private tstTotal;
    mapping(address => Position) private positions;
    address[] private holders;
    address public manager;

    struct Position { uint256 TST; uint256 EUROs; }

    constructor(address _TST, address _EUROs) {
        TST = _TST;
        EUROs = _EUROs;
        manager = msg.sender;
    }
    
    function position(address _holder) external view returns(Position memory _position) {
        _position = positions[_holder];
        if (_position.TST > 0) _position.EUROs += IERC20(EUROs).balanceOf(manager) * _position.TST / tstTotal;
    }

    function uniquelyAddToHolders() private {
        for (uint256 i = 0; i < holders.length; i++) if (holders[i] == msg.sender) return;
        holders.push(msg.sender);
    }

    function emptyPosition() private view returns (bool) {
        return positions[msg.sender].TST == 0 && positions[msg.sender].EUROs == 0;
    }

    function increasePosition(uint256 _tstVal, uint256 _eurosVal) external {
        ILiquidationPoolManager(manager).distributeFees();

        if (emptyPosition()) uniquelyAddToHolders();

        if (_tstVal > 0) {
            IERC20(TST).safeTransferFrom(msg.sender, address(this), _tstVal);
            positions[msg.sender].TST += _tstVal;
            tstTotal += _tstVal;
        }

        if (_eurosVal > 0) {
            IERC20(EUROs).safeTransferFrom(msg.sender, address(this), _eurosVal);
            positions[msg.sender].EUROs += _eurosVal;
        }
    }

    function indexOf(address _item) private view returns (uint256 _index) {
        bool found;
        for (uint256 i = 0; i < holders.length; i++) {
            if (holders[i] == _item) {
                found = true;
                _index = i;
            }
        }
        require(found, "err-holder-not-found");
    }

    function deleteHolder() private {
        holders[indexOf(msg.sender)] = holders[holders.length - 1];
        holders.pop();
    }

    function decreasePosition(uint256 _tstVal, uint256 _eurosVal) external {
        ILiquidationPoolManager(manager).distributeFees();

        if (_tstVal > 0 && _tstVal <= positions[msg.sender].TST) {
            IERC20(TST).safeTransfer(msg.sender, _tstVal);
            positions[msg.sender].TST -= _tstVal;
            tstTotal -= _tstVal;
        }

        if (_eurosVal > 0 && _eurosVal <= positions[msg.sender].EUROs) {
            IERC20(EUROs).safeTransfer(msg.sender, _eurosVal);
            positions[msg.sender].EUROs -= _eurosVal;
        }

        if (emptyPosition()) deleteHolder();
    }

    function distributeFees(uint256 _amount) external {
        IERC20(EUROs).safeTransferFrom(msg.sender, address(this), _amount);
        if (tstTotal > 0) {
            for (uint256 i = 0; i < holders.length; i++) {
                address holder = holders[i];
                positions[holder].EUROs += _amount * positions[holder].TST / tstTotal;
            }
        }
    }
}
