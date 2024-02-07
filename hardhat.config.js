require("@nomicfoundation/hardhat-toolbox");
require('hardhat-contract-sizer');
require('dotenv').config();
require("@nomiclabs/hardhat-etherscan");

const { 
  MAIN_ACCOUNT_PRIVATE_KEY, TEST_ACCOUNT_PRIVATE_KEY, ARBISCAN_KEY,
  ALCHEMY_ARBITRUM_KEY, ALCHEMY_ARBITRUM_SEPOLIA_KEY
} = process.env;

module.exports = {
  solidity: "0.8.20",
  networks: {
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_ARBITRUM_KEY}`,
      accounts: [MAIN_ACCOUNT_PRIVATE_KEY]
    },
    arbitrum_sepolia: {
      url: `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_ARBITRUM_SEPOLIA_KEY}`,
      accounts: [TEST_ACCOUNT_PRIVATE_KEY]
    },
    // hardhat: {
    //   forking: {
    //     url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_ARBITRUM_SEPOLIA_KEY}`,
    //     blockNumber: 1746910
    //   }
    // },
    hardhat: {
      accounts: {
        count: 101
      }
    }
  },
  etherscan: {
    apiKey: {
      arbitrumOne: ARBISCAN_KEY,
      arbitrumSepolia: ARBISCAN_KEY
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/"
        }
      }
    ]
  },
  mocha: {
    timeout: 10000
  }
};
