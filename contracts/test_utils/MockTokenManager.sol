// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "contracts/interfaces/ITokenManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "hardhat/console.sol";

contract MockTokenManager is ITokenManager {

    address[] private tokens;

    constructor(address[] memory _tokens) {
        tokens = _tokens;
    }

    function getAcceptedTokens() external view returns (ITokenManager.Token[] memory) {
        ITokenManager.Token[] memory _tokens = new ITokenManager.Token[](tokens.length + 1);
        for (uint256 i = 0; i < tokens.length; i++) {
            ERC20 _token = ERC20(tokens[i]);
            _tokens[i] = ITokenManager.Token(
                bytes32(bytes(_token.symbol())), address(_token), _token.decimals(), address(0), 0
            );
        }
        _tokens[_tokens.length - 1] = ITokenManager.Token(
            bytes32("ETH"), address(0), 18, address(0), 0
        );
        return _tokens;
    }
}