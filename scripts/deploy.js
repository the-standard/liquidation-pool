const { ethers } = require("hardhat");
const { ETH, DEFAULT_ETH_USD_PRICE, DEFAULT_EUR_USD_PRICE, DEFAULT_COLLATERAL_RATE, getNFTMetadataContract } = require("../test/common");

async function main() {

  const LiquidationPoolManager = await (await ethers.getContractFactory('LiquidationPoolManager')).deploy(
    '0xcD2204188db24d8db2b15151357e43365443B113', '0x5D1684E5b989Eb232ac84D6b73D783FE44114C2b',
    '0xBbB704f184E716410a9c00435530eA055CfAD187', '0x34319A7424bC39C29958d2eb905D743C2b1cAFCa'
  );
  await LiquidationPoolManager.deployed();

  const LiquidationPool = await ethers.getContractAt('LiquidationPool', await LiquidationPoolManager.pool());

  const LiquidationAutomation = await (await ethers.getContractFactory('LiquidationAutomation')).deploy(
    LiquidationPoolManager.address, '0xBbB704f184E716410a9c00435530eA055CfAD187',
    '0xa5247cd55Ee780CdFFE4D4BddC070D749B6950af'
  );

  await LiquidationAutomation.deployed();

  await new Promise(resolve => setTimeout(resolve, 60000));

  await run(`verify:verify`, {
    address: LiquidationPoolManager.address,
    constructorArguments: [
      '0xcD2204188db24d8db2b15151357e43365443B113', '0x5D1684E5b989Eb232ac84D6b73D783FE44114C2b',
      '0xBbB704f184E716410a9c00435530eA055CfAD187', '0x34319A7424bC39C29958d2eb905D743C2b1cAFCa'
    ],
  });

  await run(`verify:verify`, {
    address: LiquidationPool.address,
    constructorArguments: [
      '0xcD2204188db24d8db2b15151357e43365443B113', '0x5D1684E5b989Eb232ac84D6b73D783FE44114C2b',
      '0x34319A7424bC39C29958d2eb905D743C2b1cAFCa', '0x18f413879A00Db35A4Ea22300977924E613F3D88'
    ],
  });

  await run(`verify:verify`, {
    address: LiquidationAutomation.address,
    constructorArguments: [
      LiquidationPoolManager.address, '0xBbB704f184E716410a9c00435530eA055CfAD187',
      '0xa5247cd55Ee780CdFFE4D4BddC070D749B6950af'
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});