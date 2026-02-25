// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {LoanRegistry} from "../LoanRegistry.sol";

contract LoanRegistryV2 is LoanRegistry {
    function version() external pure returns (uint256) {
        return 2;
    }
}
