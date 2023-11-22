// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol" as Chainlink;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "contracts/interfaces/ITokenManager.sol";

contract MockTokenManager is ITokenManager {
    bytes32 private immutable NATIVE;

    Token[] private acceptedTokens;

    error TokenExists(bytes32 symbol, address token);
    event TokenAdded(bytes32 symbol, address token);
    event TokenRemoved(bytes32 symbol);

    constructor(bytes32 _native, address _clNativeUsd) {
        NATIVE = _native;
        acceptedTokens.push(Token(NATIVE, address(0), 18, _clNativeUsd, Chainlink.AggregatorV3Interface(_clNativeUsd).decimals()));
    }

    function getAcceptedTokens() external view returns (Token[] memory) {
        return acceptedTokens;
    }

    function addAcceptedToken(address _token, address _chainlinkFeed) external {
        ERC20 token = ERC20(_token);
        bytes32 symbol = bytes32(bytes(token.symbol()));
        for (uint256 i = 0; i < acceptedTokens.length; i++) if (acceptedTokens[i].symbol == symbol) revert TokenExists(symbol, _token);
        Chainlink.AggregatorV3Interface dataFeed = Chainlink.AggregatorV3Interface(_chainlinkFeed);
        acceptedTokens.push(Token(symbol, _token, token.decimals(), _chainlinkFeed, dataFeed.decimals()));
        emit TokenAdded(symbol, _token);
    }
}
