// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Errors} from "./lib/Errors.sol";
import {ILoanRegistry} from "./interfaces/ILoanRegistry.sol";

contract CreditScoreEngine is Initializable, AccessControlUpgradeable, UUPSUpgradeable, Errors {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    ILoanRegistry public loanRegistry;

    modifier onlyRoleCustom(bytes32 role) {
        if (!hasRole(role, msg.sender)) revert UnauthorizedRole(role, msg.sender);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address loanRegistryAddress) public initializer {
        if (admin == address(0) || loanRegistryAddress == address(0)) revert InvalidAddress();

        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        loanRegistry = ILoanRegistry(loanRegistryAddress);
    }

    function computeScore(bytes32 borrowerId) public view returns (uint256 score) {
        ILoanRegistry.Borrower memory b = loanRegistry.getBorrower(borrowerId);
        if (b.cumulativeBorrowed == 0) return 300;

        uint256 repaymentRatio = (b.cumulativeRepaid * 1e18) / b.cumulativeBorrowed;
        uint256 repayScore = (repaymentRatio * 300) / 1e18;

        uint256 volumeFactor = 0;
        uint256 volume = b.cumulativeBorrowed / 1e6;
        if (volume > 1) {
            volumeFactor = _log2(volume) * 20;
            if (volumeFactor > 150) {
                volumeFactor = 150;
            }
        }

        uint256 defaultPenalty = b.totalDefaulted * 50;
        uint256 raw = 400 + repayScore + volumeFactor;

        score = raw > defaultPenalty ? raw - defaultPenalty : 300;
        if (score > 850) score = 850;
        if (score < 300) score = 300;
    }

    function buildTokenURI(
        ILoanRegistry.Borrower memory b,
        uint256 score,
        uint256 tokenId
    ) external pure returns (string memory) {
        if (score < 300 || score > 850) revert ScoreOutOfRange(score);

        string memory attrs = string(
            abi.encodePacked(
                '[{"trait_type":"Credit Score","value":', Strings.toString(score), '},',
                '{"trait_type":"Total Loans","value":', Strings.toString(b.totalLoans), '},',
                '{"trait_type":"Total Repaid","value":', Strings.toString(b.totalRepaid), '},',
                '{"trait_type":"Total Defaulted","value":', Strings.toString(b.totalDefaulted), '},',
                '{"trait_type":"Cumulative Borrowed","value":', Strings.toString(b.cumulativeBorrowed), '},',
                '{"trait_type":"Cumulative Repaid","value":', Strings.toString(b.cumulativeRepaid), '}'
                ']'
            )
        );

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"LoanGraph SME Passport #',
                        Strings.toString(tokenId),
                        '","description":"Dynamic on-chain credit identity for emerging market SMEs.",',
                        '"attributes":',
                        attrs,
                        '}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _log2(uint256 x) internal pure returns (uint256 y) {
        while (x > 1) {
            x >>= 1;
            y++;
        }
    }

    function _authorizeUpgrade(address) internal override onlyRoleCustom(UPGRADER_ROLE) {}
}
