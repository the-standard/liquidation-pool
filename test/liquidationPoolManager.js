const { expect } = require("chai");
const { ethers } = require("hardhat");

describe('LiquidationPoolManager', async () => {
  let LiquidationPoolManager, LiquidationPool, MockSmartVaultManager, TST, EUROs,
  WBTC, USDC, holder1, holder2, holder3, holder4, holder5, MockERC20Factory;

  const mockTokenManager = async _ => {
    WBTC = await MockERC20Factory.deploy('Wrapped Bitcoin', 'WBTC', 8);
    USDC = await MockERC20Factory.deploy('USD Coin', 'USDC', 6);
    const EthUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(190000000000, 'ETH/USD'); // $1900
    const WbtcUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(3500000000000, 'ETH/USD'); // $35,000
    const UsdcUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(100000000, 'ETH/USD'); // 1$
    const TokenManager = await (await ethers.getContractFactory('TokenManager')).deploy(
      ethers.utils.formatBytes32String('ETH'), EthUsd.address
    );
    await TokenManager.addAcceptedToken(WBTC.address, WbtcUsd.address);
    await TokenManager.addAcceptedToken(USDC.address, UsdcUsd.address);
    return TokenManager;
  }

  beforeEach(async () => {
    [holder1, holder2, holder3, holder4, holder5] = await ethers.getSigners();
    MockERC20Factory = await ethers.getContractFactory('MockERC20');
    TST = await MockERC20Factory.deploy('The Standard Token', 'TST', 18);
    EUROs = await (await ethers.getContractFactory('MockEUROs')).deploy();
    const TokenManager = await mockTokenManager();
    MockSmartVaultManager = await (await ethers.getContractFactory('MockSmartVaultManager')).deploy(TokenManager.address);
    const EurUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(106000000, 'EUR/USD'); // $1.06
    LiquidationPoolManager = await (await ethers.getContractFactory('LiquidationPoolManager')).deploy(
      TST.address, EUROs.address, MockSmartVaultManager.address, TokenManager.address, EurUsd.address
    );
    LiquidationPool = await ethers.getContractAt('LiquidationPool', await LiquidationPoolManager.pool());
  });

  describe('distributeFees', async () => {
    it('distributes all the accrued EUROs fees in the contract between pool TST holders', async () => {
      
      const tstPosition1Value = ethers.utils.parseEther('1250');
      let poolTSTTotal = tstPosition1Value;
      await TST.mint(holder1.address, poolTSTTotal);
      await TST.connect(holder1).approve(LiquidationPool.address, tstPosition1Value)
      await LiquidationPool.connect(holder1).increasePosition(tstPosition1Value, 0);
      
      const tstPosition2Value = ethers.utils.parseEther('7000');
      poolTSTTotal = poolTSTTotal.add(tstPosition2Value);
      await TST.mint(holder2.address, poolTSTTotal);
      await TST.connect(holder2).approve(LiquidationPool.address, tstPosition2Value)
      await LiquidationPool.connect(holder2).increasePosition(tstPosition2Value, 0);
      
      const tstPosition3Value = ethers.utils.parseEther('85000');
      poolTSTTotal = poolTSTTotal.add(tstPosition3Value);
      await TST.mint(holder3.address, poolTSTTotal);
      await TST.connect(holder3).approve(LiquidationPool.address, tstPosition3Value)
      await LiquidationPool.connect(holder3).increasePosition(tstPosition3Value, 0);
      
      const tstPosition4Value = ethers.utils.parseEther('800');
      poolTSTTotal = poolTSTTotal.add(tstPosition4Value);
      await TST.mint(holder4.address, poolTSTTotal);
      await TST.connect(holder4).approve(LiquidationPool.address, tstPosition4Value)
      await LiquidationPool.connect(holder4).increasePosition(tstPosition4Value, 0);
      
      const tstPosition5Value = ethers.utils.parseEther('600000');
      poolTSTTotal = poolTSTTotal.add(tstPosition5Value);
      await TST.mint(holder5.address, poolTSTTotal);
      await TST.connect(holder5).approve(LiquidationPool.address, tstPosition5Value)
      await LiquidationPool.connect(holder5).increasePosition(tstPosition5Value, 0);

      const feeBalance = ethers.utils.parseEther('1000');
      await EUROs.mint(LiquidationPoolManager.address, feeBalance);

      await LiquidationPoolManager.distributeFees();

      let position = await LiquidationPool.position(holder1.address);
      expect(position.EUROs).to.equal(feeBalance.mul(tstPosition1Value).div(poolTSTTotal));

      position = await LiquidationPool.position(holder2.address);
      expect(position.EUROs).to.equal(feeBalance.mul(tstPosition2Value).div(poolTSTTotal));

      position = await LiquidationPool.position(holder3.address);
      expect(position.EUROs).to.equal(feeBalance.mul(tstPosition3Value).div(poolTSTTotal));

      position = await LiquidationPool.position(holder4.address);
      expect(position.EUROs).to.equal(feeBalance.mul(tstPosition4Value).div(poolTSTTotal));

      position = await LiquidationPool.position(holder5.address);
      expect(position.EUROs).to.equal(feeBalance.mul(tstPosition5Value).div(poolTSTTotal));

      expect(await EUROs.balanceOf(LiquidationPoolManager.address)).to.equal(0);
      expect(await EUROs.balanceOf(LiquidationPool.address)).to.equal(feeBalance);
    });
  });

  const rewardAmountForAsset = (rewards,symbol) => {
    return rewards.filter(reward => reward.symbol === ethers.utils.formatBytes32String(symbol))[0].amount;
  } 

  describe('runLiquidations', async () => {
    it('runs liquidations, and reverts if nothing to liquidate', async () => {
      await expect(LiquidationPoolManager.runLiquidations()).to.be.revertedWith('no-liquidatable-vaults');
    });

    const estimateFormatted = amount => {
      return Math.round(Number(ethers.utils.formatEther(amount)))
    }

    it.only('distributes liquidated assets among stake holders if there is enough EUROs to purchase', async () => {
      const ethCollateral = ethers.utils.parseEther('0.5');
      const wbtcCollateral = 1_000_000;
      const usdcCollateral = 500_000_000;
      await holder5.sendTransaction({to: MockSmartVaultManager.address, value: ethCollateral});
      await WBTC.mint(MockSmartVaultManager.address, wbtcCollateral);
      await USDC.mint(MockSmartVaultManager.address, usdcCollateral);

      const tstStake1 = ethers.utils.parseEther('1000');
      const eurosStake1 = ethers.utils.parseEther('2000');
      await TST.mint(holder1.address, tstStake1);
      await EUROs.mint(holder1.address, eurosStake1);
      await TST.connect(holder1).approve(LiquidationPool.address, tstStake1);
      await EUROs.connect(holder1).approve(LiquidationPool.address, eurosStake1);
      await LiquidationPool.connect(holder1).increasePosition(tstStake1, eurosStake1)

      const tstStake2 = ethers.utils.parseEther('3000');
      const eurosStake2 = ethers.utils.parseEther('1000');
      await TST.mint(holder2.address, tstStake2);
      await EUROs.mint(holder2.address, eurosStake2);
      await TST.connect(holder2).approve(LiquidationPool.address, tstStake2);
      await EUROs.connect(holder2).approve(LiquidationPool.address, eurosStake2);
      await LiquidationPool.connect(holder2).increasePosition(tstStake2, eurosStake2)

      // await expect(LiquidationPoolManager.runLiquidations()).not.to.be.reverted;
      await LiquidationPoolManager.runLiquidations()

      expect(await ethers.provider.getBalance(LiquidationPool.address)).to.equal(ethCollateral);
      expect(await WBTC.balanceOf(LiquidationPool.address)).to.equal(wbtcCollateral);
      expect(await USDC.balanceOf(LiquidationPool.address)).to.equal(usdcCollateral);

      let { _rewards, _position } = await LiquidationPool.position(holder1.address);
      // both uses have 1000 stake value, should receive half each
      expect(_rewards.length).to.equal(3)
      expect(rewardAmountForAsset(_rewards, 'ETH')).equal(ethers.utils.parseEther('0.25'));
      expect(rewardAmountForAsset(_rewards, 'WBTC')).to.equal(500_000);
      expect(rewardAmountForAsset(_rewards, 'USDC')).to.equal(250_000_000);
      // value of all assets in USD:
      // 0.25 * 1900 + 0.005 * 35000 + 500 = 475 + 175 + 250 = $900
      // $900 = €849
      // 91% of 849 = 773 EUROs
      // new EUROs stake should be 2000 - 773 = 1227 EUROs
      expect(_position.TST).to.equal(tstStake1);
      expect(estimateFormatted(_position.EUROs)).to.equal(1227);

      ({ _rewards, _position } = await LiquidationPool.position(holder2.address));
      // both uses have 1000 stake value, should receive half each
      expect(_rewards.length).to.equal(3)
      expect(rewardAmountForAsset(_rewards, 'ETH')).equal(ethers.utils.parseEther('0.25'));
      expect(rewardAmountForAsset(_rewards, 'WBTC')).to.equal(500_000);
      expect(rewardAmountForAsset(_rewards, 'USDC')).to.equal(250_000_000);
      // value of all assets in USD:
      // 0.25 * 1900 + 0.005 * 35000 + 500 = 475 + 175 + 250 = $900
      // $900 = €849
      // 91% of 849 = 773 EUROs
      // new EUROs stake should be 1000 - 773 = 227 EUROs
      expect(_position.TST).to.equal(tstStake2);
      expect(estimateFormatted(_position.EUROs)).to.equal(227);
    });

    xit('distributes fees before running liquidation', async () => {

    });

    xit('returns unpurchased liquidated assets to protocol address?', async () => {

    });
  });
});