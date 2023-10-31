// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "contracts/interfaces/ILiquidationPool.sol";
import "contracts/interfaces/ILiquidationPoolManager.sol";

import "hardhat/console.sol";

contract LiquidationPool is ILiquidationPool {
    using SafeERC20 for IERC20;

    address private immutable TST;
    address private immutable EUROs;

    Position[] private positions;
    address public manager;

    struct Position { uint256 TST; uint256 EUROs; address addr; }

    constructor(address _TST, address _EUROs) {
        TST = _TST;
        EUROs = _EUROs;
        manager = msg.sender;
    }

    modifier onlyManager {
        require(msg.sender == manager, "err-invalid-user");
        _;
    }

    function stake(Position memory _position) private pure returns (uint256) {
        return _position.TST > _position.EUROs ? _position.EUROs : _position.TST;
    }

    function stakeTotals() private view returns (uint256 _tst, uint256 _euros, uint256 _stakes) {
        for (uint256 i = 0; i < positions.length; i++) {
            Position memory _position = positions[i];
            _tst += _position.TST;
            _euros += _position.EUROs;
            _stakes += stake(_position);
        }
    }

    function findPosition(address _holder) private view returns (Position memory, uint256) {
        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i].addr == _holder) return (positions[i], i);
        }
    }
    
    function position(address _holder) external view returns(Position memory _position) {
        (_position,) = findPosition(_holder);
        (uint256 tstTotal,,) = stakeTotals();
        if (_position.TST > 0) _position.EUROs += IERC20(EUROs).balanceOf(manager) * _position.TST / tstTotal;
    }

    function empty(Position memory _position) private view returns (bool) {
        return _position.TST == 0 && _position.EUROs == 0;
    }

    function deletePosition(uint256 _index) private {
        positions[_index] = positions[positions.length - 1];
        positions.pop();
    }

    function savePosition(Position memory _position, uint256 _index) private {
        if (empty(_position)) {
            deletePosition(_index);
        } else if (_position.addr == address(0)) {
            _position.addr = msg.sender;
            positions.push(_position);
        } else {
            positions[_index] = _position;
        }
    }

    function increasePosition(uint256 _tstVal, uint256 _eurosVal) external {
        ILiquidationPoolManager(manager).distributeFees();

        (Position memory _position, uint256 _index) = findPosition(msg.sender);

        if (_tstVal > 0) {
            IERC20(TST).safeTransferFrom(msg.sender, address(this), _tstVal);
            _position.TST += _tstVal;
        }

        if (_eurosVal > 0) {
            IERC20(EUROs).safeTransferFrom(msg.sender, address(this), _eurosVal);
            _position.EUROs += _eurosVal;
        }

        savePosition(_position, _index);
    }

    function decreasePosition(uint256 _tstVal, uint256 _eurosVal) external {
        ILiquidationPoolManager(manager).distributeFees();

        (Position memory _position, uint256 _index) = findPosition(msg.sender);
        require(_tstVal <= _position.TST && _eurosVal <= _position.EUROs, "invalid-decr-amount");

        if (_tstVal > 0 && _tstVal <= _position.TST) {
            IERC20(TST).safeTransfer(msg.sender, _tstVal);
            _position.TST -= _tstVal;
        }

        if (_eurosVal > 0 && _eurosVal <= _position.EUROs) {
            IERC20(EUROs).safeTransfer(msg.sender, _eurosVal);
            _position.EUROs -= _eurosVal;
        }

        savePosition(_position, _index);
    }

    function distributeFees(uint256 _amount) external onlyManager {
        (uint256 tstTotal,,) = stakeTotals();
        if (tstTotal > 0) {
            IERC20(EUROs).safeTransferFrom(msg.sender, address(this), _amount);
            for (uint256 i = 0; i < positions.length; i++) {
                Position memory _position = positions[i];
                _position.EUROs += _amount * _position.TST / tstTotal;
                savePosition(_position, i);
            }
        }
    }
}
