const { expect } = require("chai");
const { ethers } = require("hardhat");

describe('LiquidationPoolManager', async () => {
  let LiquidationPoolManager, LiquidationPool, TST, EUROs;

  beforeEach(async () => {
    const MockERC20Factory = await ethers.getContractFactory('MockERC20');
    TST = await MockERC20Factory.deploy('The Standard Token', 'TST', 18);
    EUROs = await MockERC20Factory.deploy('The Standard EURO', 'EUROs', 18);
    LiquidationPoolManager = await (await ethers.getContractFactory('LiquidationPoolManager')).deploy(TST.address, EUROs.address);
    LiquidationPool = await ethers.getContractAt('LiquidationPool', await LiquidationPoolManager.pool());
  });

  describe('distributeFees', async () => {
    it('distributes all the accrued EUROs fees in the contract between pool TST holders', async () => {
      const [holder1, holder2, holder3, holder4, holder5] = await ethers.getSigners();
      
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
});