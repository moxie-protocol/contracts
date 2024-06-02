// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "./SecurityModule.sol";
import "./interfaces/ITokenManager.sol";
import "./interfaces/IERC20Extended.sol";
import "./interfaces/ISubjectErc20.sol";

contract TokenManager is ITokenManager, SecurityModule {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant CREATE_ROLE = keccak256("CREATE_ROLE");

    /// @dev Address of subject implementation.
    address subjectImplementation;

    /// @dev Mapping of subject & its Token
    mapping(address => address) public tokens;

    /**
     * @notice Initialize the contract.
     * @param _owner Owner of contract which gets admin role.
     * @param _subjectImplementation Implemetation of subject ERC20 contract.
     */
    function initialize(
        address _owner,
        address _subjectImplementation
    ) public initializer {
        if (_subjectImplementation == address(0))
            revert InvalidSubjectImplementation();
        if (_owner == address(0)) revert InvalidOwner();

        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);

        subjectImplementation = _subjectImplementation;
    }

    /**
     * @notice Creates token for subject, mints initial supply & transfer it to creator.
     * @param _subject Address of subject for which token is getting deployed.
     * @param _name Name of token getting deployed.
     * @param _symbol Symbol of token getting deployed
     * @param _initialSupply Initial supply of token getting deployed.
     * @param _moxiePassVerifier Address of moxie pass verifier contract. 
     */
    function create(
        address _subject,
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        address _moxiePassVerifier
    ) external whenNotPaused onlyRole(CREATE_ROLE) returns (address token_) {
        if (_subject == address(0)) revert InvalidSubject();
        if (tokens[_subject] != address(0)) revert SubjectExists();

        token_ = Clones.cloneDeterministic(
            subjectImplementation,
            keccak256(abi.encodePacked(_subject))
        );

       //create initialize & mint initial supply.
        ISubjectErc20(token_).initialize(
        address(this),
        _name,
        _symbol,
        _initialSupply,
        _moxiePassVerifier
        );

        tokens[_subject] = token_;
        // Transfer initial supply to creator.
        IERC20Extended(token_).safeTransfer(msg.sender, _initialSupply);

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
        if (tokens[_subject] == address(0)) revert TokenNotFound();

        IERC20Extended(tokens[_subject]).mint(_beneficiary, _amount);
        return true;
    }
}
