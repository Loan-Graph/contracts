// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {Errors} from "./lib/Errors.sol";
import {Events} from "./lib/Events.sol";
import {ILoanRegistry} from "./interfaces/ILoanRegistry.sol";
import {ICreditScoreEngine} from "./interfaces/ICreditScoreEngine.sol";

contract PassportNFT is Initializable, ERC721Upgradeable, AccessControlUpgradeable, UUPSUpgradeable, Errors, Events {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    ILoanRegistry public loanRegistry;
    ICreditScoreEngine public scoreEngine;

    uint256 private tokenIdCounter;
    mapping(bytes32 => uint256) public borrowerToPassportId;
    mapping(uint256 => bytes32) public passportToBorrower;

    modifier onlyRoleCustom(bytes32 role) {
        if (!hasRole(role, msg.sender)) revert UnauthorizedRole(role, msg.sender);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address loanRegistryAddress, address scoreEngineAddress) public initializer {
        if (admin == address(0) || loanRegistryAddress == address(0) || scoreEngineAddress == address(0)) {
            revert InvalidAddress();
        }

        __ERC721_init("LoanGraph SME Passport", "LGPASS");
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        loanRegistry = ILoanRegistry(loanRegistryAddress);
        scoreEngine = ICreditScoreEngine(scoreEngineAddress);
    }

    function mintPassport(bytes32 borrowerId, address recipient) external onlyRoleCustom(MINTER_ROLE) returns (uint256) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (borrowerToPassportId[borrowerId] != 0) revert PassportAlreadyExists(borrowerId);

        tokenIdCounter += 1;
        uint256 tokenId = tokenIdCounter;

        _safeMint(recipient, tokenId);
        borrowerToPassportId[borrowerId] = tokenId;
        passportToBorrower[tokenId] = borrowerId;

        emit PassportMinted(borrowerId, tokenId, recipient);
        emit BorrowerLinkedToPassport(borrowerId, tokenId);

        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert PassportNotFound(tokenId);

        bytes32 borrowerId = passportToBorrower[tokenId];
        ILoanRegistry.Borrower memory b = loanRegistry.getBorrower(borrowerId);
        uint256 score = scoreEngine.computeScore(borrowerId);

        return scoreEngine.buildTokenURI(b, score, tokenId);
    }

    function totalMinted() external view returns (uint256) {
        return tokenIdCounter;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal override {
        if (from != address(0) && to != address(0)) revert SoulboundTransferBlocked();
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function _authorizeUpgrade(address) internal override onlyRoleCustom(UPGRADER_ROLE) {}
}
