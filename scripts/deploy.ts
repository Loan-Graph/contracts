import { ethers, network, upgrades } from "hardhat";
import fs from "fs";
import path from "path";

type DeploymentRecord = {
  LoanRegistry: string;
  CreditScoreEngine: string;
  PassportNFT: string;
  PoolToken: string;
  deployedAt: string;
};

function saveDeployment(networkName: string, deployment: DeploymentRecord) {
  const filePath = path.resolve(__dirname, "..", "deployments", "addresses.json");
  const existing = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
    : {};

  existing[networkName] = deployment;
  fs.writeFileSync(filePath, `${JSON.stringify(existing, null, 2)}\n`, "utf-8");
}

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

  const deployment: DeploymentRecord = {
    LoanRegistry: await loanRegistry.getAddress(),
    CreditScoreEngine: await creditScoreEngine.getAddress(),
    PassportNFT: await passportNFT.getAddress(),
    PoolToken: await poolToken.getAddress(),
    deployedAt: new Date().toISOString()
  };

  saveDeployment(network.name, deployment);

  console.log("LoanRegistry Proxy:", deployment.LoanRegistry);
  console.log("CreditScoreEngine Proxy:", deployment.CreditScoreEngine);
  console.log("PassportNFT Proxy:", deployment.PassportNFT);
  console.log("PoolToken Proxy:", deployment.PoolToken);
  console.log(`Saved deployment to deployments/addresses.json under '${network.name}'`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
