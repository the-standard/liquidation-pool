const { expect } = require("chai");
const { ethers } = require("hardhat");

describe('LiquidationPool', async () => {
  let user1, user2, user3, MockERC20Factory, LiquidationPoolManager, LiquidationPool, TST, EUROs;

  beforeEach(async () => {
    [ user1, user2, user3 ] = await ethers.getSigners();
    MockERC20Factory = await ethers.getContractFactory('MockERC20');
    TST = await MockERC20Factory.deploy('The Standard Token', 'TST', 18);
    EUROs = await MockERC20Factory.deploy('The Standard EURO', 'EUROs', 18);
    LiquidationPoolManager = await (await ethers.getContractFactory('LiquidationPoolManager')).deploy(TST.address, EUROs.address);
    LiquidationPool = await ethers.getContractAt('LiquidationPool', await LiquidationPoolManager.pool());
  });

  describe('position', async () => {
    it('provides the position data for given user', async () => {
      const position = await LiquidationPool.position(user.address);

      expect(position.TST).to.equal('0');
      expect(position.EUROs).to.equal('0');
    });

    it('includes unclaimed EUROs fees if due???', async () => {
      const tstVal = ethers.utils.parseEther('1000');
      const fees = ethers.utils.parseEther('100');

      await TST.mint(user.address, tstVal);
      await TST.approve(LiquidationPool.address, tstVal);
      await LiquidationPool.increasePosition(tstVal, 0);
      await EUROs.mint(LiquidationPoolManager.address, fees);

      const position = await LiquidationPool.position(user.address);
      expect(position.TST).to.equal(tstVal);
      expect(position.EUROs).to.equal(fees);
    });
  });

  describe('increase position', async () => {
    it('allows increasing position by one or both assets', async () => {
      const balance = ethers.utils.parseEther('5000');
      const tstVal = ethers.utils.parseEther('1000');
      const eurosVal = ethers.utils.parseEther('500');

      await TST.mint(user.address, balance);
      await EUROs.mint(user.address, balance);
      
      let increase = LiquidationPool.increasePosition(tstVal, eurosVal);
      await expect(increase).to.be.revertedWithCustomError(MockERC20Factory, 'ERC20InsufficientAllowance')

      let position = await LiquidationPool.position(user.address);
      expect(position.TST).to.equal('0');
      expect(position.EUROs).to.equal('0');

      await TST.approve(LiquidationPool.address, tstVal);
      await EUROs.approve(LiquidationPool.address, eurosVal);

      increase = LiquidationPool.increasePosition(tstVal, eurosVal);
      await expect(increase).not.to.be.reverted;

      position = await LiquidationPool.position(user.address);
      expect(position.TST).to.equal(tstVal);
      expect(position.EUROs).to.equal(eurosVal);

      await TST.approve(LiquidationPool.address, tstVal);
      increase = LiquidationPool.increasePosition(tstVal, 0);
      await expect(increase).not.to.be.reverted;

      position = await LiquidationPool.position(user.address);
      expect(position.TST).to.equal(tstVal.mul(2));
      expect(position.EUROs).to.equal(eurosVal);

      await EUROs.approve(LiquidationPool.address, eurosVal);
      increase = LiquidationPool.increasePosition(0, eurosVal);
      await expect(increase).not.to.be.reverted;

      position = await LiquidationPool.position(user.address);
      expect(position.TST).to.equal(tstVal.mul(2));
      expect(position.EUROs).to.equal(eurosVal.mul(2));
    });

    it.only('triggers a distribution of fees before increasing position', async () => {
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
      console.log(position)

      // received 90 EUROs in first round
      // now has 45% of pool (90000 from 200000)
      // 90 + 45 = 135 EUROs
      position = await LiquidationPool.position(user2.address);
      expect(position.EUROs).to.equal(ethers.utils.parseEther('135'));
      console.log(position)

      // should receive 50% of second round of fees
      // = 50% of 100 = 50 EUROs
      position = await LiquidationPool.position(user3.address);
      expect(position.EUROs).to.equal(ethers.utils.parseEther('50'));
      console.log(position)
    });
  });

  describe('decrease position', async () => {
    it('allows decreasing position by one or both assets', async () => {
      const balance = ethers.utils.parseEther('10000');
      await TST.mint(user.address, balance);
      await EUROs.mint(user.address, balance);

      await TST.approve(LiquidationPool.address, balance);
      await EUROs.approve(LiquidationPool.address, balance);

      await LiquidationPool.increasePosition(balance, balance);

      expect(await TST.balanceOf(user.address)).to.equal(0);
      expect(await EUROs.balanceOf(user.address)).to.equal(0);

      const decreaseValue = balance.div(2);
      await LiquidationPool.decreasePosition(decreaseValue, decreaseValue);

      let position = await LiquidationPool.position(user.address);
      expect(position.TST).to.equal(balance.sub(decreaseValue));
      expect(position.EUROs).to.equal(balance.sub(decreaseValue));

      expect(await TST.balanceOf(user.address)).to.equal(decreaseValue);
      expect(await EUROs.balanceOf(user.address)).to.equal(decreaseValue);

      await LiquidationPool.decreasePosition(decreaseValue, 0);

      position = await LiquidationPool.position(user.address);
      expect(position.TST).to.equal(0);
      expect(position.EUROs).to.equal(balance.sub(decreaseValue));

      expect(await TST.balanceOf(user.address)).to.equal(balance);
      expect(await EUROs.balanceOf(user.address)).to.equal(decreaseValue);

      await LiquidationPool.decreasePosition(0, decreaseValue);

      position = await LiquidationPool.position(user.address);
      expect(position.TST).to.equal(0);
      expect(position.EUROs).to.equal(0);

      expect(await TST.balanceOf(user.address)).to.equal(balance);
      expect(await EUROs.balanceOf(user.address)).to.equal(balance);
    });

    xit('triggers a distribution of fees before decreasing position', async () => {

    });
  });
});