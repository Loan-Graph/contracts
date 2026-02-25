SHELL := /bin/bash

NETWORK ?= creditcoinTestnet

.PHONY: help install clean compile test test-unit test-integration coverage gas typechain deploy deploy-testnet deploy-mainnet

help:
	@echo "Available commands:"
	@echo "  make install            - Install dependencies"
	@echo "  make clean              - Clean Hardhat artifacts/cache"
	@echo "  make compile            - Compile contracts"
	@echo "  make test               - Run all tests"
	@echo "  make test-unit          - Run unit tests"
	@echo "  make test-integration   - Run integration tests"
	@echo "  make coverage           - Run solidity coverage"
	@echo "  make gas                - Run tests with gas reporter"
	@echo "  make typechain          - Generate TypeChain types"
	@echo "  make deploy-testnet     - Deploy to Creditcoin testnet"
	@echo "  make deploy-mainnet     - Deploy to Creditcoin mainnet"
	@echo "  make deploy NETWORK=<network> - Deploy to selected network"

install:
	npm install

clean:
	npm run clean

compile:
	npm run compile

test:
	npm test

test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

coverage:
	npm run coverage

gas:
	npm run gas

typechain:
	npm run typechain

deploy:
	npx hardhat run scripts/deploy.ts --network $(NETWORK)

deploy-testnet:
	npm run deploy:testnet

deploy-mainnet:
	npm run deploy:mainnet
