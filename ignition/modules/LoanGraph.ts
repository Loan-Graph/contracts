import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LoanGraphModule = buildModule("LoanGraphModule", (m) => {
  const adminAddress = m.getParameter("adminAddress");

  const loanRegistryImpl = m.contract("LoanRegistry");
  const scoreEngineImpl = m.contract("CreditScoreEngine");
  const passportNFTImpl = m.contract("PassportNFT");
  const poolTokenImpl = m.contract("PoolToken");

  return {
    adminAddress,
    loanRegistryImpl,
    scoreEngineImpl,
    passportNFTImpl,
    poolTokenImpl
  };
});

export default LoanGraphModule;
