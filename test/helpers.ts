import { ethers, upgrades } from "hardhat";

export async function deployCore() {
  const [admin, lender, manager, borrower, investor, other] = await ethers.getSigners();

  const LoanRegistry = await ethers.getContractFactory("LoanRegistry");
  const loanRegistry = await upgrades.deployProxy(LoanRegistry, [admin.address], {
    kind: "uups",
    initializer: "initialize"
  });
  await loanRegistry.waitForDeployment();

  const CreditScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
  const scoreEngine = await upgrades.deployProxy(
    CreditScoreEngine,
    [admin.address, await loanRegistry.getAddress()],
    {
      kind: "uups",
      initializer: "initialize"
    }
  );
  await scoreEngine.waitForDeployment();

  const PassportNFT = await ethers.getContractFactory("PassportNFT");
  const passportNFT = await upgrades.deployProxy(
    PassportNFT,
    [admin.address, await loanRegistry.getAddress(), await scoreEngine.getAddress()],
    {
      kind: "uups",
      initializer: "initialize"
    }
  );
  await passportNFT.waitForDeployment();

  const PoolToken = await ethers.getContractFactory("PoolToken");
  const poolToken = await upgrades.deployProxy(PoolToken, [admin.address, "LoanGraph Pool", "LGP"], {
    kind: "uups",
    initializer: "initialize"
  });
  await poolToken.waitForDeployment();

  const lenderRole = await loanRegistry.LENDER_ROLE();
  await loanRegistry.grantRole(lenderRole, lender.address);

  const minterRole = await passportNFT.MINTER_ROLE();
  await passportNFT.grantRole(minterRole, lender.address);

  const managerRole = await poolToken.MANAGER_ROLE();
  await poolToken.grantRole(managerRole, manager.address);

  return {
    admin,
    lender,
    manager,
    borrower,
    investor,
    other,
    loanRegistry,
    scoreEngine,
    passportNFT,
    poolToken
  };
}

export function borrowerHash(seed: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(seed));
}

export function loanHash(seed: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(seed));
}

export async function maturityAfter(days: number) {
  const latest = await ethers.provider.getBlock("latest");
  return BigInt((latest?.timestamp ?? Math.floor(Date.now() / 1000)) + days * 24 * 60 * 60);
}
