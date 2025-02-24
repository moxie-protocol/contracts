// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBancorFormula} from "./interfaces/IBancorFormula.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {SecurityModule} from "./SecurityModule.sol";
import {ITokenManager} from "./interfaces/ITokenManager.sol";
import {IERC20Extended} from "./interfaces/IERC20Extended.sol";
import {IVault} from "./interfaces/IVault.sol";
import {IMoxieBondingCurveV3} from "./interfaces/IMoxieBondingCurveV3.sol";
import {IProtocolRewards} from "./rewards/IProtocolRewards.sol";
import {IGraduationHook} from "./uniswap/GraduationHook.sol";
import {IPoolManager, PoolKey, IHooks, Currency} from "@uniswap/briefcase/src/protocols/v4-core/interfaces/IPoolManager.sol";
import {Math} from "./libraries/Math.sol";
import {IPositionManager} from "@uniswap/briefcase/src/protocols/v4-periphery/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/briefcase/src/protocols/v4-periphery/libraries/Actions.sol";
import {IV4Router} from "@uniswap/briefcase/src/protocols/v4-periphery/interfaces/IV4Router.sol";
import {IUniversalRouter} from "@uniswap/briefcase/src/protocols/universal-router/interfaces/IUniversalRouter.sol";
import {Commands} from "@uniswap/briefcase/src/protocols/universal-router/libraries/Commands.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/briefcase/src/protocols/v4-core/types/PoolId.sol";

/**
 * @title Moxie Bonding curve
 * @author Moxie Team
 * @notice Bonding curve contract which enables subject onboarding, buy & sell of subject shares.
 */
contract MoxieBondingCurveV3 is IMoxieBondingCurveV3, SecurityModule {
    using SafeERC20 for IERC20Extended;
    using PoolIdLibrary for PoolKey;

    bytes32 public constant UPDATE_FEES_ROLE = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant UPDATE_FORMULA_ROLE = keccak256("UPDATE_FORMULA_ROLE");
    bytes32 public constant UPDATE_BENEFICIARY_ROLE = keccak256("UPDATE_BENEFICIARY_ROLE");
    bytes32 public constant UPDATE_PROTOCOL_REWARD_ROLE = keccak256("UPDATE_PROTOCOL_REWARD_ROLE");
    bytes32 public constant UPDATE_GRADUATION_MARKET_CAP_ROLE = keccak256("UPDATE_GRADUATION_MARKET_CAP_ROLE");
    bytes32 public constant UPDATE_RESERVE_RATIO = keccak256("UPDATE_RESERVE_RATIO");

    error MoxieBondingCurve_InvalidToken();
    error MoxieBondingCurve_InvalidVault();
    error MoxieBondingCurve_InvalidBeneficiary();
    error MoxieBondingCurve_InvalidFeePercentage();
    error MoxieBondingCurve_InvalidFormula();
    error MoxieBondingCurve_InvalidTokenManager();
    error MoxieBondingCurve_InvalidOwner();
    error MoxieBondingCurve_InvalidSubjectFactory();
    error MoxieBondingCurve_OnlySubjectFactory();
    error MoxieBondingCurve_InvalidReserveRation();
    error MoxieBondingCurve_SubjectAlreadyInitialized();
    error MoxieBondingCurve_SubjectNotInitialized();
    error MoxieBondingCurve_InvalidSubjectSupply();
    error MoxieBondingCurve_InvalidSubject();
    error MoxieBondingCurve_InvalidDepositAmount();
    error MoxieBondingCurve_InvalidSubjectToken();
    error MoxieBondingCurve_SlippageExceedsLimit();
    error MoxieBondingCurve_InvalidSellAmount();
    error MoxieBondingCurve_InvalidAmount();
    error MoxieBondingCurve_InvalidProtocolRewardAddress();
    error MoxieBondingCurve_SubjectNotPaused();
    error MoxieBondingCurve_TradingPaused();
    error MoxieBondingCurve_SubjectAlreadyGraduated();
    error MoxieBondingCurve_SubjectReadyForGraduation();
    error MoxieBondingCurve_SubjectNotReadyForGraduation();
    error MoxieBondingCurve_SubjectNotGraduated();

    event UpdateFees(
        uint256 _protocolBuyFeePct, uint256 _protocolSellFeePct, uint256 _subjectBuyFeePct, uint256 _subjectSellFeePct, uint256 _swapFeeRatioProtocolPct
    );

    event UpdateBeneficiary(address _beneficiary);

    event UpdateFormula(address _formula);

    event BondingCurveInitialized(
        address indexed _subject,
        address indexed _subjectToken,
        uint256 _initialSupply,
        uint256 _reserve,
        uint32 _reserveRatio
    );

    event SubjectSharePurchased(
        address indexed _subject,
        address indexed _sellToken,
        uint256 _sellAmount,
        address _spender,
        address _buyToken,
        uint256 _buyAmount,
        address indexed _beneficiary
    );

    event SubjectShareSold(
        address indexed _subject,
        address indexed _sellToken,
        uint256 _sellAmount,
        address _spender,
        address _buyToken,
        uint256 _buyAmount,
        address indexed _beneficiary
    );

    event UpdateReferralFees(
        uint256 _platformReferrerBuyFeePct,
        uint256 _platformReferrerSellFeePct,
        uint256 _orderReferrerBuyFeePct,
        uint256 _orderReferrerSellFeePct
    );

    event SubjectReserveRatioUpdated(
        address _subject,
        uint32 _oldReserveRatio,
        uint32 _newReserveRatio
    );

    event DefaultGraduationMarketCapUpdated(
        uint256 _oldDefaultGraduationMarketCap,
        uint256 _newDefaultGraduationMarketCap
    );

    event GraduationMarketCapUpdated(
        uint32 indexed _reserveRatio,
        uint256 _oldGraduationMarketCap,
        uint256 _newGraduationMarketCap,
        bool _isDefault
    );

    event SubjectGraduated(
        address indexed _subject,
        PoolId _poolId,
        uint256 _tokenId
    );

    event TradingPaused(
        address _subject,
        bool _isPaused
    );

    event Swap(
        address indexed _sender,
        address indexed _subject,
        bool _buySubject,
        uint256 _amountIn,
        uint256 _amountOut
    );

    /// @dev Address of moxie token.
    IERC20Extended public token;
    /// @dev address of Bancors formula.
    IBancorFormula public formula;
    /// @dev Address of token manager contracts.
    ITokenManager public tokenManager;
    /// @dev Address of vault contract.
    IVault public vault;

    /// @dev Use to represent fee percentage base 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    uint256 public constant PCT_BASE = 10 ** 18;
    /// @dev Use to represent reserve ratio, 1M is 1
    uint32 public constant PPM = 1000000;

    /// @dev Fee settings.
    uint256 public protocolBuyFeePct;
    uint256 public protocolSellFeePct;
    uint256 public subjectBuyFeePct;
    uint256 public subjectSellFeePct;

    /// @dev Address of protocol fee beneficiary.
    address public feeBeneficiary;

    /// @dev Address of subject factory.
    address public subjectFactory;

    /// @dev subject address vs reserve ratio
    mapping(address subject => uint32 _reserveRatio) public reserveRatio;

    IProtocolRewards public protocolRewards;

    mapping(address subject => address _platformReferrer) public platformReferrer;
    /// @dev mapping to track if subject trading is paused.
    mapping(address subject => uint256 _paused) public lastPaused;

    /// @dev these fee is calculated from protocol fees.
    uint256 public platformReferrerBuyFeePct;
    uint256 public platformReferrerSellFeePct;
    uint256 public orderReferrerBuyFeePct;
    uint256 public orderReferrerSellFeePct;

    // GRADUATION UPGRADE VARIABLES BELOW

    /// @dev graduation market cap in moxie
    /// @dev must have 18 decimals
    uint256 internal defaultGraduationMarketCap;
    /// @dev graduation overrides, 0 means default
    mapping(uint32 reserveRatio => uint256 graduationMarketCap) internal graduationMarketCapOverrides;
    // 0 means token is not graduated
    mapping(address subject => uint256 tokenId) public subjectTokenId;
    IGraduationHook public graduationHook;
    IPositionManager public positionManager;
    IUniversalRouter public router;
    uint256 swapFeeRatioProtocolPct;

    // GRADUATION UPGRADE VARIABLES ABOVE

    /**
     * Initialize the contract.
     * @param _token Moxie token address.
     * @param _formula Bancors formula contract address.
     * @param _owner Owner of contract.
     * @param _tokenManager Address of token manager contract.
     * @param _vault Address of vault contract address.
     * @param _feeInput subject & protocol Feeinput struct.
     * @param _feeBeneficiary Protocol fee beneficiary.
     * @param _subjectFactory Subject Factory address.
     */
    function initialize(
        address _token,
        address _formula,
        address _owner,
        address _tokenManager,
        address _vault,
        FeeInput memory _feeInput,
        address _feeBeneficiary,
        address _subjectFactory
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();

        _validateInput(_token, _formula, _owner, _tokenManager, _vault, _feeBeneficiary, _subjectFactory);

        _validateFee(_feeInput);

        token = IERC20Extended(_token);
        formula = IBancorFormula(_formula);
        tokenManager = ITokenManager(_tokenManager);
        vault = IVault(_vault);
        protocolBuyFeePct = _feeInput.protocolBuyFeePct;
        protocolSellFeePct = _feeInput.protocolSellFeePct;
        subjectBuyFeePct = _feeInput.subjectBuyFeePct;
        subjectSellFeePct = _feeInput.subjectSellFeePct;
        feeBeneficiary = _feeBeneficiary;
        subjectFactory = _subjectFactory;

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    function reinitialize(
        uint256 _defaultGraduationMarketCap,
        IGraduationHook _hook,
        IPositionManager _positionManager,
        IUniversalRouter _router,
        uint256 _swapFeeRatioProtocolPct
    ) external reinitializer(2) {
        defaultGraduationMarketCap = _defaultGraduationMarketCap;
        graduationHook = _hook;
        positionManager = _positionManager;
        router = _router;
        if (!_feeIsValid(_swapFeeRatioProtocolPct)) revert MoxieBondingCurve_InvalidFeePercentage();
        swapFeeRatioProtocolPct = _swapFeeRatioProtocolPct;
    }

    modifier whenNotTradingPaused(address _subject) {
       if (lastPaused[_subject] != 0) revert MoxieBondingCurve_TradingPaused();
       _;
    }

    /**
     * @dev Internal function to validate initialization input.
     * @param _token Address of moxie token.
     * @param _formula Address of formula contract address.
     * @param _owner Address of owner.
     * @param _tokenManager  Address of token manager.
     * @param _vault Address of vault.
     * @param _feeBeneficiary Address of fee beneficiary.
     * @param _subjectFactory Address of subject factory.
     */
    function _validateInput(
        address _token,
        address _formula,
        address _owner,
        address _tokenManager,
        address _vault,
        address _feeBeneficiary,
        address _subjectFactory
    ) internal pure {
        if (_isZeroAddress(_token)) revert MoxieBondingCurve_InvalidToken();
        if (_isZeroAddress(_formula)) revert MoxieBondingCurve_InvalidFormula();
        if (_isZeroAddress(_owner)) revert MoxieBondingCurve_InvalidOwner();
        if (_isZeroAddress(_tokenManager)) {
            revert MoxieBondingCurve_InvalidTokenManager();
        }
        if (_isZeroAddress(_vault)) revert MoxieBondingCurve_InvalidVault();
        if (_isZeroAddress(_subjectFactory)) {
            revert MoxieBondingCurve_InvalidSubjectFactory();
        }
        if (_isZeroAddress(_feeBeneficiary)) {
            revert MoxieBondingCurve_InvalidBeneficiary();
        }
    }

    /**
     * Internal function to validate Fee params.
     * @param _feeInput Fee input struct.
     */
    function _validateFee(FeeInput memory _feeInput) internal pure {
        if (
            !_feeIsValid(_feeInput.protocolBuyFeePct + _feeInput.subjectBuyFeePct)
                || !_feeIsValid(_feeInput.protocolSellFeePct + _feeInput.subjectSellFeePct)
                || !_feeIsValid(_feeInput.swapFeeRatioProtocolPct)
        ) revert MoxieBondingCurve_InvalidFeePercentage();
    }

    /**
     * @dev Internal function to update fee beneficiary.
     * @param _beneficiary Address of fee beneficiary.
     */
    function _updateFeeBeneficiary(address _beneficiary) internal {
        feeBeneficiary = _beneficiary;

        emit UpdateBeneficiary(_beneficiary);
    }

    /**
     * @dev Internal function to update bancor formula.
     * @param _formula Address of formula contract address.
     */
    function _updateFormula(IBancorFormula _formula) internal {
        formula = _formula;

        emit UpdateFormula(address(_formula));
    }

    /**
     * @dev Internal function to validate fee.
     * @param _fee Fee Input in PCT_Base.
     */
    function _feeIsValid(uint256 _fee) internal pure returns (bool) {
        return _fee < PCT_BASE;
    }

    /**
     * @dev Internal function to validate address.
     * @param _address  Address to validate.
     */
    function _isZeroAddress(address _address) internal pure returns (bool) {
        return _address == address(0);
    }

    /**
     * @dev Internal function to validate reserve ratio.
     * @param _reserveRatio Reserve ratio in PPM.
     */
    function _reserveRatioIsValid(uint32 _reserveRatio) internal pure returns (bool) {
        return _reserveRatio <= PPM;
    }

    /**
     * @dev Internal function to update fee.
     * @param _protocolBuyFeePct Protocol fee percentage applied during buy share transaction.
     * @param _protocolSellFeePct Subject fee percentage applied during sell share transaction.
     * @param _subjectBuyFeePct Subject fee percentage applied during buy share transaction.
     * @param _subjectSellFeePct Subject fee percentage applied during sell share transaction.
     */
    function _updateFees(
        uint256 _protocolBuyFeePct,
        uint256 _protocolSellFeePct,
        uint256 _subjectBuyFeePct,
        uint256 _subjectSellFeePct,
        uint256 _swapFeeRatioProtocolPct
    ) internal {
        protocolBuyFeePct = _protocolBuyFeePct;
        protocolSellFeePct = _protocolSellFeePct;
        subjectBuyFeePct = _subjectBuyFeePct;
        subjectSellFeePct = _subjectSellFeePct;
        swapFeeRatioProtocolPct = _swapFeeRatioProtocolPct;
        emit UpdateFees(protocolBuyFeePct, protocolSellFeePct, subjectBuyFeePct, subjectSellFeePct, swapFeeRatioProtocolPct);
    }

    function _calculateFee(uint256 _amount, uint256 _fee) private pure returns (uint256) {
        return (_amount * _fee) / PCT_BASE;
    }

    function _processFeeForBuySell(
        address _subject,
        uint256 _subjectFee,
        uint256 _protocolFee,
        address _orderReferrer,
        bool _isBuy
    ) private {
        address platformReferrerAddress = platformReferrer[_subject];
        if (_isZeroAddress(platformReferrerAddress)) {
            platformReferrerAddress = feeBeneficiary;
        }

        if (_isZeroAddress(_orderReferrer)) {
            _orderReferrer = feeBeneficiary;
        }

        address[] memory recipients = new address[](4);
        uint256[] memory amounts = new uint256[](4);
        bytes4[] memory reasons = new bytes4[](4);

        uint256 totalAmount = _subjectFee + _protocolFee;

        token.approve(address(protocolRewards), totalAmount);
        recipients[0] = _subject;
        amounts[0] = _subjectFee;
        reasons[0] = bytes4(keccak256("TRANSACTION_FEE"));

        uint256 orderReferrerFee =
            _calculateFee(_protocolFee, _isBuy ? orderReferrerBuyFeePct : orderReferrerSellFeePct);
        uint256 platformReferrerFee =
            _calculateFee(_protocolFee, _isBuy ? platformReferrerBuyFeePct : platformReferrerSellFeePct);

        recipients[1] = _orderReferrer;
        amounts[1] = orderReferrerFee;
        reasons[1] = bytes4(keccak256("ORDER_REFERRER_FEE"));

        recipients[2] = platformReferrerAddress;
        amounts[2] = platformReferrerFee;
        reasons[2] = bytes4(keccak256("PLATFORM_REFERRER_FEE"));

        uint256 actualProtocolFee = _protocolFee - orderReferrerFee - platformReferrerFee;

        recipients[3] = feeBeneficiary;
        amounts[3] = actualProtocolFee;
        reasons[3] = bytes4(keccak256("PROTOCOL_FEE"));

        protocolRewards.depositBatch(recipients, amounts, reasons, "TRANSACTION_FEE");
    }

    function subjectGraduated(address _subject) public view returns (bool) {
        return subjectTokenId[_subject] != 0;
    }

    function _swap(address _subject, bool buySubject, uint256 amountIn, uint256 minAmountOut, address _recipient) internal returns (uint256 amountReturned) {
        if (!subjectGraduated(_subject)) {
            revert MoxieBondingCurve_SubjectNotGraduated();
        }
        if(minAmountOut >= type(uint128).max) revert MoxieBondingCurve_InvalidAmount();
        address subjectToken = tokenManager.tokens(_subject);
        IERC20Extended sellToken = buySubject ? token : IERC20Extended(subjectToken);
        sellToken.transferFrom(msg.sender, address(router), amountIn);
        IV4Router.ExactInputSingleParams memory swapParams;
        {
            (address token0, address token1, bool moxieIsZero) = address(token) < subjectToken ? (address(token), subjectToken, true) : (subjectToken, address(token), false);
            PoolKey memory key = PoolKey({
                currency0: Currency.wrap(token0),
                currency1: Currency.wrap(token1),
                fee: 10000,
                tickSpacing: 200,
                hooks: graduationHook
            });

            swapParams = IV4Router.ExactInputSingleParams({
                poolKey: key,
                // moxie is token0, buy subject token: true, true => true
                // moxie is token0, sell subject token => true, false => false
                // moxie is token1, buy subject token => false, true => false
                // moxie is token1, sell subject token => false, false => true
                // => XNOR
                zeroForOne: moxieIsZero == buySubject,
                amountIn: uint128(amountIn),
                amountOutMinimum: uint128(minAmountOut),
                hookData: ""
            });
        }
        amountReturned = _executeSwap(swapParams, buySubject ? address(token) : subjectToken, amountIn, buySubject ? subjectToken : address(token), _recipient);
        emit Swap(msg.sender, _subject, buySubject, amountIn, amountReturned);
    }

    /**
     * @dev Internal function to execute a swap on Uniswap v4.
     * @param _swapParams Swap parameters.
     * @param _tokenIn Input token address.
     * @param _amountIn Amount of input tokens to swap.
     * @param _tokenOut Output token address.
     * @param _recipient Recipient address.
     * @return amountReturned Amount of output tokens received.
     */
    function _executeSwap(IV4Router.ExactInputSingleParams memory _swapParams, address _tokenIn, uint256 _amountIn, address _tokenOut, address _recipient) internal returns (uint256 amountReturned) {
        // if(_amountIn >= type(uint128).max) revert MoxieBondingCurve_InvalidAmount();
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(_swapParams);
        params[1] = abi.encode(_tokenIn, _amountIn, false);
        // 0 means take all
        params[2] = abi.encode(_tokenOut, _recipient, 0);
        bytes memory command = abi.encode(
            abi.encodePacked(uint8(Actions.SWAP_EXACT_IN_SINGLE), uint8(Actions.SETTLE), uint8(Actions.TAKE)),
            params);
        bytes[] memory commands = new bytes[](1);
        commands[0] = command;
        uint256 amountOutBefore = _balanceOf(_tokenOut, _recipient);
        router.execute(abi.encodePacked(uint8(Commands.V4_SWAP)), commands, block.timestamp);
        amountReturned = _balanceOf(_tokenOut, _recipient) - amountOutBefore;
    }

    /**
     * @dev Initialize a new liquidity pool for the subject token to graduate, add liquidity and swap remainder.
     * @param _subject Subject address.
     * @param remainder Remainder amount to swap.
     * @param sender Sender address.
     * @param remainingMinAmountOut Minimum amount out for the swap.
     * @return subjectTokens Subject tokens received from the swap.
     */
    function _graduateSubject(address _subject, uint256 remainder, address sender, uint256 remainingMinAmountOut) internal returns (uint256 subjectTokens) {
        address subjectToken = tokenManager.tokens(_subject);
        (PoolKey memory key, uint256 price, bool moxieIsZero) = _initializeSubject(_subject, subjectToken);
        uint256 tokenId = positionManager.nextTokenId();
        subjectTokenId[_subject] = tokenId;
        _addLiquidity(_subject, subjectToken, key, price, moxieIsZero);
        // (PoolKey memory keyFromPosition, ) = positionManager.getPoolAndPositionInfo(tokenId);
        // sanity check that the tokenId is correct
        // assert(keccak256(abi.encode(keyFromPosition)) == keccak256(abi.encode(key)));
        if (remainder != 0) {
            subjectTokens = _swapRemainder(subjectToken, key, moxieIsZero, remainder, sender, remainingMinAmountOut);
        }
        emit SubjectGraduated(_subject, key.toId(), tokenId);
    }

    /**
     * @dev Initialize a new liquidity pool on Uniswap v4.
     * @param _subject Subject address.
     * @param _subjectToken Subject token address.
     * @return key Pool key.
     * @return price Price of the subject token in moxie.
     * @return moxieIsZero True if moxie is token0, false otherwise.
     */
    function _initializeSubject(address _subject, address _subjectToken) internal returns (PoolKey memory key, uint256 price, bool moxieIsZero) {
        address token_ = address(token);
        address token0; address token1;
        (token0, token1, moxieIsZero) = token_ < _subjectToken ? (token_, _subjectToken, true) : (_subjectToken, token_, false);
        key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 10000,
            tickSpacing: 200,
            hooks: graduationHook
        });
        uint256 currentMarketCap = PPM * vault.balanceOf(_subjectToken, address(token)) / reserveRatio[_subject];
        price = currentMarketCap * 1e18 / IERC20Extended(tokenManager.tokens(_subject)).totalSupply();
        // @audit sqrt(2^256)*2^96 does not overflow so we only need to make sure that price * 1e36 does not overflow, which should not be the case
        uint256 sqrtPriceX96 = Math.sqrt(moxieIsZero ? 1e72 / price : price * 1e36) * (2**96) / 10 ** 27;
        // assert(sqrtPriceX96 <= type(uint160).max);
        IPoolManager(graduationHook.poolManager()).initialize(key, uint160(sqrtPriceX96));
    }

    /**
     * @dev Add liquidity to the initialized pool.
     * @param _subject Subject address.
     * @param _subjectToken Subject token address.
     * @param key Pool key.
     * @param price Price of the subject token in moxie.
     * @param moxieIsZero True if moxie is token0, false otherwise.
     */
    function _addLiquidity(address _subject, address _subjectToken, PoolKey memory key, uint256 price, bool moxieIsZero) internal {
        uint256 tokenAmount = vault.balanceOf(_subjectToken, address(token));
        uint256 subjectAmount = tokenAmount * 1e18 / price;
        // assert(subjectAmount < type(uint128).max);
        // assert(tokenAmount < type(uint128).max);
        (uint256 amount0Max, uint256 amount1Max) = moxieIsZero ? (tokenAmount, subjectAmount) : (subjectAmount, tokenAmount);
        bytes[] memory params = new bytes[](5);
        params[0] = abi.encode(token, tokenAmount, false);
        params[1] = abi.encode(_subjectToken, subjectAmount, false);
        // min/max tick for tick spacing 200 is calculated as follows:
        // min/max tick = +- 887272
        // => min/max tick * 200 / 200 = 887200
        params[2] = abi.encode(key, int24(-887200), int24(887200), uint128(amount0Max), uint128(amount1Max), address(this), "");
        // this should always clear the delta in theory, should there be an edge case where more tokens are left after adding liquidity, they can be recovered from this contract
        params[3] = abi.encode(token, 1e9);
        params[4] = abi.encode(_subjectToken, 1e9);
        vault.transfer(_subjectToken, address(token), address(positionManager), tokenAmount);
        tokenManager.mint(_subject, address(positionManager), subjectAmount);

        positionManager.modifyLiquidities(
            abi.encode(
                abi.encodePacked(
                    uint8(Actions.SETTLE),
                    uint8(Actions.SETTLE),
                    uint8(Actions.MINT_POSITION_FROM_DELTAS),
                    uint8(Actions.CLEAR_OR_TAKE),
                    uint8(Actions.CLEAR_OR_TAKE)
                ),
                params),
            block.timestamp
        );
    }

    /**
     * @dev Swap remainder of the subject token.
     * @param _subjectToken Subject token address.
     * @param key Pool key.
     * @param moxieIsZero True if moxie is token0, false otherwise.
     * @param remainder Remainder amount to swap.
     * @param sender Sender address.
     * @param remainingMinAmountOut Minimum amount out for the swap.
     * @return subjectTokens Subject tokens received from the swap.
     */
    function _swapRemainder(address _subjectToken, PoolKey memory key, bool moxieIsZero, uint256 remainder, address sender, uint256 remainingMinAmountOut) internal returns (uint256 subjectTokens) {
        // if(remainingMinAmountOut >= type(uint128).max) revert MoxieBondingCurve_InvalidAmount();
        token.transfer(address(router), remainder);

        IV4Router.ExactInputSingleParams memory swapParams = IV4Router.ExactInputSingleParams({
            poolKey: key,
            zeroForOne: moxieIsZero,
            amountIn: uint128(remainder),
            amountOutMinimum: uint128(remainingMinAmountOut),
            hookData: ""
        });

        return _executeSwap(swapParams, address(token), remainder, _subjectToken, sender);        
    }

    /**
     * @dev Internal function to buy  shares of subject.
     * @dev If a token reaches the graduation market cap during the buy, the subject graduates and the remainder is then swapped on the liquidity pool
     * @param _subjectToken Address of Subject Token.
     * @param _depositAmount Amount of deposit to buy shares.
     * @param _onBehalfOf Address of beneficiary where shares will be minted. This address can be zero address too.
     * @param _minReturnAmountAfterFee Minimum number of shares that must be received.
     * @param _subject Address of subject.
     * @param _subjectReserveRatio Subject Reserve ratio.
     */
    function _buyShares(
        IERC20Extended _subjectToken,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _subject,
        uint32 _subjectReserveRatio,
        address _orderReferrer
    ) internal returns (uint256 shares_) {
        // moxie
        token.safeTransferFrom(msg.sender, address(this), _depositAmount);
        uint256 remainder = 0;
        uint256 subjectReserve = vault.balanceOf(address(_subjectToken), address(token));
        {
            //to solve stack too deep issue.
            (uint256 protocolFee, uint256 subjectFee) = _calculateBuySideFee(_depositAmount);
            // optimistically calculate deposit + fees
            uint256 vaultDeposit = _depositAmount - subjectFee - protocolFee;
            uint256 reservesRequiredForGraduation = _reservesRequiredForGraduation(_subjectReserveRatio);
            if (subjectReserve + vaultDeposit > reservesRequiredForGraduation) {
                // the vault deposit would exceed the graduation market cap after the full deposit. Calculate values for a partial deposit.
                vaultDeposit = reservesRequiredForGraduation > subjectReserve ? reservesRequiredForGraduation - subjectReserve : 0;
                // new deposit amount (d) = vault deposit (v) + fees (f)
                // d = v + d * (f1 + f2)
                // d * (1 - f1 - f2) = v
                // d = v / (1 - f1 - f2)
                // total deposit amount = new deposit amount + remainder = vault deposit + fees + remainder
                remainder = _depositAmount - vaultDeposit * PCT_BASE / (PCT_BASE - protocolBuyFeePct - subjectBuyFeePct);
                _depositAmount -= remainder;
                (protocolFee, subjectFee) = _calculateBuySideFee(_depositAmount);
            }

            if (_depositAmount > 0) {
                _processFeeForBuySell(_subject, subjectFee, protocolFee, _orderReferrer, true);
                token.approve(address(vault), vaultDeposit);
                vault.deposit(address(_subjectToken), address(token), vaultDeposit);
            }

            shares_ = formula.calculatePurchaseReturn(
                _subjectToken.totalSupply(), subjectReserve, _subjectReserveRatio, vaultDeposit
            );
        }

        ///@dev Don't mint if intent is to burn
        if (!_isZeroAddress(_onBehalfOf) && shares_ > 0) {
            tokenManager.mint(_subject, _onBehalfOf, shares_);
        }

        if (remainder > 0) {
            uint256 remainingMinAmountOut = _minReturnAmountAfterFee < shares_ ? 0 :  _minReturnAmountAfterFee - shares_;
            // we have a remainder, therefore graduate the subject and swap the remainder on the liquidity pool
            shares_ += _graduateSubject(_subject, remainder, _onBehalfOf, remainingMinAmountOut);
        } else if (shares_ < _minReturnAmountAfterFee) {
            revert MoxieBondingCurve_SlippageExceedsLimit();
        }

        emit SubjectSharePurchased(
            _subject, address(token), _depositAmount, msg.sender, address(_subjectToken), shares_, _onBehalfOf
        );
    }

    /**
     * @dev Internal function to sell  shares of subject.
     * @param _subjectToken Address of Subject Token.
     * @param _sellAmount Amount of shares to sell.
     * @param _onBehalfOf Address of beneficiary where funds will be returned.
     * @param _minReturnAmountAfterFee Minimum amount of funds that should be returned.
     * @param _subject Address of subject.
     * @param _subjectReserveRatio Subject Reserve ratio.
     * @param _orderReferrer Address of order referrer.
     */
    function _sellShares(
        IERC20Extended _subjectToken,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _subject,
        uint32 _subjectReserveRatio,
        address _orderReferrer
    ) internal returns (uint256 returnedAmount_) {
        uint256 subjectReserve = vault.balanceOf(address(_subjectToken), address(token));

        uint256 returnAmountWithoutFee =
            formula.calculateSaleReturn(_subjectToken.totalSupply(), subjectReserve, _subjectReserveRatio, _sellAmount);

        (uint256 protocolFee, uint256 subjectFee) = _calculateSellSideFee(returnAmountWithoutFee);

        returnedAmount_ = returnAmountWithoutFee - subjectFee - protocolFee;
        if (returnedAmount_ < _minReturnAmountAfterFee) {
            revert MoxieBondingCurve_SlippageExceedsLimit();
        }
        emit SubjectShareSold(
            _subject, address(_subjectToken), _sellAmount, msg.sender, address(token), returnedAmount_, _onBehalfOf
        );

        // burn subjectToken
        _subjectToken.burnFrom(msg.sender, _sellAmount);

        vault.transfer(address(_subjectToken), address(token), address(this), returnAmountWithoutFee);

        _processFeeForBuySell(_subject, subjectFee, protocolFee, _orderReferrer, false);
        token.safeTransfer(_onBehalfOf, returnedAmount_);
    }

    function _reservesRequiredForGraduation(uint32 _reserveRatio) internal view returns (uint256) {
        return _reserveRatio * graduationMarketCap(_reserveRatio) / PPM;
    }

    /**
     * @dev Internal function to calculate buy side fee.
     * @param _depositAmount Deposit amount for buy.
     * @return protocolFee_ Buy side protocol fee in PCT_BASE.
     * @return subjectFee_  Buy side subject fee in PCT_BASE.
     */
    function _calculateBuySideFee(uint256 _depositAmount)
        internal
        view
        returns (uint256 protocolFee_, uint256 subjectFee_)
    {
        protocolFee_ = (_depositAmount * protocolBuyFeePct) / PCT_BASE;
        subjectFee_ = (_depositAmount * subjectBuyFeePct) / PCT_BASE;
    }

    /**
     * @dev Internal function to calculate sell side fee.
     * @param _sellAmount Amount of subject shares to sell.
     * @return protocolFee_ Sell side protocol fee in PCT_BASE.
     * @return subjectFee_ Sell side subject fee in PCT_BASE.
     */
    function _calculateSellSideFee(uint256 _sellAmount)
        internal
        view
        returns (uint256 protocolFee_, uint256 subjectFee_)
    {
        protocolFee_ = (_sellAmount * protocolSellFeePct) / PCT_BASE;
        subjectFee_ = (_sellAmount * subjectSellFeePct) / PCT_BASE;
    }

    function _whenNotGraduated(address _subject) internal view {
        // check that the subject is not already graduated
        if (subjectGraduated(_subject)) revert MoxieBondingCurve_SubjectAlreadyGraduated();
        // check that the subject is currently not above the graduation market cap after the contract upgrade
        if (_canGraduate(_subject)) {
            revert MoxieBondingCurve_SubjectReadyForGraduation();
        }
    }

    function _canGraduate(address _subject) internal view returns (bool) {
        uint32 subjectReserveRatio = reserveRatio[_subject];
        address subjectToken = tokenManager.tokens(_subject);
        uint256 currentReserves = vault.balanceOf(subjectToken, address(token));
        return currentReserves >= _reservesRequiredForGraduation(subjectReserveRatio);
    }

    function _sellSharesInternal(
        address _subject,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) internal returns (uint256 returnAmount_) {
        // if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();
        if (_sellAmount == 0) revert MoxieBondingCurve_InvalidSellAmount();

        uint32 subjectReserveRatio = reserveRatio[_subject];

        if (subjectReserveRatio == 0) {
            revert MoxieBondingCurve_SubjectNotInitialized();
        }

        IERC20Extended subjectToken = IERC20Extended(tokenManager.tokens(_subject));

        if (_isZeroAddress(address(subjectToken))) {
            revert MoxieBondingCurve_InvalidSubjectToken();
        }

        if (!subjectGraduated(_subject)) {
            if (_canGraduate(_subject)) {
                _graduateSubject(_subject, 0, address(0), 0);
            } else {
                return _sellShares(
                    subjectToken,
                    _sellAmount,
                    _onBehalfOf,
                    _minReturnAmountAfterFee,
                    _subject,
                    subjectReserveRatio,
                    _orderReferrer
                );
            }
        }
        return _swap(
            _subject,
            false,
            _sellAmount,
            _minReturnAmountAfterFee,
            _onBehalfOf
        );
    }

    function _buySharesInternal(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) internal returns (uint256 shares_) {
        // if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();
        if (_depositAmount == 0) {
            revert MoxieBondingCurve_InvalidDepositAmount();
        }

        uint32 subjectReserveRatio = reserveRatio[_subject];

        if (subjectReserveRatio == 0) {
            revert MoxieBondingCurve_SubjectNotInitialized();
        }

        IERC20Extended subjectToken = IERC20Extended(tokenManager.tokens(_subject));

        if (!subjectGraduated(_subject)) {
            shares_ = _buyShares(
                subjectToken,
                _depositAmount,
                _onBehalfOf,
                _minReturnAmountAfterFee,
                _subject,
                subjectReserveRatio,
                _orderReferrer
            );
        } else {
            shares_ = _swap(
                _subject,
                true,
                _depositAmount,
                _minReturnAmountAfterFee,
                _onBehalfOf
            );
        }
    }

    /**
     * @notice Validates Subject Input
     * @param _subject  Address of subject
     * @param _subjectTokenAmount Amount of buy/sell estimates.
     * @return subjectReserveRatio_ Reserve ratio of subject.
     * @return subjectReserve_ Total reserve of Subject.
     * @return subjectSupply_ Total supply of subject token.
     */
    function _validateSubjectInput(address _subject, uint256 _subjectTokenAmount)
        internal
        view
        returns (uint32 subjectReserveRatio_, uint256 subjectReserve_, uint256 subjectSupply_)
    {
        // if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();
        if (_subjectTokenAmount == 0) revert MoxieBondingCurve_InvalidAmount();

        subjectReserveRatio_ = reserveRatio[_subject];

        if (subjectReserveRatio_ == 0) {
            revert MoxieBondingCurve_SubjectNotInitialized();
        }

        IERC20Extended subjectToken = IERC20Extended(tokenManager.tokens(_subject));

        subjectReserve_ = vault.balanceOf(address(subjectToken), address(token));

        subjectSupply_ = subjectToken.totalSupply();
    }

    function updateProtocolRewardAddress(address _protocolRewardsAddress)
        external
        onlyRole(UPDATE_PROTOCOL_REWARD_ROLE)
    {
        if (_isZeroAddress(_protocolRewardsAddress)) {
            revert MoxieBondingCurve_InvalidProtocolRewardAddress();
        }
        protocolRewards = IProtocolRewards(_protocolRewardsAddress);
    }

    function updateDefaultGraduationMarketCap(uint256 _defaultGraduationMarketCap) external onlyRole(UPDATE_GRADUATION_MARKET_CAP_ROLE) {
        emit DefaultGraduationMarketCapUpdated(defaultGraduationMarketCap, _defaultGraduationMarketCap);
        defaultGraduationMarketCap = _defaultGraduationMarketCap;
    }

    function updateGraduationMarketCap(uint32 _reserveRatio, uint256 _newGraduationMarketCap) external onlyRole(UPDATE_GRADUATION_MARKET_CAP_ROLE) {
        uint256 oldGraduationMarketCap = graduationMarketCap(_reserveRatio);
        graduationMarketCapOverrides[_reserveRatio] = _newGraduationMarketCap;
        emit GraduationMarketCapUpdated(_reserveRatio, oldGraduationMarketCap, defaultGraduationMarketCap, _newGraduationMarketCap == 0);
    }

    /**
     * @notice Update fee only be called by role UPDATE_FEES_ROLE.
     * @param _feeInput Fee input struct.
     */
    function updateFees(FeeInput memory _feeInput) external onlyRole(UPDATE_FEES_ROLE) {
        _validateFee(_feeInput);

        _updateFees(
            _feeInput.protocolBuyFeePct,
            _feeInput.protocolSellFeePct,
            _feeInput.subjectBuyFeePct,
            _feeInput.subjectSellFeePct,
            _feeInput.swapFeeRatioProtocolPct
        );
    }

    /**
     * @notice Update referral fees.
     * @param _platformReferrerBuyFeePct Platform referrer buy fee percentage.
     * @param _platformReferrerSellFeePct Platform referrer sell fee percentage.
     * @param _orderReferrerBuyFeePct Order referrer buy fee percentage.
     * @param _orderReferrerSellFeePct Order referrer sell fee percentage.
     */

    function updateReferralFee(
        uint256 _platformReferrerBuyFeePct,
        uint256 _platformReferrerSellFeePct,
        uint256 _orderReferrerBuyFeePct,
        uint256 _orderReferrerSellFeePct
    ) external onlyRole(UPDATE_FEES_ROLE) {
        if (
            !_feeIsValid(_platformReferrerBuyFeePct + _orderReferrerBuyFeePct)
                || !_feeIsValid(_platformReferrerSellFeePct + _orderReferrerSellFeePct)
        ) revert MoxieBondingCurve_InvalidFeePercentage();

        platformReferrerBuyFeePct = _platformReferrerBuyFeePct;
        platformReferrerSellFeePct = _platformReferrerSellFeePct;
        orderReferrerBuyFeePct = _orderReferrerBuyFeePct;
        orderReferrerSellFeePct = _orderReferrerSellFeePct;

        emit UpdateReferralFees(
            platformReferrerBuyFeePct, platformReferrerSellFeePct, orderReferrerBuyFeePct, orderReferrerSellFeePct
        );
    }

    /**
     * @notice Pause or unpause trading for a specific subject.
     * @param _subject Address of the subject to pause or unpause trading for.
     * @param _pause True to pause trading, false to unpause trading.
     */
    function pauseTrading(
        address _subject,
        bool _pause
    ) external onlyRole(UPDATE_RESERVE_RATIO) {

        uint32 subjectReserveRatio = reserveRatio[_subject];

        if (subjectReserveRatio == 0) {
            revert MoxieBondingCurve_SubjectNotInitialized();
        }

        if (_pause) lastPaused[_subject] = block.timestamp;
        else lastPaused[_subject] = 0;

        emit TradingPaused(_subject, _pause);
    }
    /**
     * @dev Allow updation of reserve ratio by determined by DAO for specific subject.
     * @param _subject Address of subject.
     * @param _newReserveRatio new Reserve ratio. 
     */
    function updateReserveRatio(
        address _subject,
        uint32 _newReserveRatio
    ) external onlyRole(UPDATE_RESERVE_RATIO) {

         if (lastPaused[_subject] == 0) 
              revert MoxieBondingCurve_SubjectNotPaused();

        uint32 currentReserveRatio = reserveRatio[_subject];

        if (currentReserveRatio == 0) {
            revert MoxieBondingCurve_SubjectNotInitialized();
        }

        if ( _newReserveRatio == 0 || !_reserveRatioIsValid(_newReserveRatio)) {
            revert MoxieBondingCurve_InvalidReserveRation();
        }

        reserveRatio[_subject] = _newReserveRatio;

        emit SubjectReserveRatioUpdated(
            _subject,
            currentReserveRatio,
            _newReserveRatio
        );
    }

    /**
     * @notice Update formula to `_formula`. It can be done by UPDATE_FORMULA_ROLE.
     * @param _formula The address of the new BancorFormula [computation] contract
     */
    function updateFormula(address _formula) external onlyRole(UPDATE_FORMULA_ROLE) {
        if (_isZeroAddress(_formula)) revert MoxieBondingCurve_InvalidFormula();

        _updateFormula(IBancorFormula(_formula));
    }

    /**
     * @notice Update beneficiary to `_beneficiary. It can be done by UPDATE_BENEFICIARY_ROLE.
     * @param _feeBeneficiary The address of the new beneficiary [to whom fees are to be sent]
     */
    function updateFeeBeneficiary(address _feeBeneficiary) external onlyRole(UPDATE_BENEFICIARY_ROLE) {
        if (_isZeroAddress(_feeBeneficiary)) {
            revert MoxieBondingCurve_InvalidBeneficiary();
        }

        _updateFeeBeneficiary(_feeBeneficiary);
    }

    /**
     * @notice Initialize Bonding curve for subject, it's called by subject factory.
     * @dev Should the initial reserve already exceed the graduation market cap, graduate the subject automatically.
     * @param _subject Address of subject.
     * @param _initialSupply Initial supply of subjects tokens at the time of bonding curve initialization.
     * @param _reserveRatio reserve ratio of subject for bonding curve.
     * @param _reserveAmount Initial reserve amount.
     */
    function initializeSubjectBondingCurve(
        address _subject,
        uint32 _reserveRatio,
        uint256 _initialSupply,
        uint256 _reserveAmount,
        address _platformReferrer
    ) external whenNotPaused returns (bool) {
        if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();

        if (msg.sender != subjectFactory) {
            revert MoxieBondingCurve_OnlySubjectFactory();
        }

        if (!_reserveRatioIsValid(_reserveRatio)) {
            revert MoxieBondingCurve_InvalidReserveRation();
        }

        if (reserveRatio[_subject] != 0) {
            revert MoxieBondingCurve_SubjectAlreadyInitialized();
        }
        reserveRatio[_subject] = _reserveRatio;
        platformReferrer[_subject] = _platformReferrer;

        address subjectToken = tokenManager.tokens(_subject);

        if (_isZeroAddress(subjectToken)) {
            revert MoxieBondingCurve_InvalidSubjectToken();
        }

        emit BondingCurveInitialized(_subject, subjectToken, _initialSupply, _reserveAmount, _reserveRatio);
        uint256 supply = IERC20Extended(subjectToken).totalSupply();
        if (_initialSupply != supply) {
            revert MoxieBondingCurve_InvalidSubjectSupply();
        }

        token.safeTransferFrom(msg.sender, address(this), _reserveAmount);
        token.approve(address(vault), _reserveAmount);
        vault.deposit(subjectToken, address(token), _reserveAmount);

        if (_canGraduate(_subject)) {
            _graduateSubject(_subject, 0, address(0), 0);
        }

        return true;
    }

    /**
     * @dev Buy shares of subject.
     * @param _subject Address of subject.
     * @param _depositAmount Deposit amount to buy shares.
     * @param _onBehalfOf  Beneficiary where shares will be minted.
     * @param _minReturnAmountAfterFee Minimum shares that must be returned.
     */
    function buySharesFor(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) external whenNotPaused whenNotTradingPaused(_subject) returns (uint256 shares_) {
        shares_ = _buySharesInternal(_subject, _depositAmount, _onBehalfOf, _minReturnAmountAfterFee, address(0));
    }

    /**
     * @dev Buy shares of subject.
     * @param _subject Address of subject.
     * @param _depositAmount Deposit amount to buy shares.
     * @param _minReturnAmountAfterFee Minimum shares that must be returned.
     */
    function buyShares(address _subject, uint256 _depositAmount, uint256 _minReturnAmountAfterFee)
        external
        whenNotPaused
        whenNotTradingPaused(_subject)
        returns (uint256 shares_) {
        shares_ = _buySharesInternal(_subject, _depositAmount, msg.sender, _minReturnAmountAfterFee, address(0));
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _onBehalfOf Address of buy token beneficiary.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned.
     */
    function sellSharesFor(address _subject, uint256 _sellAmount, address _onBehalfOf, uint256 _minReturnAmountAfterFee)
        external
        whenNotPaused
        whenNotTradingPaused(_subject)
        returns (uint256 returnAmount_) {
        returnAmount_ = _sellSharesInternal(_subject, _sellAmount, _onBehalfOf, _minReturnAmountAfterFee, address(0));
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned.
     */
    function sellShares(address _subject, uint256 _sellAmount, uint256 _minReturnAmountAfterFee)
        external
        whenNotPaused
        whenNotTradingPaused(_subject)
        returns (uint256 returnAmount_) {
        returnAmount_ = _sellSharesInternal(_subject, _sellAmount, msg.sender, _minReturnAmountAfterFee, address(0));
    }

    /**
     * @dev Buy shares of subject.
     * @param _subject Address of subject.
     * @param _depositAmount Deposit amount to buy shares.
     * @param _onBehalfOf  Beneficiary where shares will be minted.
     * @param _minReturnAmountAfterFee Minimum shares that must be returned.
     * @param _orderReferrer Address of order referrer.
     */
    function buySharesForV2(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) external whenNotPaused whenNotTradingPaused(_subject) returns (uint256 shares_) {
        shares_ = _buySharesInternal(_subject, _depositAmount, _onBehalfOf, _minReturnAmountAfterFee, _orderReferrer);
    }

    /**
     * @dev Buy shares of subject.
     * @param _subject Address of subject.
     * @param _depositAmount Deposit amount to buy shares.
     * @param _minReturnAmountAfterFee Minimum shares that must be returned.
     * @param _orderReferrer Address of order referrer.
     */
    function buySharesV2(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) external whenNotPaused whenNotTradingPaused(_subject) returns (uint256 shares_) {
        shares_ = _buySharesInternal(_subject, _depositAmount, msg.sender, _minReturnAmountAfterFee, _orderReferrer);
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _onBehalfOf Address of buy token beneficiary.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned.
     * @param _orderReferrer Address of order referrer.
     */
    function sellSharesForV2(
        address _subject,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) external whenNotPaused whenNotTradingPaused(_subject) returns (uint256 returnAmount_) {
        returnAmount_ =
            _sellSharesInternal(_subject, _sellAmount, _onBehalfOf, _minReturnAmountAfterFee, _orderReferrer);
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned
     * @param _orderReferrer Address of order referrer.
     */
    function sellSharesV2(
        address _subject,
        uint256 _sellAmount,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) external whenNotPaused whenNotTradingPaused(_subject) returns (uint256 returnAmount_) {
        returnAmount_ = _sellSharesInternal(_subject, _sellAmount, msg.sender, _minReturnAmountAfterFee, _orderReferrer);
    }

    /**
     * @notice Estimates amount of Moxie token required to buy given subject token amount
     * @param _subject  Address of subject.
     * @param _subjectTokenAmount  Amount of subject tokens.
     */
    function calculateTokensForBuy(address _subject, uint256 _subjectTokenAmount)
        external
        view
        returns (uint256 moxieAmount_, uint256 protocolFee_, uint256 subjectFee_)
    {
        _whenNotGraduated(_subject);
        (uint32 subjectReserveRatio_, uint256 subjectReserve_, uint256 subjectSupply_) =
            _validateSubjectInput(_subject, _subjectTokenAmount);

        uint256 estimatedAmount =
            formula.calculateFundCost(subjectSupply_, subjectReserve_, subjectReserveRatio_, _subjectTokenAmount);

        uint256 totalFeePCT = protocolBuyFeePct + subjectBuyFeePct;
        moxieAmount_ = (estimatedAmount * PCT_BASE) / (PCT_BASE - totalFeePCT);

        (protocolFee_, subjectFee_) = _calculateBuySideFee(moxieAmount_);
    }

    /**
     * @notice Estimates amount of Moxie tokes will be returned after selling given subject tokens.
     * @param _subject  Address of subject.
     * @param _subjectTokenAmount  Amount of subject tokens.
     */
    function calculateTokensForSell(address _subject, uint256 _subjectTokenAmount)
        external
        view
        returns (uint256 moxieAmount_, uint256 protocolFee_, uint256 subjectFee_)
    {
        _whenNotGraduated(_subject);
        (uint32 subjectReserveRatio_, uint256 subjectReserve_, uint256 subjectSupply_) =
            _validateSubjectInput(_subject, _subjectTokenAmount);

        uint256 estimatedAmount =
            formula.calculateSaleReturn(subjectSupply_, subjectReserve_, subjectReserveRatio_, _subjectTokenAmount);

        (protocolFee_, subjectFee_) = _calculateSellSideFee(estimatedAmount);

        moxieAmount_ = estimatedAmount - protocolFee_ - subjectFee_;
    }

    function graduationMarketCap(uint32 _reserveRatio) public view returns (uint256) {
        uint256 graduationMarketCapOverride = graduationMarketCapOverrides[_reserveRatio];
        return graduationMarketCapOverride == 0 ? defaultGraduationMarketCap : graduationMarketCapOverride;
    }


    /**
     * @notice Distribute the swap fees for a graduated subject.
     * @dev Subject tokens are burned, moxie is divided between the protocol and the subject.
     * @param _subject Subject address.
     */
    function distributeSwapFee(address _subject) external {
        if (!subjectGraduated(_subject)) revert MoxieBondingCurve_SubjectNotGraduated();
        uint256 tokenId = subjectTokenId[_subject];

        (PoolKey memory key, ) = positionManager.getPoolAndPositionInfo(tokenId);

        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);    
        (address moxie, address subjectToken) =  token0 == address(token) ? (token0, token1) : (token1, token0);
       
        uint256 subjectTokenBalanceBefore = _balanceOf(subjectToken, address(this));
        uint256 moxieBalanceBefore = _balanceOf(moxie, address(this));
        bytes[] memory params = new bytes[](2);
        // decreasing liquidity with 0 amount just claims fees without actually decreasing liquidity
        params[0] = abi.encode(tokenId, 0, 0, 0, "");
        params[1] = abi.encode(token0, token1, address(this));

        positionManager.modifyLiquidities(
            abi.encode(
                abi.encodePacked(
                    uint8(Actions.DECREASE_LIQUIDITY),
                    uint8(Actions.TAKE_PAIR)
                ),
                params
            ),
            block.timestamp
        );

        uint256 subjectTokenAmount = _balanceOf(subjectToken, address(this)) - subjectTokenBalanceBefore;
        IERC20Extended(subjectToken).burn(subjectTokenAmount);

        uint256 moxieAmount = _balanceOf(moxie, address(this)) - moxieBalanceBefore;

        address[] memory recipients = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        bytes4[] memory reasons = new bytes4[](2);

        recipients[0] = feeBeneficiary;
        amounts[0] = moxieAmount * swapFeeRatioProtocolPct / PCT_BASE;
        reasons[0] = bytes4(keccak256("PROTOCOL_FEE"));

        recipients[1] = _subject;
        amounts[1] = moxieAmount - amounts[0];
        reasons[1] = bytes4(keccak256("SWAP_FEE"));
        
        IERC20Extended(moxie).approve(address(protocolRewards), moxieAmount);
        protocolRewards.depositBatch(recipients, amounts, reasons, "SWAP_FEE");
    }

    function _balanceOf(address _token, address _account) internal view returns (uint256) {
        return IERC20Extended(_token).balanceOf(_account);
    }
}
