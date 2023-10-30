// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

contract LiquidationPool {
    using SafeERC20 for IERC20;

    address private immutable TST;
    address private immutable EUROs;

    mapping(address => Position) private positions;

    struct Position { uint256 TST; uint256 EUROs; }

    constructor(address _TST, address _EUROs) {
        TST = _TST;
        EUROs = _EUROs;
    }
    
    function position(address _holder) external view returns(Position memory) {
        return positions[_holder];
    }

    function increasePosition(uint256 _tstVal, uint256 _eurosVal) external {
        if (_tstVal > 0) {
            IERC20(TST).safeTransferFrom(msg.sender, address(this), _tstVal);
            positions[msg.sender].TST += _tstVal;
        }

        if (_eurosVal > 0) {
            IERC20(EUROs).safeTransferFrom(msg.sender, address(this), _eurosVal);
            positions[msg.sender].EUROs += _eurosVal;
        }
    }

    function decreasePosition(uint256 _tstVal, uint256 _eurosVal) external {
        if (_tstVal > 0 && _tstVal <= positions[msg.sender].TST) {
            IERC20(TST).safeTransfer(msg.sender, _tstVal);
            positions[msg.sender].TST -= _tstVal;
        }

        if (_eurosVal > 0 && _eurosVal <= positions[msg.sender].EUROs) {
            IERC20(EUROs).safeTransfer(msg.sender, _eurosVal);
            positions[msg.sender].EUROs -= _eurosVal;
        }
    }
}
