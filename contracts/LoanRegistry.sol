// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Errors} from "./lib/Errors.sol";
import {Events} from "./lib/Events.sol";
import {ILoanRegistry} from "./interfaces/ILoanRegistry.sol";

contract LoanRegistry is Initializable, AccessControlUpgradeable, UUPSUpgradeable, Errors, Events, ILoanRegistry {
    bytes32 public constant LENDER_ROLE = keccak256("LENDER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    enum LoanStatus {
        Active,
        Repaid,
        Defaulted
    }

    struct Loan {
        bytes32 loanId;
        bytes32 borrowerId;
        address lender;
        uint256 principal;
        uint256 interestRateBps;
        uint256 startDate;
        uint256 maturityDate;
        uint256 amountRepaid;
        LoanStatus status;
        string currencyCode;
    }

    mapping(bytes32 => Loan) public loans;
    mapping(bytes32 => Borrower) private borrowers;
    bytes32[] public allLoanIds;
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

    function initialize(address admin) public initializer {
        if (admin == address(0)) revert InvalidAddress();

        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
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

    function registerLoan(
        bytes32 loanId,
        bytes32 borrowerId,
        uint256 principal,
        uint256 interestRateBps,
        uint256 maturityDate,
        string calldata currencyCode
    ) external onlyRoleCustom(LENDER_ROLE) whenNotPaused {
        if (loanId == bytes32(0) || borrowerId == bytes32(0)) revert InvalidLoan();
        if (principal == 0 || interestRateBps == 0) revert InvalidAmount();
        if (maturityDate <= block.timestamp) revert InvalidMaturity();
        if (bytes(currencyCode).length != 3) revert InvalidCurrencyCode();
        if (loans[loanId].loanId != bytes32(0)) revert LoanAlreadyExists(loanId);

        loans[loanId] = Loan({
            loanId: loanId,
            borrowerId: borrowerId,
            lender: msg.sender,
            principal: principal,
            interestRateBps: interestRateBps,
            startDate: block.timestamp,
            maturityDate: maturityDate,
            amountRepaid: 0,
            status: LoanStatus.Active,
            currencyCode: currencyCode
        });

        allLoanIds.push(loanId);
        _updateBorrowerOnLoan(borrowerId, principal);

        emit LoanRegistered(loanId, borrowerId, msg.sender, principal, maturityDate, currencyCode);
    }

    function recordRepayment(bytes32 loanId, uint256 amount) external onlyRoleCustom(LENDER_ROLE) whenNotPaused {
        if (amount == 0) revert ZeroValueNotAllowed();

        Loan storage loan = loans[loanId];
        if (loan.loanId == bytes32(0)) revert LoanNotFound(loanId);
        if (loan.lender != msg.sender) revert UnauthorizedLenderForLoan(loanId, msg.sender, loan.lender);
        if (loan.status == LoanStatus.Repaid) revert LoanAlreadyRepaid(loanId);
        if (loan.status == LoanStatus.Defaulted) revert LoanAlreadyDefaulted(loanId);
        uint256 outstanding = loan.principal - loan.amountRepaid;
        if (amount > outstanding) revert RepaymentExceedsOutstanding(loanId, amount, outstanding);

        loan.amountRepaid += amount;

        Borrower storage b = borrowers[loan.borrowerId];
        b.cumulativeRepaid += amount;
        b.lastUpdated = block.timestamp;

        if (loan.amountRepaid >= loan.principal) {
            loan.status = LoanStatus.Repaid;
            b.totalRepaid += 1;
        }

        emit RepaymentRecorded(loanId, loan.borrowerId, amount, loan.amountRepaid, block.timestamp);
    }

    function markDefault(bytes32 loanId) external onlyRoleCustom(LENDER_ROLE) whenNotPaused {
        Loan storage loan = loans[loanId];
        if (loan.loanId == bytes32(0)) revert LoanNotFound(loanId);
        if (loan.lender != msg.sender) revert UnauthorizedLenderForLoan(loanId, msg.sender, loan.lender);
        if (loan.status == LoanStatus.Repaid) revert LoanAlreadyRepaid(loanId);
        if (loan.status == LoanStatus.Defaulted) revert LoanAlreadyDefaulted(loanId);

        loan.status = LoanStatus.Defaulted;

        Borrower storage b = borrowers[loan.borrowerId];
        b.totalDefaulted += 1;
        b.lastUpdated = block.timestamp;

        emit LoanDefaulted(loanId, loan.borrowerId, block.timestamp);
    }

    function getBorrower(bytes32 borrowerId) external view returns (Borrower memory) {
        return borrowers[borrowerId];
    }

    function getLoanCount() external view returns (uint256) {
        return allLoanIds.length;
    }

    function _updateBorrowerOnLoan(bytes32 borrowerId, uint256 principal) internal {
        Borrower storage b = borrowers[borrowerId];
        if (b.borrowerId == bytes32(0)) {
            b.borrowerId = borrowerId;
        }
        b.totalLoans += 1;
        b.cumulativeBorrowed += principal;
        b.lastUpdated = block.timestamp;
    }

    function _authorizeUpgrade(address) internal override onlyRoleCustom(UPGRADER_ROLE) {}
}
