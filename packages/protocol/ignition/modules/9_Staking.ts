import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
export default buildModule("Staking", (m) => {
    // deploy the Staking contract
    // mint moxie pass to staking contract
    // addTokenDestination to vesting manager
    // setAuthFunctionCallMany to tokenLockManager ,with signatures (deposit,buy ,extend & withdraw)
    // initialize (address _tokenManager, address _moxieBondingCurve, address _moxieToken, address _defaultAdmin)
    // call approveProtocol() from tokenLockWallet
    const deployer = m.getAccount(0);
    const staking = m.contract("Staking", [], { from: deployer });

    return { staking };
});