// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "contracts/LiquidationPool.sol";
import "contracts/interfaces/ILiquidationPoolManager.sol";
import "contracts/interfaces/ISmartVaultManager.sol";
import "contracts/interfaces/ITokenManager.sol";

contract LiquidationPoolManager {

    address public immutable pool;

    address private immutable EUROs;
    address private immutable TST;
    address public immutable smartVaultManager;
    
    constructor(address _TST, address _EUROs, address _smartVaultManager, address _eurUsd) {
        pool = address(new LiquidationPool(_TST, _EUROs, _eurUsd, ISmartVaultManager(_smartVaultManager).tokenManager()));
        TST = _TST;
        EUROs = _EUROs;
        smartVaultManager = _smartVaultManager;
    }

    receive() external payable {}

    function distributeFees() public {
        IERC20 eurosToken = IERC20(EUROs);
        uint256 balance = eurosToken.balanceOf(address(this));
        eurosToken.approve(pool, balance);
        LiquidationPool(pool).distributeFees(balance);
    }

    // TODO protect this function
    function runLiquidation(uint256 _tokenId) external {
        ISmartVaultManager manager = ISmartVaultManager(smartVaultManager);
        manager.liquidateVault(_tokenId);
        distributeFees();
        ITokenManager.Token[] memory tokens = ITokenManager(manager.tokenManager()).getAcceptedTokens();
        ILiquidationPoolManager.Asset[] memory assets = new ILiquidationPoolManager.Asset[](tokens.length);
        uint256 ethBalance;
        for (uint256 i = 0; i < tokens.length; i++) {
            ITokenManager.Token memory token = tokens[i];
            if (token.addr == address(0)) {
                ethBalance = address(this).balance;
                if (ethBalance > 0) assets[i] = ILiquidationPoolManager.Asset(token, ethBalance);
            } else {
                IERC20 ierc20 = IERC20(token.addr);
                uint256 erc20balance = ierc20.balanceOf(address(this));
                if (erc20balance > 0) {
                    assets[i] = ILiquidationPoolManager.Asset(token, erc20balance);
                    ierc20.approve(pool, erc20balance);
                }
            }
        }

        LiquidationPool(pool).distributeAssets{value: ethBalance}(assets, manager.collateralRate(), manager.HUNDRED_PC());
    }
}
