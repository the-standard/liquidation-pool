const { expect } = require("chai");
const { ethers } = require("hardhat");

describe('LiquidationPool', async () => {
  let user1, user2, user3, MockERC20Factory, LiquidationPoolManager, LiquidationPool, TST, EUROs;

  beforeEach(async () => {
    [ user1, user2, user3 ] = await ethers.getSigners();
    MockERC20Factory = await ethers.getContractFactory('MockERC20');
    TST = await MockERC20Factory.deploy('The Standard Token', 'TST', 18);
    EUROs = await MockERC20Factory.deploy('The Standard EURO', 'EUROs', 18);
    LiquidationPoolManager = await (await ethers.getContractFactory('LiquidationPoolManager')).deploy(TST.address, EUROs.address, ethers.constants.AddressZero, ethers.constants.AddressZero);
    LiquidationPool = await ethers.getContractAt('LiquidationPool', await LiquidationPoolManager.pool());
  });

  describe('position', async () => {
    it('provides the position data for given user', async () => {
      const position = await LiquidationPool.position(user1.address);

      expect(position.TST).to.equal('0');
      expect(position.EUROs).to.equal('0');
    });

    it('includes unclaimed EUROs fees if due', async () => {
      const tstVal = ethers.utils.parseEther('1000');
      const fees = ethers.utils.parseEther('100');

      await TST.mint(user1.address, tstVal);
      await TST.approve(LiquidationPool.address, tstVal);
      await LiquidationPool.increasePosition(tstVal, 0);
      await EUROs.mint(LiquidationPoolManager.address, fees);

      const position = await LiquidationPool.position(user1.address);
      expect(position.TST).to.equal(tstVal);
      expect(position.EUROs).to.equal(fees);
    });

    it('does not include unclaimed EUROs fees for non-holders', async () => {
      const fees = ethers.utils.parseEther('100');

      await EUROs.mint(LiquidationPoolManager.address, fees);

      const position = await LiquidationPool.position(user1.address);
      expect(position.TST).to.equal(0);
      expect(position.EUROs).to.equal(0);
    });
  });

  describe('increase position', async () => {
    it('allows increasing position by one or both assets', async () => {
      const balance = ethers.utils.parseEther('5000');
      const tstVal = ethers.utils.parseEther('1000');
      const eurosVal = ethers.utils.parseEther('500');

      await TST.mint(user1.address, balance);
      await EUROs.mint(user1.address, balance);
      
      let increase = LiquidationPool.increasePosition(tstVal, eurosVal);
      await expect(increase).to.be.revertedWithCustomError(MockERC20Factory, 'ERC20InsufficientAllowance')

      let position = await LiquidationPool.position(user1.address);
      expect(position.TST).to.equal('0');
      expect(position.EUROs).to.equal('0');

      await TST.approve(LiquidationPool.address, tstVal);
      await EUROs.approve(LiquidationPool.address, eurosVal);

      increase = LiquidationPool.increasePosition(tstVal, eurosVal);
      await expect(increase).not.to.be.reverted;

      position = await LiquidationPool.position(user1.address);
      expect(position.TST).to.equal(tstVal);
      expect(position.EUROs).to.equal(eurosVal);

      await TST.approve(LiquidationPool.address, tstVal);
      increase = LiquidationPool.increasePosition(tstVal, 0);
      await expect(increase).not.to.be.reverted;

      position = await LiquidationPool.position(user1.address);
      expect(position.TST).to.equal(tstVal.mul(2));
      expect(position.EUROs).to.equal(eurosVal);

      await EUROs.approve(LiquidationPool.address, eurosVal);
      increase = LiquidationPool.increasePosition(0, eurosVal);
      await expect(increase).not.to.be.reverted;

      position = await LiquidationPool.position(user1.address);
      expect(position.TST).to.equal(tstVal.mul(2));
      expect(position.EUROs).to.equal(eurosVal.mul(2));
    });

    it('triggers a distribution of fees before increasing position', async () => {
      let tstStakeValue = ethers.utils.parseEther('10000');
      await TST.mint(user1.address, tstStakeValue);
      await TST.connect(user1).approve(LiquidationPool.address, tstStakeValue);
      await LiquidationPool.connect(user1).increasePosition(tstStakeValue, 0);

      tstStakeValue = ethers.utils.parseEther('90000');
      await TST.mint(user2.address, tstStakeValue);
      await TST.connect(user2).approve(LiquidationPool.address, tstStakeValue);
      await LiquidationPool.connect(user2).increasePosition(tstStakeValue, 0);

      const fees = ethers.utils.parseEther('100');
      await EUROs.mint(LiquidationPoolManager.address, fees);

      tstStakeValue = ethers.utils.parseEther('100000');
      await TST.mint(user3.address, tstStakeValue);
      await TST.connect(user3).approve(LiquidationPool.address, tstStakeValue);
      await LiquidationPool.connect(user3).increasePosition(tstStakeValue, 0);

      // should receive 10% of fees = 10 EUROs
      let position = await LiquidationPool.position(user1.address);
      expect(position.EUROs).to.equal(ethers.utils.parseEther('10'));

      // should receive 90% of fees = 90 EUROs
      position = await LiquidationPool.position(user2.address);
      expect(position.EUROs).to.equal(ethers.utils.parseEther('90'));

      // staking position after first round of fees already collected
      // should receive 0
      position = await LiquidationPool.position(user3.address);
      expect(position.EUROs).to.equal(0);

      await EUROs.mint(LiquidationPoolManager.address, fees);

      tstStakeValue = ethers.utils.parseEther('100000');
      await TST.mint(user1.address, tstStakeValue);
      await TST.connect(user1).approve(LiquidationPool.address, tstStakeValue);
      await LiquidationPool.connect(user1).increasePosition(tstStakeValue, 0);

      // increased position after second round of fees collected
      // has 10000 staked in pool of 200000
      // should have 10% of first round + 5% of second round
      // = 10 + 5 = 15 EUROs
      position = await LiquidationPool.position(user1.address);
      expect(position.EUROs).to.equal(ethers.utils.parseEther('15'));

      // received 90 EUROs in first round
      // now has 45% of pool (90000 from 200000)
      // 90 + 45 = 135 EUROs
      position = await LiquidationPool.position(user2.address);
      expect(position.EUROs).to.equal(ethers.utils.parseEther('135'));

      // should receive 50% of second round of fees
      // = 50% of 100 = 50 EUROs
      position = await LiquidationPool.position(user3.address);
      expect(position.EUROs).to.equal(ethers.utils.parseEther('50'));
    });
  });

  describe('decrease position', async () => {
    it('allows decreasing position by one or both assets', async () => {
      const balance = ethers.utils.parseEther('10000');
      await TST.mint(user1.address, balance);
      await EUROs.mint(user1.address, balance);

      await TST.approve(LiquidationPool.address, balance);
      await EUROs.approve(LiquidationPool.address, balance);

      await LiquidationPool.increasePosition(balance, balance);

      expect(await TST.balanceOf(user1.address)).to.equal(0);
      expect(await EUROs.balanceOf(user1.address)).to.equal(0);

      const decreaseValue = balance.div(2);
      await LiquidationPool.decreasePosition(decreaseValue, decreaseValue);

      let position = await LiquidationPool.position(user1.address);
      expect(position.TST).to.equal(balance.sub(decreaseValue));
      expect(position.EUROs).to.equal(balance.sub(decreaseValue));

      expect(await TST.balanceOf(user1.address)).to.equal(decreaseValue);
      expect(await EUROs.balanceOf(user1.address)).to.equal(decreaseValue);

      await LiquidationPool.decreasePosition(decreaseValue, 0);

      position = await LiquidationPool.position(user1.address);
      expect(position.TST).to.equal(0);
      expect(position.EUROs).to.equal(balance.sub(decreaseValue));

      expect(await TST.balanceOf(user1.address)).to.equal(balance);
      expect(await EUROs.balanceOf(user1.address)).to.equal(decreaseValue);

      await LiquidationPool.decreasePosition(0, decreaseValue);

      position = await LiquidationPool.position(user1.address);
      expect(position.TST).to.equal(0);
      expect(position.EUROs).to.equal(0);

      expect(await TST.balanceOf(user1.address)).to.equal(balance);
      expect(await EUROs.balanceOf(user1.address)).to.equal(balance);
    });

    it('triggers a distribution of fees before decreasing position', async () => {
      const tstStake1 = ethers.utils.parseEther('100000');
      await TST.mint(user1.address, tstStake1);
      await TST.approve(LiquidationPool.address, tstStake1);
      await LiquidationPool.increasePosition(tstStake1, 0);

      const tstStake2 = ethers.utils.parseEther('700000');
      await TST.mint(user2.address, tstStake2);
      await TST.connect(user2).approve(LiquidationPool.address, tstStake2);
      await LiquidationPool.connect(user2).increasePosition(tstStake2, 0);

      const fees = ethers.utils.parseEther('20');
      await EUROs.mint(LiquidationPoolManager.address, fees);

      // user1 should receive 12.5% of fees when they decrease their position;
      const distributedFees1 = ethers.utils.parseEther('2.5');
      await LiquidationPool.decreasePosition(tstStake1, distributedFees1);
      expect(await TST.balanceOf(user1.address)).to.equal(tstStake1);
      expect(await EUROs.balanceOf(user1.address)).to.equal(distributedFees1);

      // user1 should receive 87.5% of fees when another user decreased position;
      const distributedFees2 = ethers.utils.parseEther('17.5');
      expect(await TST.balanceOf(user2.address)).to.equal(0);
      expect(await EUROs.balanceOf(user2.address)).to.equal(0);
      const position = await LiquidationPool.position(user2.address);
      expect(position.TST).to.equal(tstStake2);
      expect(position.EUROs).to.equal(distributedFees2);
    });

    it('does not allow decreasing beyond position value, even with assets in pool', async () => {
      const tstStake1 = ethers.utils.parseEther('10000');
      await TST.mint(user1.address, tstStake1);
      await TST.approve(LiquidationPool.address, tstStake1);
      await LiquidationPool.increasePosition(tstStake1, 0);

      const tstStake2 = ethers.utils.parseEther('20000');
      await TST.mint(user2.address, tstStake2);
      await TST.connect(user2).approve(LiquidationPool.address, tstStake2);
      await LiquidationPool.connect(user2).increasePosition(tstStake2, 0);

      // user1 can't take out 20000 with only 10000 of their own staked
      await expect(LiquidationPool.decreasePosition(tstStake2, 0)).to.be.revertedWith('invalid-decr-amount');

      const fees = ethers.utils.parseEther('500');
      await expect(LiquidationPool.decreasePosition(0, ethers.utils.parseEther('500'))).to.be.revertedWith('invalid-decr-amount');
    });
  });
});