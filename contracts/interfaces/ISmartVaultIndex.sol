// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface ISmartVaultIndex {
    function getVaultAddress(uint256 _tokenId) external view returns (address);
}