const COLLATERAL_RATE = 110000;
const PRICE_EUR_USD = 106000000;
const PRICE_ETH_USD = 190000000000;
const PRICE_WBTC_USD = 3500000000000;
const PRICE_USDC_USD = 100000000;

const mockTokenManager = async _ => {
  const MockERC20Factory = await ethers.getContractFactory('MockERC20');
  WBTC = await MockERC20Factory.deploy('Wrapped Bitcoin', 'WBTC', 8);
  USDC = await MockERC20Factory.deploy('USD Coin', 'USDC', 6);
  const EthUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(PRICE_ETH_USD, 'ETH/USD'); // $1900
  const WbtcUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(PRICE_WBTC_USD, 'WBTC/USD'); // $35,000
  const UsdcUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(PRICE_USDC_USD, 'USDC/USD'); // 1$
  const TokenManager = await (await ethers.getContractFactory('MockTokenManager')).deploy(
    ethers.utils.formatBytes32String('ETH'), EthUsd.address
  );
  await TokenManager.addAcceptedToken(WBTC.address, WbtcUsd.address);
  await TokenManager.addAcceptedToken(USDC.address, UsdcUsd.address);
  return { TokenManager, WBTC, USDC };
};

module.exports = {
  COLLATERAL_RATE,
  PRICE_EUR_USD,
  PRICE_ETH_USD,
  PRICE_WBTC_USD,
  PRICE_USDC_USD,
  mockTokenManager
};