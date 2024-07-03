import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import EasyAuction from "../../test-artifact/easy-auction/artifacts/contracts/EasyAuction.sol/EasyAuction.json";


export default buildModule("ProtocolContracts", (m) => {

  const deployer = m.getAccount(0);
  const owner = m.getAccount(1);

  const subjectFactory = m.contract("SubjectFactory", [], { from: deployer });
  const formula = m.contract("BancorFormula", [], { from: deployer });
  const vault = m.contract("Vault", [], { from: deployer });
  const subjectERC20 = m.contract("SubjectERC20", [], { from: deployer })
  const moxiePassVerifier = m.contract("MoxiePassVerifier", [owner], { from: deployer })
  const tokenManager = m.contract("TokenManager", [], { from: deployer })
  const moxieBondingCurve = m.contract("MoxieBondingCurve", [], { from: deployer })

  return { subjectFactory, formula, vault, subjectERC20, moxiePassVerifier, tokenManager, moxieBondingCurve };
});