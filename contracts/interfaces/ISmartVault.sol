// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface ISmartVault {
    function undercollateralised() external view returns (bool);
}