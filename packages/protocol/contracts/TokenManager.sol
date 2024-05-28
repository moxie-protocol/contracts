// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./SecurityModule.sol";
import "./interfaces/ITokenManager.sol";
import "./interfaces/ISubjectTokenFactory.sol";
import "./interfaces/IERC20Extended.sol";

contract TokenManager is ITokenManager, SecurityModule {

    using SafeERC20 for IERC20Extended;

    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant CREATE_ROLE = keccak256("CREATE_ROLE");

    /// @dev Factory contract to deploy ERC20 contract for subject.abi
    ISubjectTokenFactory public subjectTokenFactory;

    /// @dev Mapping that tracks subject & its deployed token contract.
    mapping(address => IERC20Extended) public tokens;

    /**
     * @notice Initialize the contract.
     * @param _owner Owner of contract which gets admin role.
     * @param _subjectTokenFactory Address of subject factory use to deploy tokens for subject.
     */
    function initialize(
        address _owner,
        address _subjectTokenFactory
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);

        require(_subjectTokenFactory != address(0), "!subject token factory");
        subjectTokenFactory = ISubjectTokenFactory(subjectTokenFactory);
    }

    /**
     * @notice Creates token for subject, mints initial supply & transfer it to creator.
     * @param _subject Address of Subject for which token is getting deployed.
     * @param _name Name of token getting deployed.
     * @param _symbol Symbol of token getting deployed
     * @param _initialSupply Initial supply of token getting deployed.
     */
    function create(
        address _subject,
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) external whenNotPaused onlyRole(CREATE_ROLE) returns (address token_) {
        require(address(tokens[_subject]) == address(0), "!token exists");

        token_ = subjectTokenFactory.create(
            _name,
            _symbol,
            _initialSupply,
            address(this)
        );
        tokens[_subject] = IERC20Extended(token_);

        // Transfer initial supply to creator.
        require(
            IERC20(token_).transfer(msg.sender, _initialSupply),
            "!transfer"
        );

        emit TokenDeployed(_subject, token_, _initialSupply);
    }

    /**
     * @notice Mint for subject's token.
     * @param _subject Subject for which shares needs to be minted.
     * @param _beneficiary Beneficiary of minted token.
     * @param _amount Amount of tokens to mint.
     */
    function mint(
        address _subject,
        address _beneficiary,
        uint256 _amount
    ) public whenNotPaused onlyRole(MINT_ROLE) returns (bool) {
        require(address(tokens[_subject]) == address(0), "!token exists");
        IERC20Extended(tokens[_subject]).mint(_beneficiary, _amount);
        return true;
    }
}
