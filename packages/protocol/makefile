-include .env

.PHONY: deploy


install:
	npm install && forge install OpenZeppelin/openzeppelin-contracts --no-commit && forge install foundry-rs/forge-std@v1.8.2 --no-commit && cd lib && mkdir @uniswap && cd @uniswap && git clone https://github.com/Uniswap/briefcase.git && cd .. 

deploy graduation:; forge script script/DeployGraduation.s.sol:DeployGraduation --rpc-url $(RPC_URL) --via-ir -vvvv

deploy dumping:; forge script script/TestDumping.s.sol:TestDumping --rpc-url $(RPC_URL) --via-ir -vvvv

clean:; forge clean