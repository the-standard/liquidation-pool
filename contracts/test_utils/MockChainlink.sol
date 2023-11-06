// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockChainlink is AggregatorV3Interface {

    string private desc;
    int256 private answer;

    struct PriceRound { uint256 timestamp; int256 price; }

    constructor (int256 _answer, string memory _desc) {
        answer = _answer;
        desc = _desc;
    }

    function decimals() external pure returns (uint8) { return 8; }

    function getRoundData(uint80 _roundId) external view returns (uint80, int256 _answer, uint256, uint256, uint80) {
        _answer = answer;
    }

    function latestRoundData() external view returns (uint80, int256 _answer,uint256, uint256,uint80) {
        _answer = answer;
    }

    function description() external view returns (string memory) {
        return desc;
    }

    function version() external view returns (uint256) {
        return 1;
    }
}
