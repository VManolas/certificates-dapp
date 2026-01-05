// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title IAuthVerifier
 * @notice Interface for the Noir-generated ZK verifier contract
 * @dev Will be replaced with actual verifier after circuit compilation
 */
interface IAuthVerifier {
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external returns (bool);
}

/**
 * @title ZKAuthRegistry
 * @notice Privacy-preserving authentication registry for zkCredentials
 * @dev Users register commitments and authenticate via zero-knowledge proofs
 * 
 * Features:
 * - Commitment-based registration (no wallet address revealed at registration)
 * - ZK-proof authentication (proves knowledge without revealing secrets)
 * - Session management with expiry
 * - Role-based access control
 * - UUPS upgradeable
 * 
 * Security:
 * - Private keys never touch the blockchain
 * - Wallet addresses only revealed when user chooses
 * - Poseidon/Pedersen hash for ZK-friendly commitments
 * - Session tokens expire after 24 hours
 */
contract ZKAuthRegistry is 
    Initializable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable 
{
    /// @notice Contract version
    string public constant VERSION = "1.0.0";
    
    /// @notice Admin role for contract management
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    /// @notice Verifier contract for ZK proofs
    IAuthVerifier public authVerifier;
    
    /// @notice User roles in the system
    enum UserRole { 
        None,       // 0: No role assigned
        Student,    // 1: Student user
        Employer    // 2: Employer
    }
    
    /// @notice Session data structure
    struct Session {
        bytes32 commitment;
        uint256 expiry;
        bool active;
    }
    
    /// @notice Mapping: commitment => registered
    mapping(bytes32 => bool) public commitments;
    
    /// @notice Mapping: commitment => user role
    mapping(bytes32 => UserRole) public roles;
    
    /// @notice Mapping: sessionId => session data
    mapping(bytes32 => Session) public sessions;
    
    /// @notice Mapping: commitment => registration timestamp
    mapping(bytes32 => uint256) public registrationTime;
    
    /// @notice Session duration (24 hours)
    uint256 public constant SESSION_DURATION = 24 hours;
    
    // Events
    event CommitmentRegistered(
        bytes32 indexed commitment, 
        UserRole role, 
        uint256 timestamp
    );
    
    event SessionStarted(
        bytes32 indexed sessionId, 
        bytes32 indexed commitment, 
        uint256 expiry
    );
    
    event SessionEnded(
        bytes32 indexed sessionId
    );
    
    event VerifierUpdated(
        address indexed oldVerifier, 
        address indexed newVerifier
    );
    
    // Custom Errors
    error CommitmentAlreadyExists();
    error CommitmentNotFound();
    error InvalidProof();
    error InvalidRole();
    error SessionExpired();
    error SessionNotFound();
    error UnauthorizedRole();
    error InvalidAddress();
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param admin Address of the initial admin
     * @param _authVerifier Address of the ZK verifier contract
     */
    function initialize(
        address admin,
        address _authVerifier
    ) public initializer {
        if (admin == address(0)) revert InvalidAddress();
        if (_authVerifier == address(0)) revert InvalidAddress();
        
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        authVerifier = IAuthVerifier(_authVerifier);
    }
    
    /**
     * @notice Register a new commitment with role
     * @param commitment Hash(publicKey, walletAddress, salt)
     * @param role User role (Student or Employer only)
     * @param proof ZK proof of commitment ownership
     * @dev Users prove they know the private key for the commitment
     * @dev Only Student and Employer roles can use ZK authentication
     */
    function registerCommitment(
        bytes32 commitment,
        UserRole role,
        bytes calldata proof
    ) external {
        // Validate inputs
        if (commitments[commitment]) revert CommitmentAlreadyExists();
        if (role == UserRole.None) revert InvalidRole();
        
        // Security: Only Student and Employer roles allowed for ZK auth
        // Admins and Universities use Web3 authentication only
        if (role != UserRole.Student && role != UserRole.Employer) {
            revert InvalidRole();
        }
        
        // Verify ZK proof
        // The proof proves: "I know privateKey and walletAddress such that
        // commitment = hash(hash(privateKey), walletAddress, salt)"
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = commitment;
        if (!authVerifier.verify(proof, publicInputs)) {
            revert InvalidProof();
        }
        
        // Register commitment
        commitments[commitment] = true;
        roles[commitment] = role;
        registrationTime[commitment] = block.timestamp;
        
        emit CommitmentRegistered(commitment, role, block.timestamp);
    }
    
    /**
     * @notice Start authenticated session with ZK proof
     * @param commitment User's commitment
     * @param proof ZK proof of ownership
     * @return sessionId Unique session identifier
     * @dev Users authenticate without revealing wallet or private key
     */
    function startSession(
        bytes32 commitment,
        bytes calldata proof
    ) external returns (bytes32 sessionId) {
        // Verify commitment is registered
        if (!commitments[commitment]) revert CommitmentNotFound();
        
        // Verify ZK proof of ownership
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = commitment;
        if (!authVerifier.verify(proof, publicInputs)) {
            revert InvalidProof();
        }
        
        // Generate unique session ID
        sessionId = keccak256(
            abi.encodePacked(
                commitment, 
                block.timestamp, 
                msg.sender,
                blockhash(block.number - 1)
            )
        );
        
        // Create session
        uint256 expiry = block.timestamp + SESSION_DURATION;
        sessions[sessionId] = Session({
            commitment: commitment,
            expiry: expiry,
            active: true
        });
        
        emit SessionStarted(sessionId, commitment, expiry);
        
        return sessionId;
    }
    
    /**
     * @notice End an active session (logout)
     * @param sessionId Session to terminate
     */
    function endSession(bytes32 sessionId) external {
        Session storage session = sessions[sessionId];
        if (!session.active) revert SessionNotFound();
        
        session.active = false;
        
        emit SessionEnded(sessionId);
    }
    
    /**
     * @notice Validate a session
     * @param sessionId Session to validate
     * @return isValid True if session is active and not expired
     * @return role User's role
     * @return commitment User's commitment
     */
    function validateSession(bytes32 sessionId) 
        external 
        view 
        returns (
            bool isValid,
            UserRole role,
            bytes32 commitment
        ) 
    {
        Session storage session = sessions[sessionId];
        
        if (!session.active) {
            return (false, UserRole.None, bytes32(0));
        }
        
        if (block.timestamp > session.expiry) {
            return (false, UserRole.None, bytes32(0));
        }
        
        commitment = session.commitment;
        role = roles[commitment];
        isValid = true;
        
        return (isValid, role, commitment);
    }
    
    /**
     * @notice Get role for a commitment
     * @param commitment User's commitment
     * @return User's role
     */
    function getRole(bytes32 commitment) 
        external 
        view 
        returns (UserRole) 
    {
        return roles[commitment];
    }
    
    /**
     * @notice Check if commitment is registered
     * @param commitment Commitment to check
     * @return True if registered
     */
    function isRegistered(bytes32 commitment) 
        external 
        view 
        returns (bool) 
    {
        return commitments[commitment];
    }
    
    /**
     * @notice Get session info
     * @param sessionId Session to query
     * @return Session struct
     */
    function getSession(bytes32 sessionId) 
        external 
        view 
        returns (Session memory) 
    {
        return sessions[sessionId];
    }
    
    /**
     * @notice Update the verifier contract
     * @param newVerifier Address of new verifier
     * @dev Only admin can update
     */
    function setVerifier(address newVerifier) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (newVerifier == address(0)) revert InvalidAddress();
        
        address oldVerifier = address(authVerifier);
        authVerifier = IAuthVerifier(newVerifier);
        
        emit VerifierUpdated(oldVerifier, newVerifier);
    }
    
    /**
     * @notice Authorize contract upgrade
     * @param newImplementation Address of new implementation
     * @dev Only admin can upgrade
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(ADMIN_ROLE) 
    {}
    
    /**
     * @notice Storage gap for future upgrades
     * @dev Reserves 50 slots
     */
    uint256[50] private __gap;
}

