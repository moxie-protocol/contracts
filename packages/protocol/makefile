-include .env

.PHONY: deploy

deploy graduation:;
	forge script script/DeployGraduation.s.sol:DeployGraduation --rpc-url $(RPC_URL) --via-ir -vvvv


deploy dumping:;
	forge script script/TestDumping.s.sol:TestDumping --rpc-url $(RPC_URL) --via-ir -vvvv

clean:;
	forge clean