const mockTokenManager = async _ => {
  const MockERC20Factory = await ethers.getContractFactory('MockERC20');
  WBTC = await MockERC20Factory.deploy('Wrapped Bitcoin', 'WBTC', 8);
  USDC = await MockERC20Factory.deploy('USD Coin', 'USDC', 6);
  const EthUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(190000000000, 'ETH/USD'); // $1900
  const WbtcUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(3500000000000, 'ETH/USD'); // $35,000
  const UsdcUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(100000000, 'ETH/USD'); // 1$
  const TokenManager = await (await ethers.getContractFactory('MockTokenManager')).deploy(
    ethers.utils.formatBytes32String('ETH'), EthUsd.address
  );
  await TokenManager.addAcceptedToken(WBTC.address, WbtcUsd.address);
  await TokenManager.addAcceptedToken(USDC.address, UsdcUsd.address);
  return { TokenManager, WBTC, USDC };
}

module.exports = {
  mockTokenManager
};