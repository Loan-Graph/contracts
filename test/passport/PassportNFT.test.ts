import { expect } from "chai";
import { deployCore, borrowerHash, loanHash, maturityAfter } from "../helpers";

describe("PassportNFT", function () {
  it("mints one passport per borrower", async function () {
    const { passportNFT, loanRegistry, lender, borrower } = await deployCore();
    const bHash = borrowerHash("borrower-passport");
    const lHash = loanHash("borrower-passport-loan-1");
    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 200_000n, 2200, await maturityAfter(90), "NGN");

    await expect(passportNFT.connect(lender).mintPassport(bHash, borrower.address))
      .to.emit(passportNFT, "PassportMinted")
      .withArgs(bHash, 1n, borrower.address);

    expect(await passportNFT.borrowerToPassportId(bHash)).to.eq(1n);
  });

  it("reverts duplicate mint for same borrower", async function () {
    const { passportNFT, loanRegistry, lender, borrower } = await deployCore();
    const bHash = borrowerHash("borrower-passport-2");
    const lHash = loanHash("borrower-passport-loan-2");
    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 300_000n, 2200, await maturityAfter(90), "NGN");

    await passportNFT.connect(lender).mintPassport(bHash, borrower.address);

    await expect(passportNFT.connect(lender).mintPassport(bHash, borrower.address))
      .to.be.revertedWithCustomError(passportNFT, "PassportAlreadyExists")
      .withArgs(bHash);
  });

  it("reverts transfers because token is soulbound", async function () {
    const { passportNFT, loanRegistry, lender, borrower, other } = await deployCore();
    const bHash = borrowerHash("borrower-passport-3");
    const lHash = loanHash("borrower-passport-loan-3");
    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 300_000n, 2200, await maturityAfter(90), "NGN");

    await passportNFT.connect(lender).mintPassport(bHash, borrower.address);

    await expect(passportNFT.connect(borrower).transferFrom(borrower.address, other.address, 1))
      .to.be.revertedWithCustomError(passportNFT, "SoulboundTransferBlocked");
  });

  it("tokenURI reflects linked score engine output", async function () {
    const { passportNFT, loanRegistry, lender, borrower } = await deployCore();
    const bHash = borrowerHash("borrower-passport-4");
    const lHash = loanHash("loan-passport");

    await loanRegistry.connect(lender).registerLoan(lHash, bHash, 600_000n, 2200, await maturityAfter(90), "NGN");
    await loanRegistry.connect(lender).recordRepayment(lHash, 600_000n);

    await passportNFT.connect(lender).mintPassport(bHash, borrower.address);

    const uri = await passportNFT.tokenURI(1);
    expect(uri.startsWith("data:application/json;base64,")).to.eq(true);
  });

  it("enforces minter role with custom error", async function () {
    const { passportNFT, borrower, other } = await deployCore();
    const minterRole = await passportNFT.MINTER_ROLE();

    await expect(passportNFT.connect(other).mintPassport(borrowerHash("x"), borrower.address))
      .to.be.revertedWithCustomError(passportNFT, "UnauthorizedRole")
      .withArgs(minterRole, other.address);
  });

  it("reverts minting passport for non-existent borrower history", async function () {
    const { passportNFT, lender, borrower } = await deployCore();
    const bHash = borrowerHash("borrower-without-loan");

    await expect(passportNFT.connect(lender).mintPassport(bHash, borrower.address))
      .to.be.revertedWithCustomError(passportNFT, "BorrowerNotFound")
      .withArgs(bHash);
  });
});
