// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {Errors} from "./lib/Errors.sol";
import {Events} from "./lib/Events.sol";

contract PoolToken is Initializable, ERC20Upgradeable, AccessControlUpgradeable, UUPSUpgradeable, Errors, Events {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    bool public poolOpen;
    bool public paused;

    modifier onlyRoleCustom(bytes32 role) {
        if (!hasRole(role, msg.sender)) revert UnauthorizedRole(role, msg.sender);
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, string calldata name_, string calldata symbol_) public initializer {
        if (admin == address(0)) revert InvalidAddress();

        __ERC20_init(name_, symbol_);
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        poolOpen = true;
        emit PoolStatusChanged(true);
    }

    function setPoolOpen(bool open) external onlyRoleCustom(ADMIN_ROLE) {
        if (poolOpen == open) revert PoolStatusUnchanged();
        poolOpen = open;
        emit PoolStatusChanged(open);
    }

    function pause() external onlyRoleCustom(ADMIN_ROLE) {
        if (paused) revert ContractPaused();
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyRoleCustom(ADMIN_ROLE) {
        if (!paused) revert ContractNotPaused();
        paused = false;
        emit Unpaused(msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRoleCustom(MANAGER_ROLE) whenNotPaused {
        if (!poolOpen) revert PoolClosed();
        if (to == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        _mint(to, amount);
        emit PoolMint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRoleCustom(MANAGER_ROLE) whenNotPaused {
        if (from == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (from != msg.sender) {
            uint256 allowed = allowance(from, msg.sender);
            if (allowed < amount) revert BurnAllowanceExceeded(from, msg.sender, allowed, amount);
            _approve(from, msg.sender, allowed - amount);
        }

        _burn(from, amount);
        emit PoolBurn(from, amount);
    }

    function _authorizeUpgrade(address) internal override onlyRoleCustom(UPGRADER_ROLE) {}
}
