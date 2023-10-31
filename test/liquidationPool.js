const { expect } = require("chai");
const { ethers } = require("hardhat");

describe('LiquidationPool', async () => {
  let user, MockERC20Factory, LiquidationPoolManager, LiquidationPool, TST, EUROs;

  beforeEach(async () => {
    [ user ] = await ethers.getSigners();
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

    xit('triggers a distribution of fees before increasing position', async () => {

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