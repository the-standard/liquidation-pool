// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface ISmartVaultManager {
    function tokenManager() external view returns (address);
    function liquidateVaults() external;
}