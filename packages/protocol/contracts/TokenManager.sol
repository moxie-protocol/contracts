// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

import "./SecurityModule.sol";
import "./interfaces/ITokenManager.sol";
import "./interfaces/ISubjectFactory.sol";
import "./interfaces/IERC20.sol";

contract TokenManager is ITokenManager, SecurityModule {
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant CREATE_ROLE = keccak256("CREATE_ROLE");

    ISubjectFactory public subjectFactory;
    mapping(address => address) public tokens;

    function initialize(
        address _owner,
        address _subjectFactory
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);

        require(_subjectFactory != address(0), "!subject factory");
        subjectFactory = ISubjectFactory(subjectFactory);
    }

    function create(
        address _subject,
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) external whenNotPaused onlyRole(CREATE_ROLE) returns (address token_) {
        require(tokens[_subject] == address(0), "!token exists");

        token_ = subjectFactory.create(
            _name,
            _symbol,
            _initialSupply,
            address(this)
        );
        tokens[_subject] = token_;
        emit TokenDeployed(_subject, token_, _initialSupply);
    }

    function mint(
        address _subject,
        address _beneficiary,
        uint256 _amount
    ) public whenNotPaused onlyRole(MINT_ROLE) returns (bool) {
        require(tokens[_subject] == address(0), "!token exists");

        IERC20(tokens[_subject]).mint(_beneficiary, _amount);

        return true;
    }
}
