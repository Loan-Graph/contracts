// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

abstract contract Errors {
    error UnauthorizedRole(bytes32 role, address account);
    error InvalidAddress();
    error InvalidAmount();
    error InvalidMaturity();
    error InvalidCurrencyCode();
    error InvalidLoan();
    error LoanAlreadyExists(bytes32 loanId);
    error LoanNotFound(bytes32 loanId);
    error LoanNotActive(bytes32 loanId);
    error LoanAlreadyDefaulted(bytes32 loanId);
    error LoanAlreadyRepaid(bytes32 loanId);
    error UnauthorizedLenderForLoan(bytes32 loanId, address caller, address owner);
    error RepaymentExceedsOutstanding(bytes32 loanId, uint256 attempted, uint256 outstanding);
    error BorrowerNotFound(bytes32 borrowerId);
    error PassportAlreadyExists(bytes32 borrowerId);
    error PassportNotFound(uint256 tokenId);
    error InvalidRecipient();
    error SoulboundTransferBlocked();
    error ScoreOutOfRange(uint256 score);
    error PoolClosed();
    error PoolStatusUnchanged();
    error ZeroValueNotAllowed();
    error ContractPaused();
    error ContractNotPaused();
}
