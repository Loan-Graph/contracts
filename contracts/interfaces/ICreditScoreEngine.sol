// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ILoanRegistry} from "./ILoanRegistry.sol";

interface ICreditScoreEngine {
    function computeScore(bytes32 borrowerId) external view returns (uint256 score);

    function buildTokenURI(
        ILoanRegistry.Borrower memory b,
        uint256 score,
        uint256 tokenId
    ) external pure returns (string memory);
}
