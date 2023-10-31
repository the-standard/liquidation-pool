// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "contracts/LiquidationPool.sol";

contract LiquidationPoolManager {

    address public immutable pool;

    address private immutable EUROs;
    address private immutable TST;
    
    constructor(address _TST, address _EUROs) {
        pool = address(new LiquidationPool(_TST, _EUROs));
        TST = _TST;
        EUROs = _EUROs;
    }

    function distributeFees() external {
        IERC20 eurosToken = IERC20(EUROs);
        uint256 balance = eurosToken.balanceOf(address(this));
        eurosToken.approve(pool, balance);
        LiquidationPool(pool).distributeFees(balance);
    }
}
