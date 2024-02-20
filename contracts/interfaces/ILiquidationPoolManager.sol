// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "contracts/interfaces/ITokenManager.sol";

interface ILiquidationPoolManager {
    struct Asset { ITokenManager.Token token; uint256 amount; }

    function eurUsd() external view returns (address);
    function HUNDRED_PC() external view returns (uint32);
    function poolFeePercentage() external view returns (uint32);
    function poolHolderLimit() external view returns (uint16);
    function distributeFees() external;
    function runLiquidation(uint256 _tokenId) external;
}