import { ethers, upgrades } from "hardhat";

async function main() {
  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) {
    throw new Error("ADMIN_ADDRESS is required in environment");
  }

  const LoanRegistry = await ethers.getContractFactory("LoanRegistry");
  const loanRegistry = await upgrades.deployProxy(LoanRegistry, [adminAddress], {
    kind: "uups",
    initializer: "initialize"
  });
  await loanRegistry.waitForDeployment();

  const CreditScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
  const creditScoreEngine = await upgrades.deployProxy(
    CreditScoreEngine,
    [adminAddress, await loanRegistry.getAddress()],
    {
      kind: "uups",
      initializer: "initialize"
    }
  );
  await creditScoreEngine.waitForDeployment();

  const PassportNFT = await ethers.getContractFactory("PassportNFT");
  const passportNFT = await upgrades.deployProxy(
    PassportNFT,
    [adminAddress, await loanRegistry.getAddress(), await creditScoreEngine.getAddress()],
    {
      kind: "uups",
      initializer: "initialize"
    }
  );
  await passportNFT.waitForDeployment();

  const PoolToken = await ethers.getContractFactory("PoolToken");
  const poolToken = await upgrades.deployProxy(PoolToken, [adminAddress, "LoanGraph Pool Token", "LGPOOL"], {
    kind: "uups",
    initializer: "initialize"
  });
  await poolToken.waitForDeployment();

  console.log("LoanRegistry Proxy:", await loanRegistry.getAddress());
  console.log("CreditScoreEngine Proxy:", await creditScoreEngine.getAddress());
  console.log("PassportNFT Proxy:", await passportNFT.getAddress());
  console.log("PoolToken Proxy:", await poolToken.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
