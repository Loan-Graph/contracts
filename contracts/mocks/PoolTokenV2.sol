// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {PoolToken} from "../PoolToken.sol";

contract PoolTokenV2 is PoolToken {
    function version() external pure returns (uint256) {
        return 2;
    }
}
