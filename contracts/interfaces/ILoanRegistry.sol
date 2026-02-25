// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface ILoanRegistry {
    struct Borrower {
        bytes32 borrowerId;
        uint256 totalLoans;
        uint256 totalRepaid;
        uint256 totalDefaulted;
        uint256 cumulativeBorrowed;
        uint256 cumulativeRepaid;
        uint256 lastUpdated;
    }

    function getBorrower(bytes32 borrowerId) external view returns (Borrower memory);
}
