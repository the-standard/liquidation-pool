// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface ISmartVaultManager {
    function HUNDRED_PC() external view returns (uint256);
    function collateralRate() external view returns (uint256);
    function tokenManager() external view returns (address);
    function liquidateVault(uint256 _tokenId) external;
}