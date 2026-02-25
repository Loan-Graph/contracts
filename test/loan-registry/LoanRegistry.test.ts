import { expect } from "chai";
import { deployCore, borrowerHash, loanHash, maturityAfter } from "../helpers";

describe("LoanRegistry", function () {
  it("registers a valid loan and updates borrower aggregates", async function () {
    const { loanRegistry, lender } = await deployCore();

    const bHash = borrowerHash("borrower-1");
    const lHash = loanHash("loan-1");
    const maturity = await maturityAfter(180);

    await expect(
      loanRegistry.connect(lender).registerLoan(lHash, bHash, 500_000n, 2200, maturity, "NGN")
    )
      .to.emit(loanRegistry, "LoanRegistered")
      .withArgs(lHash, bHash, lender.address, 500_000n, maturity, "NGN");

    const borrower = await loanRegistry.getBorrower(bHash);
    expect(borrower.totalLoans).to.eq(1n);
    expect(borrower.cumulativeBorrowed).to.eq(500_000n);
  });

  it("reverts for duplicate loan id", async function () {
    const { loanRegistry, lender } = await deployCore();
    const bHash = borrowerHash("borrower-1");
    const lHash = loanHash("loan-1");
    const maturity = await maturityAfter(180);

    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 500_000n, 2200, maturity, "NGN");

    await expect(
      loanRegistry.connect(lender).registerLoan(lHash, bHash, 500_000n, 2200, maturity, "NGN")
    )
      .to.be.revertedWithCustomError(loanRegistry, "LoanAlreadyExists")
      .withArgs(lHash);
  });

  it("reverts on invalid currency and maturity", async function () {
    const { loanRegistry, lender } = await deployCore();
    const bHash = borrowerHash("borrower-2");
    const lHash = loanHash("loan-2");
    const past = 1n;

    await expect(
      loanRegistry.connect(lender).registerLoan(lHash, bHash, 500_000n, 2200, past, "NGN")
    ).to.be.revertedWithCustomError(loanRegistry, "InvalidMaturity");

    const maturity = await maturityAfter(30);

    await expect(
      loanRegistry.connect(lender).registerLoan(lHash, bHash, 500_000n, 2200, maturity, "N")
    ).to.be.revertedWithCustomError(loanRegistry, "InvalidCurrencyCode");
  });

  it("records repayments and closes loan when principal reached", async function () {
    const { loanRegistry, lender } = await deployCore();
    const bHash = borrowerHash("borrower-3");
    const lHash = loanHash("loan-3");
    const maturity = await maturityAfter(90);

    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 1_000_000n, 2200, maturity, "NGN");

    await expect(loanRegistry.connect(lender).recordRepayment(lHash, 400_000n))
      .to.emit(loanRegistry, "RepaymentRecorded");

    await loanRegistry.connect(lender).recordRepayment(lHash, 600_000n);

    const loan = await loanRegistry.loans(lHash);
    expect(loan.status).to.eq(1n); // Repaid

    const borrower = await loanRegistry.getBorrower(bHash);
    expect(borrower.totalRepaid).to.eq(1n);
    expect(borrower.cumulativeRepaid).to.eq(1_000_000n);
  });

  it("marks default and tracks default count", async function () {
    const { loanRegistry, lender } = await deployCore();
    const bHash = borrowerHash("borrower-4");
    const lHash = loanHash("loan-4");
    const maturity = await maturityAfter(90);

    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 100_000n, 2200, maturity, "KES");

    await expect(loanRegistry.connect(lender).markDefault(lHash)).to.emit(loanRegistry, "LoanDefaulted");

    const loan = await loanRegistry.loans(lHash);
    expect(loan.status).to.eq(2n); // Defaulted

    const borrower = await loanRegistry.getBorrower(bHash);
    expect(borrower.totalDefaulted).to.eq(1n);
  });

  it("enforces role checks with custom errors", async function () {
    const { loanRegistry, other } = await deployCore();
    const bHash = borrowerHash("borrower-5");
    const lHash = loanHash("loan-5");
    const maturity = await maturityAfter(90);
    const lenderRole = await loanRegistry.LENDER_ROLE();

    await expect(
      loanRegistry.connect(other).registerLoan(lHash, bHash, 100_000n, 2200, maturity, "USD")
    )
      .to.be.revertedWithCustomError(loanRegistry, "UnauthorizedRole")
      .withArgs(lenderRole, other.address);
  });

  it("pauses and blocks state-changing actions while paused", async function () {
    const { loanRegistry, lender, admin } = await deployCore();
    const bHash = borrowerHash("borrower-6");
    const lHash = loanHash("loan-6");
    const maturity = await maturityAfter(90);

    await loanRegistry.connect(admin).pause();

    await expect(
      loanRegistry.connect(lender).registerLoan(lHash, bHash, 100_000n, 2200, maturity, "USD")
    ).to.be.revertedWithCustomError(loanRegistry, "ContractPaused");
  });

  it("prevents another lender from mutating someone else's loan", async function () {
    const { loanRegistry, lender, other } = await deployCore();
    const lenderRole = await loanRegistry.LENDER_ROLE();
    await loanRegistry.grantRole(lenderRole, other.address);

    const bHash = borrowerHash("borrower-7");
    const lHash = loanHash("loan-7");
    const maturity = await maturityAfter(90);

    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 300_000n, 2200, maturity, "USD");

    await expect(loanRegistry.connect(other).recordRepayment(lHash, 10_000n))
      .to.be.revertedWithCustomError(loanRegistry, "UnauthorizedLenderForLoan")
      .withArgs(lHash, other.address, lender.address);

    await expect(loanRegistry.connect(other).markDefault(lHash))
      .to.be.revertedWithCustomError(loanRegistry, "UnauthorizedLenderForLoan")
      .withArgs(lHash, other.address, lender.address);
  });

  it("reverts when repayment exceeds outstanding principal", async function () {
    const { loanRegistry, lender } = await deployCore();
    const bHash = borrowerHash("borrower-8");
    const lHash = loanHash("loan-8");
    const maturity = await maturityAfter(90);

    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 100_000n, 2200, maturity, "USD");
    await loanRegistry.connect(lender).recordRepayment(lHash, 40_000n);

    await expect(loanRegistry.connect(lender).recordRepayment(lHash, 70_000n))
      .to.be.revertedWithCustomError(loanRegistry, "RepaymentExceedsOutstanding")
      .withArgs(lHash, 70_000n, 60_000n);
  });
});
