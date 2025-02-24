// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolManagerDeployer, IPoolManager} from "@uniswap/briefcase/src/deployers/v4-core/PoolManagerDeployer.sol";
import {Permit2Deployer, IPermit2} from "@uniswap/briefcase/src/deployers/permit2/Permit2Deployer.sol";
import {
    PositionManagerDeployer,
    IPositionManager
} from "@uniswap/briefcase/src/deployers/v4-periphery/PositionManagerDeployer.sol";
import {
    UniversalRouterDeployer,
    IUniversalRouter
} from "@uniswap/briefcase/src/deployers/universal-router/UniversalRouterDeployer.sol";

contract UniswapDeployer {
    IPermit2 internal permit2;
    IPoolManager public poolManager;
    IPositionManager public positionManager;
    IUniversalRouter public universalRouter;

    function deployPoolManager() public {
        poolManager = PoolManagerDeployer.deploy(address(0));
    }

    function deployPositionManager() public {
        require(address(poolManager) != address(0), "Pool manager not deployed");
        permit2 = Permit2Deployer.deploy();
        positionManager =
            PositionManagerDeployer.deploy(address(poolManager), address(permit2), 300000, address(0), address(0));
    }

    function deployUniversalRouter() public {
        require(address(positionManager) != address(0), "Position manager not deployed");
        universalRouter = UniversalRouterDeployer.deploy(
            address(permit2), // address permit2,
            address(0), // address weth9,
            address(0), // address v2Factory,
            address(0), // address v3Factory,
            bytes32(0), // bytes32 v2PairInitCodeHash,
            bytes32(0), // bytes32 v3PoolInitCodeHash,
            address(poolManager), // address v4PoolManager,
            address(0), // address v3NFTPositionManager,
            address(positionManager) // address v4PositionManager
        );
    }

    function mineHookAddress(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        public
        view
        returns (address, bytes32)
    {
        return HookMiner.find(deployer, flags, creationCode, constructorArgs);
    }

    function deployHook(bytes memory creationCode, bytes memory constructorArgs, bytes32 salt)
        public
        returns (address hookAddress)
    {
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        assembly {
            let ptr := mload(0x40)
            let success := create2(0, add(initCode, 0x20), mload(initCode), salt)

            if iszero(success) {
                // Get the size of the returned error message
                let errorSize := returndatasize()
                // Copy the error message to memory
                returndatacopy(ptr, 0, errorSize)
                // Revert with the error message
                revert(ptr, errorSize)
            }

            hookAddress := success
        }
        return hookAddress;
    }

    function deployAll() external {
        deployPoolManager();
        deployPositionManager();
        deployUniversalRouter();
    }
}

// copied from https://github.com/uniswapfoundation/v4-template/blob/main/test/utils/HookMiner.sol
library HookMiner {
    // mask to slice out the bottom 14 bit of the address
    uint160 constant FLAG_MASK = 0x3FFF;

    // Maximum number of iterations to find a salt, avoid infinite loops
    uint256 constant MAX_LOOP = 100_000;

    /// @notice Find a salt that produces a hook address with the desired `flags`
    /// @param deployer The address that will deploy the hook. In `forge test`, this will be the test contract `address(this)` or the pranking address
    ///                 In `forge script`, this should be `0x4e59b44847b379578588920cA78FbF26c0B4956C` (CREATE2 Deployer Proxy)
    /// @param flags The desired flags for the hook address
    /// @param creationCode The creation code of a hook contract. Example: `type(Counter).creationCode`
    /// @param constructorArgs The encoded constructor arguments of a hook contract. Example: `abi.encode(address(manager))`
    /// @return hookAddress salt and corresponding address that was found. The salt can be used in `new Hook{salt: salt}(<constructor arguments>)`
    function find(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        internal
        view
        returns (address, bytes32)
    {
        address hookAddress;
        bytes memory creationCodeWithArgs = abi.encodePacked(creationCode, constructorArgs);

        uint256 salt;
        for (salt; salt < MAX_LOOP; salt++) {
            hookAddress = computeAddress(deployer, salt, creationCodeWithArgs);
            if (uint160(hookAddress) & FLAG_MASK == flags && hookAddress.code.length == 0) {
                return (hookAddress, bytes32(salt));
            }
        }
        revert("HookMiner: could not find salt");
    }

    /// @notice Precompute a contract address deployed via CREATE2
    /// @param deployer The address that will deploy the hook. In `forge test`, this will be the test contract `address(this)` or the pranking address
    ///                 In `forge script`, this should be `0x4e59b44847b379578588920cA78FbF26c0B4956C` (CREATE2 Deployer Proxy)
    /// @param salt The salt used to deploy the hook
    /// @param creationCode The creation code of a hook contract
    function computeAddress(address deployer, uint256 salt, bytes memory creationCode)
        internal
        pure
        returns (address hookAddress)
    {
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xFF), deployer, salt, keccak256(creationCode)))))
        );
    }
}
