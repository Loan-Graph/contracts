// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

abstract contract Events {
    event LoanRegistered(
        bytes32 indexed loanId,
        bytes32 indexed borrowerId,
        address indexed lender,
        uint256 principal,
        uint256 maturityDate,
        string currencyCode
    );

    event RepaymentRecorded(
        bytes32 indexed loanId,
        bytes32 indexed borrowerId,
        uint256 amount,
        uint256 totalRepaid,
        uint256 timestamp
    );

    event LoanDefaulted(
        bytes32 indexed loanId,
        bytes32 indexed borrowerId,
        uint256 timestamp
    );

    event PassportMinted(bytes32 indexed borrowerId, uint256 indexed tokenId, address indexed recipient);

    event PoolStatusChanged(bool isOpen);
    event PoolMint(address indexed to, uint256 amount);
    event PoolBurn(address indexed from, uint256 amount);
    event BorrowerLinkedToPassport(bytes32 indexed borrowerId, uint256 indexed tokenId);
}
