-include .env

.PHONY: deploy install clean

install:
	npm install
	forge install OpenZeppelin/openzeppelin-contracts --no-commit
	forge install foundry-rs/forge-std@v1.8.2 --no-commit
	cd lib && mkdir -p @uniswap && cd @uniswap && git clone https://github.com/Uniswap/briefcase.git

deploy-graduation:
	forge script script/DeployGraduation.s.sol:DeployGraduation --rpc-url $(TESTNET_RPC_URL) --via-ir

deploy-dumping-mainnet:
	forge script script/TestDumping.s.sol:TestDumping --rpc-url $(MAINNET_RPC_URL) --via-ir -vvvv

deploy-dumping-testnet:
	forge script script/TestDumping.s.sol:TestDumping --rpc-url $(TESTNET_RPC_URL) --via-ir -vvvv

clean:
	forge clean