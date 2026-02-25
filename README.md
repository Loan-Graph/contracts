# LoanGraph Contracts (Hardhat v2)

## Stack
- Hardhat v2 + TypeScript
- OpenZeppelin Upgradeable (UUPS)
- Solidity 0.8.22

## Setup
1. Copy env:
   - `cp .env.example .env`
2. Install:
   - `npm install`
3. Compile:
   - `npm run compile`

## Test Commands
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- All tests: `npm test`
- Coverage: `npm run coverage`
- Gas report: `npm run gas`

## Deploy
- Testnet: `npm run deploy:testnet`
- Mainnet: `npm run deploy:mainnet`
- Makefile wrapper:
  - `make deploy-testnet`
  - `make deploy-mainnet`
  - `make deploy NETWORK=creditcoinTestnet`

Deployments are stored in:
- `deployments/addresses.json` (auto-updated by `scripts/deploy.ts`)

Set these `.env` fields before deploying:
- `DEPLOYER_PRIVATE_KEY`
- `UPGRADER_PRIVATE_KEY`
- `ADMIN_ADDRESS`
- `CREDITCOIN_TESTNET_RPC`
- `CREDITCOIN_MAINNET_RPC`

## Contract Layout
- `contracts/lib/Errors.sol`: all custom errors
- `contracts/lib/Events.sol`: all shared events
- `contracts/LoanRegistry.sol`
- `contracts/CreditScoreEngine.sol`
- `contracts/PassportNFT.sol`
- `contracts/PoolToken.sol`
- `deployments/addresses.json`: deployed proxy addresses by network
- `Makefile`: command shortcuts for compile/test/deploy flows
