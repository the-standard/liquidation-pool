const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const { mockTokenManager, PRICE_EUR_USD, PRICE_ETH_USD, PRICE_WBTC_USD, PRICE_USDC_USD, COLLATERAL_RATE, HUNDRED_PC, TOKEN_ID, rewardAmountForAsset, fastForward, DAY } = require("./common");

describe('LiquidationPoolManager', async () => {
  let LiquidationPoolManager, LiquidationPool, MockSmartVaultManager, TokenManager,
  TST, EUROs, WBTC, USDC, holder1, holder2, holder3, holder4, holder5, MockERC20Factory;

  beforeEach(async () => {
    [holder1, holder2, holder3, holder4, holder5] = await ethers.getSigners();
    MockERC20Factory = await ethers.getContractFactory('MockERC20');
    TST = await MockERC20Factory.deploy('The Standard Token', 'TST', 18);
    EUROs = await (await ethers.getContractFactory('MockEUROs')).deploy();
    ({ TokenManager, WBTC, USDC } = await mockTokenManager());
    MockSmartVaultManager = await (await ethers.getContractFactory('MockSmartVaultManager')).deploy(COLLATERAL_RATE, TokenManager.address);
    const EurUsd = await (await ethers.getContractFactory('MockChainlink')).deploy(PRICE_EUR_USD, 'EUR/USD'); // $1.06
    LiquidationPoolManager = await (await ethers.getContractFactory('LiquidationPoolManager')).deploy(
      TST.address, EUROs.address, MockSmartVaultManager.address, EurUsd.address
    );
    LiquidationPool = await ethers.getContractAt('LiquidationPool', await LiquidationPoolManager.pool());
  });
  
  afterEach(async () => {
    await network.provider.send("hardhat_reset")
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

      let { _position } = await LiquidationPool.position(holder1.address);
      expect(_position.EUROs).to.equal(feeBalance.mul(tstPosition1Value).div(poolTSTTotal));

      ({ _position } = await LiquidationPool.position(holder2.address));
      expect(_position.EUROs).to.equal(feeBalance.mul(tstPosition2Value).div(poolTSTTotal));

      ({ _position } = await LiquidationPool.position(holder3.address));
      expect(_position.EUROs).to.equal(feeBalance.mul(tstPosition3Value).div(poolTSTTotal));

      ({ _position } = await LiquidationPool.position(holder4.address));
      expect(_position.EUROs).to.equal(feeBalance.mul(tstPosition4Value).div(poolTSTTotal));

      ({ _position } = await LiquidationPool.position(holder5.address));
      expect(_position.EUROs).to.equal(feeBalance.mul(tstPosition5Value).div(poolTSTTotal));

      expect(await EUROs.balanceOf(LiquidationPoolManager.address)).to.equal(0);
      expect(await EUROs.balanceOf(LiquidationPool.address)).to.equal(feeBalance);
    });
  });

  describe('runLiquidation', async () => {

    const discounted = amount => {
      return amount.mul(HUNDRED_PC).div(COLLATERAL_RATE);
    }

    const reverseDiscounted = amount => {
      return amount.mul(COLLATERAL_RATE).div(HUNDRED_PC);
    }

    const scaleUpFrom = (amount, dec) => {
      return amount.mul(BigNumber.from(10).pow(18 - dec));
    }

    const scaleDownTo = (amount, dec) => {
      return amount.div(BigNumber.from(10).pow(18 - dec));
    }

    it('runs liquidations, and reverts if nothing to liquidate', async () => {
      await expect(LiquidationPoolManager.runLiquidation(TOKEN_ID)).to.be.revertedWith('vault-not-undercollateralised');
    });

    it('distributes liquidated assets among stake holders if there is enough EUROs to purchase', async () => {
      const ethCollateral = ethers.utils.parseEther('0.5');
      const wbtcCollateral = BigNumber.from(1_000_000);
      const usdcCollateral = BigNumber.from(500_000_000);
      // create some funds to be "liquidated"
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

      const tstStake2 = ethers.utils.parseEther('4000');
      const eurosStake2 = ethers.utils.parseEther('3000');
      await TST.mint(holder2.address, tstStake2);
      await EUROs.mint(holder2.address, eurosStake2);
      await TST.connect(holder2).approve(LiquidationPool.address, tstStake2);
      await EUROs.connect(holder2).approve(LiquidationPool.address, eurosStake2);
      await LiquidationPool.connect(holder2).increasePosition(tstStake2, eurosStake2);

      await fastForward(DAY);
      
      await expect(LiquidationPoolManager.runLiquidation(TOKEN_ID)).not.to.be.reverted;

      expect(await ethers.provider.getBalance(LiquidationPool.address)).to.equal(ethCollateral);
      expect(await WBTC.balanceOf(LiquidationPool.address)).to.equal(wbtcCollateral);
      expect(await USDC.balanceOf(LiquidationPool.address)).to.equal(usdcCollateral);

      // staker 1 has 1000 stake value
      // staker 2 has 3000 stake value
      // 25% should go to staker 1, 75% to staker 2
      let { _rewards, _position } = await LiquidationPool.position(holder1.address);
      expect(_rewards.length).to.equal(3)
      expect(rewardAmountForAsset(_rewards, 'ETH')).equal(ethCollateral.div(4));
      expect(rewardAmountForAsset(_rewards, 'WBTC')).to.equal(wbtcCollateral.div(4));
      expect(rewardAmountForAsset(_rewards, 'USDC')).to.equal(usdcCollateral.div(4));
      // value of purchased assets:
      // 0.125 ETH = 0.125 * $1900 = $237.50 = ~€224.06
      // with ~91% discount = ~€203.69
      // 0.0025 WBTC = 0.0025 * $35000 = $87.5 = ~€82.55
      // with ~91% discount = ~€75.04
      // 125 USDC = ~€117.92
      // with ~91% discount = ~€107.20
      // new staked EUROs value should be 2000 - ~203.69 - ~75.04 - ~107.20 = ~€1614.07
      const purchasePrice1 = discounted(ethCollateral.div(4).mul(PRICE_ETH_USD).div(PRICE_EUR_USD))
        .add(discounted(scaleUpFrom(wbtcCollateral, 8).div(4).mul(PRICE_WBTC_USD).div(PRICE_EUR_USD)))
        .add(discounted(scaleUpFrom(usdcCollateral, 6).div(4).mul(PRICE_USDC_USD).div(PRICE_EUR_USD)));
      expect(_position.TST).to.equal(tstStake1);
      expect(_position.EUROs).to.equal(eurosStake1.sub(purchasePrice1));

      ({ _rewards, _position } = await LiquidationPool.position(holder2.address));
      // both uses have 1000 stake value, should receive half each
      expect(_rewards.length).to.equal(3)
      expect(rewardAmountForAsset(_rewards, 'ETH')).equal(ethCollateral.mul(3).div(4));
      expect(rewardAmountForAsset(_rewards, 'WBTC')).to.equal(wbtcCollateral.mul(3).div(4));
      expect(rewardAmountForAsset(_rewards, 'USDC')).to.equal(usdcCollateral.mul(3).div(4));
      // value of purchased assets:
      // 0.375 ETH = 0.375 * $1900 = $712.5 = ~€672.17
      // with ~91% discount = ~€611.06
      // 0.0075 WBTC = 0.0075 * $35000 = $262.5 = ~€247.64
      // with ~91% discount = ~€225.13
      // 375 USDC = ~€353.77
      // with ~91% discount = ~€321.61
      // new staked EUROs value should be 3000 - ~611.06 - ~225.13 - ~321.61 = ~€1842.2
      const purchasePrice2 = discounted(ethCollateral.mul(3).div(4).mul(PRICE_ETH_USD).div(PRICE_EUR_USD))
        .add(discounted(scaleUpFrom(wbtcCollateral, 8).mul(3).div(4).mul(PRICE_WBTC_USD).div(PRICE_EUR_USD)))
        .add(discounted(scaleUpFrom(usdcCollateral, 6).mul(3).div(4).mul(PRICE_USDC_USD).div(PRICE_EUR_USD)));
      expect(_position.TST).to.equal(tstStake2);
      expect(_position.EUROs).to.equal(eurosStake2.sub(purchasePrice2));

      const estimatedSupply = eurosStake1.add(eurosStake2).sub(purchasePrice1).sub(purchasePrice2);
      expect(await EUROs.totalSupply()).to.equal(estimatedSupply);
    });

    it('does not distribute fees or liquidity if there is no TST staked', async () => {
      const fees = ethers.utils.parseEther('1000');
      const ethCollateral = ethers.utils.parseEther('0.1');
      const wbtcCollateral = BigNumber.from(1_000_000);

      await holder1.sendTransaction({to: LiquidationPoolManager.address, value: ethCollateral});
      await WBTC.mint(MockSmartVaultManager.address, wbtcCollateral);

      const eurosStake = ethers.utils.parseEther('1000');
      await EUROs.mint(holder1.address, eurosStake);
      await EUROs.connect(holder1).approve(LiquidationPool.address, eurosStake);
      await LiquidationPool.connect(holder1).increasePosition(0, eurosStake);

      await EUROs.mint(LiquidationPoolManager.address, fees);

      await LiquidationPoolManager.runLiquidation(TOKEN_ID);

      expect(await EUROs.balanceOf(LiquidationPoolManager.address)).to.equal(fees);
      expect(await ethers.provider.getBalance(LiquidationPoolManager.address)).to.equal(ethCollateral);

      const { _position } = await LiquidationPool.position(holder1.address);
      expect(_position.TST).to.equal(0);
      expect(_position.EUROs).to.equal(eurosStake);
    });

    it('distributes fees before running liquidation', async () => {
      // create "liquidation" funds
      const ethCollateral = ethers.utils.parseEther('0.05');
      await holder1.sendTransaction({to: MockSmartVaultManager.address, value: ethCollateral});

      const tstStake1 = ethers.utils.parseEther('1000');
      await TST.mint(holder1.address, tstStake1);
      await TST.connect(holder1).approve(LiquidationPool.address, tstStake1);
      await LiquidationPool.connect(holder1).increasePosition(tstStake1, 0)

      const fees = ethers.utils.parseEther('1000');
      await EUROs.mint(LiquidationPoolManager.address, fees);

      await fastForward(DAY);

      await LiquidationPoolManager.runLiquidation(TOKEN_ID);

      expect(await EUROs.balanceOf(LiquidationPoolManager.address)).to.equal(0);
      expect(await ethers.provider.getBalance(LiquidationPool.address)).to.equal(ethCollateral);
      // 0.05 ETH = 0.05 * $1900 = $95 = ~€89.62
      // with discount user pays ~€81.48
      const expectedEUROsSpent = discounted(ethCollateral.mul(PRICE_ETH_USD).div(PRICE_EUR_USD))
      const { _position } = await LiquidationPool.position(holder1.address);
      expect(_position.EUROs).to.equal(fees.sub(expectedEUROsSpent));
      expect(await EUROs.balanceOf(LiquidationPool.address)).to.equal(fees.sub(expectedEUROsSpent));
    });

    it('returns unpurchased liquidated assets to protocol address', async () => {
      // create "liquidation" funds
      const ethCollateral = ethers.utils.parseEther('0.1');
      const wbtcCollateral = BigNumber.from(2_000_000);
      const usdcCollateral = BigNumber.from(500_000_000);
      await holder1.sendTransaction({to: MockSmartVaultManager.address, value: ethCollateral});
      await WBTC.mint(MockSmartVaultManager.address, wbtcCollateral);
      await USDC.mint(MockSmartVaultManager.address, usdcCollateral);

      const tstStake1 = ethers.utils.parseEther('100');
      const eurosStake1 = ethers.utils.parseEther('100');
      await TST.mint(holder1.address, tstStake1);
      await EUROs.mint(holder1.address, eurosStake1);
      await TST.connect(holder1).approve(LiquidationPool.address, tstStake1);
      await EUROs.connect(holder1).approve(LiquidationPool.address, eurosStake1);
      await LiquidationPool.connect(holder1).increasePosition(tstStake1, eurosStake1);

      const tstStake2 = ethers.utils.parseEther('2000');
      const eurosStake2 = ethers.utils.parseEther('300');
      await TST.mint(holder2.address, tstStake2);
      await EUROs.mint(holder2.address, eurosStake2);
      await TST.connect(holder2).approve(LiquidationPool.address, tstStake2);
      await EUROs.connect(holder2).approve(LiquidationPool.address, eurosStake2);
      await LiquidationPool.connect(holder2).increasePosition(tstStake2, eurosStake2);

      await fastForward(DAY);

      await LiquidationPoolManager.runLiquidation(TOKEN_ID);

      let { _position, _rewards } = await LiquidationPool.position(holder1.address);
      expect(_position.EUROs).to.equal(0);
      
      // 0.025 ETH = 0.025 * $1900 = $47.5 = ~€44.81
      // discounted, user spent ~€40.74
      // ~€59.26 to spend on WBTC, which can buy ~€65.19 worth, discounted
      // ~€65.19 = $69.1 = 0.00197 WBTC;
      //
      // then there is 0 EUROs left to buy USDC
      const spentOnEth1 = discounted(ethCollateral.div(4)
        .mul(PRICE_ETH_USD).div(PRICE_EUR_USD));
      const expectedWBTCPurchased1 = scaleDownTo(reverseDiscounted(eurosStake1.sub(spentOnEth1)), 8)
        .mul(PRICE_EUR_USD).div(PRICE_WBTC_USD);
      expect(_rewards).to.have.length(3);
      expect(rewardAmountForAsset(_rewards, 'ETH')).to.equal(ethCollateral.div(4));
      expect(rewardAmountForAsset(_rewards, 'WBTC')).to.equal(expectedWBTCPurchased1);

      ({ _position, _rewards } = await LiquidationPool.position(holder2.address));
      expect(_position.EUROs).to.equal(0);
      
      // 0.075 ETH = 0.075 * $1900 = $142.5 = ~€134.43
      // discounted, user spent ~€122.21
      // ~€177.79 to spend on WBTC, which can buy ~€195.57 worth, discounted
      // ~€195.57 = $207.3 = 0.00592 WBTC;
      //
      // then there is 0 EUROs left to buy USDC
      const spentOnEth2 = discounted(ethCollateral.mul(3).div(4)
        .mul(PRICE_ETH_USD).div(PRICE_EUR_USD));
      const expectedWBTCPurchased2 = scaleDownTo(reverseDiscounted(eurosStake2.sub(spentOnEth2)), 8)
        .mul(PRICE_EUR_USD).div(PRICE_WBTC_USD);
      expect(_rewards).to.have.length(3);
      expect(rewardAmountForAsset(_rewards, 'ETH')).to.equal(ethCollateral.mul(3).div(4));
      expect(rewardAmountForAsset(_rewards, 'WBTC')).to.equal(expectedWBTCPurchased2);

      // all ETH should have moved to pool
      expect(await await ethers.provider.getBalance(LiquidationPool.address)).to.equal(ethCollateral);
      expect(await await ethers.provider.getBalance(LiquidationPoolManager.address)).to.equal(0);
      // some WBTC should have moved to pool
      const expectedWBTCInPool = expectedWBTCPurchased1.add(expectedWBTCPurchased2);
      expect(await WBTC.balanceOf(LiquidationPool.address)).to.equal(expectedWBTCInPool);
      expect(await WBTC.balanceOf(LiquidationPoolManager.address)).to.equal(wbtcCollateral.sub(expectedWBTCInPool));
      // all USDC should have remained in manager
      expect(await USDC.balanceOf(LiquidationPool.address)).to.equal(0);
      expect(await USDC.balanceOf(LiquidationPoolManager.address)).to.equal(usdcCollateral);
    });

    it('increases existing rewards with multiple liquidations', async () => {
      const ethCollateral = ethers.utils.parseEther('0.5');
      const wbtcCollateral = BigNumber.from(1_000_000);
      const usdcCollateral = BigNumber.from(500_000_000);
      // create some funds to be "liquidated"
      await holder5.sendTransaction({to: MockSmartVaultManager.address, value: ethCollateral});
      await WBTC.mint(MockSmartVaultManager.address, wbtcCollateral);

      const tstStake = ethers.utils.parseEther('1000');
      const eurosStake = ethers.utils.parseEther('2000');
      await TST.mint(holder1.address, tstStake);
      await EUROs.mint(holder1.address, eurosStake);
      await TST.connect(holder1).approve(LiquidationPool.address, tstStake);
      await EUROs.connect(holder1).approve(LiquidationPool.address, eurosStake);
      await LiquidationPool.connect(holder1).increasePosition(tstStake, eurosStake)

      await fastForward(DAY);

      await expect(LiquidationPoolManager.runLiquidation(TOKEN_ID)).not.to.be.reverted;

      expect(await ethers.provider.getBalance(LiquidationPool.address)).to.equal(ethCollateral);
      expect(await WBTC.balanceOf(LiquidationPool.address)).to.equal(wbtcCollateral);

      let { _rewards } = await LiquidationPool.position(holder1.address);
      expect(_rewards).to.have.length(3)
      expect(rewardAmountForAsset(_rewards, 'ETH')).equal(ethCollateral);
      expect(rewardAmountForAsset(_rewards, 'WBTC')).to.equal(wbtcCollateral);

      // create some more funds to be "liquidated"
      await holder5.sendTransaction({to: MockSmartVaultManager.address, value: ethCollateral});
      await USDC.mint(MockSmartVaultManager.address, usdcCollateral);

      await EUROs.mint(holder1.address, eurosStake);
      await EUROs.connect(holder1).approve(LiquidationPool.address, eurosStake);
      await LiquidationPool.connect(holder1).increasePosition(0, eurosStake)

      await fastForward(DAY);

      await expect(LiquidationPoolManager.runLiquidation(TOKEN_ID)).not.to.be.reverted;

      ({ _rewards, _position } = await LiquidationPool.position(holder1.address));
      expect(_rewards).to.have.length(3)
      expect(rewardAmountForAsset(_rewards, 'ETH')).equal(ethCollateral.mul(2));
      expect(rewardAmountForAsset(_rewards, 'WBTC')).to.equal(wbtcCollateral);
      expect(rewardAmountForAsset(_rewards, 'USDC')).to.equal(usdcCollateral);
    });
  });
});