// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "node_modules/@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "contracts/interfaces/ILiquidationPoolManager.sol";
import "contracts/interfaces/ISmartVaultIndex.sol";
import "contracts/interfaces/ISmartVaultManager.sol";
import "contracts/interfaces/ISmartVault.sol";

contract LiquidationAutomation is AutomationCompatibleInterface {
    address private immutable liquidationPoolManager;
    address private immutable smartVaultManager;
    address private immutable vaultIndex;

    constructor(address _liquidationPoolManager, address _smartVaultManager, address _vaultIndex) {
        liquidationPoolManager = _liquidationPoolManager;
        smartVaultManager = _smartVaultManager;
        vaultIndex = _vaultIndex;
    }

    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        uint256 _id = block.number % ISmartVaultManager(smartVaultManager).totalSupply() + 1;
        try ISmartVault(ISmartVaultIndex(vaultIndex).getVaultAddress(_id)).undercollateralised() returns (bool _undercollateralised) {
            if (_undercollateralised) {
                upkeepNeeded = true;
                performData = abi.encodePacked(uint(_id));
            }
        } catch {}

    }

    function performUpkeep(bytes calldata performData) external override {
        uint256 _id = uint256(bytes32(performData));
        ILiquidationPoolManager(liquidationPoolManager).runLiquidation(_id);
    }
}