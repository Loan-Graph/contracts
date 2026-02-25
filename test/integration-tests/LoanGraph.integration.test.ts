import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { deployCore, borrowerHash, loanHash, maturityAfter } from "../helpers";

describe("LoanGraph Integration", function () {
  it("runs full lifecycle: loan registration -> passport mint -> repayment -> score update", async function () {
    const { loanRegistry, scoreEngine, passportNFT, lender, borrower } = await deployCore();

    const bHash = borrowerHash("integration-borrower-1");
    const lHash = loanHash("integration-loan-1");

    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 1_200_000n, 2200, await maturityAfter(180), "NGN");
    await passportNFT.connect(lender).mintPassport(bHash, borrower.address);

    const scoreBefore = await scoreEngine.computeScore(bHash);
    expect(scoreBefore).to.be.greaterThanOrEqual(400n);

    await loanRegistry.connect(lender).recordRepayment(lHash, 1_200_000n);

    const scoreAfter = await scoreEngine.computeScore(bHash);
    expect(scoreAfter).to.be.greaterThanOrEqual(scoreBefore);

    const uri = await passportNFT.tokenURI(1);
    expect(uri.startsWith("data:application/json;base64,")).to.eq(true);
  });

  it("default flow degrades score", async function () {
    const { loanRegistry, scoreEngine, lender } = await deployCore();

    const bHash = borrowerHash("integration-borrower-2");
    const lHash = loanHash("integration-loan-2");

    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 500_000n, 2200, await maturityAfter(90), "NGN");

    const scoreBeforeDefault = await scoreEngine.computeScore(bHash);
    await loanRegistry.connect(lender).markDefault(lHash);
    const scoreAfterDefault = await scoreEngine.computeScore(bHash);

    expect(scoreAfterDefault).to.be.lessThan(scoreBeforeDefault);
  });

  it("supports UUPS upgrade while preserving state for LoanRegistry", async function () {
    const { loanRegistry, lender } = await deployCore();

    const bHash = borrowerHash("integration-borrower-3");
    const lHash = loanHash("integration-loan-3");

    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 700_000n, 2200, await maturityAfter(120), "USD");

    const LoanRegistryV2 = await ethers.getContractFactory("LoanRegistryV2");
    const upgradedProxy = await upgrades.upgradeProxy(await loanRegistry.getAddress(), LoanRegistryV2);
    const upgraded = await ethers.getContractAt("LoanRegistryV2", await upgradedProxy.getAddress());

    const loan = await upgraded.loans(lHash);
    expect(loan.principal).to.eq(700_000n);
    expect(await upgraded.version()).to.eq(2n);
  });

  it("supports UUPS upgrade for PoolToken and keeps balances", async function () {
    const { poolToken, manager, investor } = await deployCore();

    await poolToken.connect(manager).mint(investor.address, 999n);

    const PoolTokenV2 = await ethers.getContractFactory("PoolTokenV2");
    const upgradedProxy = await upgrades.upgradeProxy(await poolToken.getAddress(), PoolTokenV2);
    const upgraded = await ethers.getContractAt("PoolTokenV2", await upgradedProxy.getAddress());

    expect(await upgraded.balanceOf(investor.address)).to.eq(999n);
    expect(await upgraded.version()).to.eq(2n);
  });
});
