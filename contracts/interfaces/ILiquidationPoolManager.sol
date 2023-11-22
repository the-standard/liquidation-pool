// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "contracts/interfaces/ITokenManager.sol";

interface ILiquidationPoolManager {
    struct Asset { ITokenManager.Token token; uint256 amount; }

    function smartVaultManager() external view returns (address);
    function distributeFees() external;
}