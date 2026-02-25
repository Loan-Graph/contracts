import { expect } from "chai";
import { deployCore, borrowerHash, loanHash, maturityAfter } from "../helpers";

describe("CreditScoreEngine", function () {
  function toBorrowerTuple(b: any) {
    return [
      b.borrowerId,
      b.totalLoans,
      b.totalRepaid,
      b.totalDefaulted,
      b.cumulativeBorrowed,
      b.cumulativeRepaid,
      b.lastUpdated
    ] as const;
  }

  it("returns 300 for borrowers with no loan history", async function () {
    const { scoreEngine } = await deployCore();
    const score = await scoreEngine.computeScore(borrowerHash("new-borrower"));
    expect(score).to.eq(300n);
  });

  it("increases score with strong repayment behavior", async function () {
    const { loanRegistry, scoreEngine, lender } = await deployCore();
    const bHash = borrowerHash("good-borrower");
    const lHash = loanHash("loan-a");

    await loanRegistry
      .connect(lender)
      .registerLoan(lHash, bHash, 1_000_000n, 2200, await maturityAfter(180), "NGN");

    await loanRegistry.connect(lender).recordRepayment(lHash, 1_000_000n);
    const score = await scoreEngine.computeScore(bHash);

    expect(score).to.be.greaterThanOrEqual(700n);
    expect(score).to.be.lessThanOrEqual(850n);
  });

  it("applies default penalties", async function () {
    const { loanRegistry, scoreEngine, lender } = await deployCore();
    const bHash = borrowerHash("risky-borrower");

    await loanRegistry
      .connect(lender)
      .registerLoan(loanHash("loan-b"), bHash, 1_000_000n, 2200, await maturityAfter(180), "NGN");

    await loanRegistry.connect(lender).markDefault(loanHash("loan-b"));
    const score = await scoreEngine.computeScore(bHash);

    expect(score).to.be.lessThan(500n);
    expect(score).to.be.greaterThanOrEqual(300n);
  });

  it("buildTokenURI reverts if score is out of range", async function () {
    const { scoreEngine, loanRegistry } = await deployCore();
    const b = await loanRegistry.getBorrower(borrowerHash("empty"));
    const borrower = toBorrowerTuple(b);

    await expect(scoreEngine.buildTokenURI(borrower, 299, 1)).to.be.revertedWithCustomError(
      scoreEngine,
      "ScoreOutOfRange"
    );
  });

  it("buildTokenURI returns base64 json payload", async function () {
    const { scoreEngine, loanRegistry } = await deployCore();
    const b = await loanRegistry.getBorrower(borrowerHash("empty-2"));
    const borrower = toBorrowerTuple(b);
    const uri = await scoreEngine.buildTokenURI(borrower, 300, 42);

    expect(uri.startsWith("data:application/json;base64,")).to.eq(true);
  });
});
