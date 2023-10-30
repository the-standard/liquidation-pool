// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "contracts/LiquidationPool.sol";

contract LiquidationPoolManager {

    address public immutable pool;

    address private immutable EUROs;
    address private immutable TST;
    
    constructor(address _TST, address _EUROs) {
        pool = address(new LiquidationPool(_TST, _EUROs, address(this)));
        TST = _TST;
        EUROs = _EUROs;
    }

    function distributeFees() external {
        IERC20(EUROs).approve(pool, IERC20(EUROs).balanceOf(address(this)));
        ILiquidationPool(pool).distributeFees(IERC20(EUROs).balanceOf(address(this)));
    }
}
