// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IEUROs is IERC20 {
    function burn(address from, uint256 amount) external;
}