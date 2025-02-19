-include .env

.PHONY: deploy

deploy graduation:;
	forge script script/DeployGraduation.s.sol:DeployGraduation --rpc-url $(RPC_URL) --via-ir -vvvv

clean:;
	forge clean