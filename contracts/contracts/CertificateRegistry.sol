// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/ICertificateRegistry.sol";
import "./interfaces/IInstitutionRegistry.sol";

/**
 * @title CertificateRegistry
 * @notice Manages educational certificates on zkSync Era
 * @dev Implements UUPS upgradeable pattern with role-based access control
 * 
 * Features:
 * - Issue certificates with SHA-256 document hash
 * - Revoke certificates with reason
 * - Query certificates by ID, hash, or student
 * - Verify certificate validity
 * 
 * Security:
 * - Only verified and active institutions can issue certificates
 * - Only issuing institution or super admin can revoke
 * - Reentrancy protection on state-changing functions
 * - Duplicate hash prevention
 */
contract CertificateRegistry is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    ICertificateRegistry
{
    /// @notice Contract version for tracking upgrades
    string public constant VERSION = "1.0.0";

    /// @notice Role identifier for super admin
    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");

    /// @notice Struct to track contract upgrades
    struct UpgradeInfo {
        string version;
        uint256 timestamp;
        address upgrader;
        string notes;
    }

    /// @notice Reference to the InstitutionRegistry contract
    IInstitutionRegistry public institutionRegistry;

    /// @notice Mapping from certificate ID to certificate data
    mapping(uint256 => Certificate) public certificates;

    /// @notice Mapping from student wallet to their certificate IDs
    mapping(address => uint256[]) public studentCertificates;

    /// @notice Mapping from document hash to certificate ID
    mapping(bytes32 => uint256) public hashToCertificateId;

    /// @notice Counter for generating unique certificate IDs
    uint256 internal _certificateIdCounter;

    /// @notice Array tracking all contract upgrades
    UpgradeInfo[] public upgradeHistory;

    // Custom Errors
    error UnauthorizedIssuer();
    error CertificateAlreadyExists();
    error CertificateNotFound();
    error CertificateAlreadyRevoked();
    error NotCertificateIssuer();
    error InvalidStudentAddress();
    error InvalidDocumentHash();
    error InvalidAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param superAdmin Address of the super admin
     * @param _institutionRegistry Address of the InstitutionRegistry contract
     */
    function initialize(
        address superAdmin,
        address _institutionRegistry
    ) public initializer {
        if (superAdmin == address(0)) revert InvalidAddress();
        if (_institutionRegistry == address(0)) revert InvalidAddress();

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, superAdmin);
        _grantRole(SUPER_ADMIN_ROLE, superAdmin);

        institutionRegistry = IInstitutionRegistry(_institutionRegistry);
        _certificateIdCounter = 1; // Start from 1 so 0 means "not found"

        // Record initial version
        upgradeHistory.push(UpgradeInfo({
            version: VERSION,
            timestamp: block.timestamp,
            upgrader: msg.sender,
            notes: "Initial deployment"
        }));
    }

    /**
     * @notice Issue a new certificate
     * @param documentHash SHA-256 hash of the PDF document
     * @param studentWallet Wallet address of the student receiving the certificate
     * @param metadataURI Optional IPFS/Arweave URI for additional metadata
     * @return certificateId The unique ID of the issued certificate
     * @dev Only callable by verified and active institutions
     */
    function issueCertificate(
        bytes32 documentHash,
        address studentWallet,
        string calldata metadataURI
    ) external nonReentrant returns (uint256) {
        // Validate inputs
        if (studentWallet == address(0)) revert InvalidStudentAddress();
        if (documentHash == bytes32(0)) revert InvalidDocumentHash();

        // Check institution authorization
        if (!institutionRegistry.canIssueCertificates(msg.sender))
            revert UnauthorizedIssuer();

        // Check for duplicate hash
        if (hashToCertificateId[documentHash] != 0)
            revert CertificateAlreadyExists();

        // Generate unique certificate ID
        uint256 certificateId = _certificateIdCounter++;

        // Store certificate
        certificates[certificateId] = Certificate({
            documentHash: documentHash,
            studentWallet: studentWallet,
            issuingInstitution: msg.sender,
            issueDate: block.timestamp,
            certificateId: certificateId,
            metadataURI: metadataURI,
            isRevoked: false,
            revokedAt: 0,
            revocationReason: ""
        });

        // Update mappings
        studentCertificates[studentWallet].push(certificateId);
        hashToCertificateId[documentHash] = certificateId;

        // Update institution stats
        institutionRegistry.incrementCertificateCount(msg.sender);

        emit CertificateIssued(
            certificateId,
            documentHash,
            studentWallet,
            msg.sender,
            block.timestamp
        );

        return certificateId;
    }

    /**
     * @notice Revoke a certificate
     * @param certificateId The ID of the certificate to revoke
     * @param reason The reason for revocation
     * @dev Only callable by the issuing institution or super admin
     */
    function revokeCertificate(
        uint256 certificateId,
        string calldata reason
    ) external nonReentrant {
        Certificate storage cert = certificates[certificateId];

        // Validate certificate exists
        if (cert.certificateId == 0) revert CertificateNotFound();

        // Check if already revoked
        if (cert.isRevoked) revert CertificateAlreadyRevoked();

        // Check authorization (issuer or super admin)
        if (
            cert.issuingInstitution != msg.sender &&
            !hasRole(SUPER_ADMIN_ROLE, msg.sender)
        ) revert NotCertificateIssuer();

        // Revoke certificate
        cert.isRevoked = true;
        cert.revokedAt = block.timestamp;
        cert.revocationReason = reason;

        emit CertificateRevoked(
            certificateId,
            msg.sender,
            reason,
            block.timestamp
        );
    }

    /**
     * @notice Get certificate by ID
     * @param certificateId The ID of the certificate
     * @return Certificate struct with all details
     */
    function getCertificate(
        uint256 certificateId
    ) external view returns (Certificate memory) {
        if (certificates[certificateId].certificateId == 0)
            revert CertificateNotFound();
        return certificates[certificateId];
    }

    /**
     * @notice Get certificate by document hash
     * @param documentHash The SHA-256 hash of the document
     * @return Certificate struct with all details
     */
    function getCertificateByHash(
        bytes32 documentHash
    ) external view returns (Certificate memory) {
        uint256 certId = hashToCertificateId[documentHash];
        if (certId == 0) revert CertificateNotFound();
        return certificates[certId];
    }

    /**
     * @notice Get all certificate IDs for a student
     * @param studentWallet The wallet address of the student
     * @return Array of certificate IDs
     */
    function getCertificatesByStudent(
        address studentWallet
    ) external view returns (uint256[] memory) {
        return studentCertificates[studentWallet];
    }

    /**
     * @notice Verify if a certificate is valid
     * @param documentHash The SHA-256 hash of the document
     * @return isValid True if the certificate exists and is not revoked
     * @return certificateId The ID of the certificate (0 if not found)
     * @return isRevoked True if the certificate has been revoked
     */
    function isValidCertificate(
        bytes32 documentHash
    ) external view returns (bool isValid, uint256 certificateId, bool isRevoked) {
        certificateId = hashToCertificateId[documentHash];

        // Not found
        if (certificateId == 0) {
            return (false, 0, false);
        }

        Certificate storage cert = certificates[certificateId];
        isRevoked = cert.isRevoked;
        isValid = !isRevoked;

        return (isValid, certificateId, isRevoked);
    }

    /**
     * @notice Get total number of certificates issued
     * @return The total count (counter - 1 since we start from 1)
     */
    function getTotalCertificates() external view returns (uint256) {
        return _certificateIdCounter - 1;
    }

    /**
     * @notice Check if a certificate exists (non-reverting)
     * @param certificateId The ID of the certificate to check
     * @return exists True if the certificate exists, false otherwise
     * @dev More gas-efficient than try-catching getCertificate for existence checks
     */
    function certificateExists(uint256 certificateId) external view returns (bool exists) {
        return certificates[certificateId].certificateId != 0;
    }

    /**
     * @notice Check if a document hash exists (non-reverting)
     * @param documentHash The SHA-256 hash to check
     * @return exists True if a certificate with this hash exists, false otherwise
     * @dev Useful for preventing duplicate certificate issuance
     */
    function hashExists(bytes32 documentHash) external view returns (bool exists) {
        return hashToCertificateId[documentHash] != 0;
    }

    /**
     * @notice Get multiple certificates in a single call (batch read)
     * @param certificateIds Array of certificate IDs to retrieve
     * @return certificates_ Array of Certificate structs
     * @return foundFlags Array of booleans indicating which certificates were found
     * @dev Gas-efficient batch read operation. Returns empty Certificate for not found IDs.
     *      Check foundFlags to determine which certificates are valid.
     */
    function getCertificatesBatch(
        uint256[] calldata certificateIds
    ) external view returns (
        Certificate[] memory certificates_,
        bool[] memory foundFlags
    ) {
        uint256 length = certificateIds.length;
        certificates_ = new Certificate[](length);
        foundFlags = new bool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            uint256 certId = certificateIds[i];
            
            if (certificates[certId].certificateId != 0) {
                certificates_[i] = certificates[certId];
                foundFlags[i] = true;
            } else {
                foundFlags[i] = false;
            }
        }
        
        return (certificates_, foundFlags);
    }

    /**
     * @notice Issue multiple certificates in a single transaction
     * @param documentHashes Array of SHA-256 hashes of the PDF documents
     * @param studentWallets Array of wallet addresses of the students
     * @param metadataURIs Array of optional IPFS/Arweave URIs for additional metadata
     * @return certificateIds Array of unique IDs of the issued certificates
     * @dev Only callable by verified and active institutions
     *      All arrays must have the same length
     *      Gas-efficient batch issuance operation
     *      If any certificate fails validation, the entire transaction reverts
     */
    function issueCertificatesBatch(
        bytes32[] calldata documentHashes,
        address[] calldata studentWallets,
        string[] calldata metadataURIs
    ) external nonReentrant returns (uint256[] memory) {
        // Validate array lengths
        uint256 length = documentHashes.length;
        if (length == 0) revert InvalidDocumentHash();
        if (length != studentWallets.length || length != metadataURIs.length) {
            revert InvalidDocumentHash(); // Reusing error for invalid input
        }

        // Check institution authorization once for the entire batch
        if (!institutionRegistry.canIssueCertificates(msg.sender))
            revert UnauthorizedIssuer();

        // Initialize result array
        uint256[] memory certificateIds = new uint256[](length);

        // Process each certificate
        for (uint256 i = 0; i < length; i++) {
            // Validate inputs
            if (studentWallets[i] == address(0)) revert InvalidStudentAddress();
            if (documentHashes[i] == bytes32(0)) revert InvalidDocumentHash();

            // Check for duplicate hash
            if (hashToCertificateId[documentHashes[i]] != 0)
                revert CertificateAlreadyExists();

            // Generate unique certificate ID
            uint256 certificateId = _certificateIdCounter++;

            // Store certificate
            certificates[certificateId] = Certificate({
                documentHash: documentHashes[i],
                studentWallet: studentWallets[i],
                issuingInstitution: msg.sender,
                issueDate: block.timestamp,
                certificateId: certificateId,
                metadataURI: metadataURIs[i],
                isRevoked: false,
                revokedAt: 0,
                revocationReason: ""
            });

            // Update mappings
            studentCertificates[studentWallets[i]].push(certificateId);
            hashToCertificateId[documentHashes[i]] = certificateId;

            // Update institution stats
            institutionRegistry.incrementCertificateCount(msg.sender);

            // Emit event
            emit CertificateIssued(
                certificateId,
                documentHashes[i],
                studentWallets[i],
                msg.sender,
                block.timestamp
            );

            // Store ID in result array
            certificateIds[i] = certificateId;
        }

        return certificateIds;
    }

    /**
     * @notice Get certificates issued by a specific institution
     * @param institution The wallet address of the institution
     * @param offset Starting index for pagination
     * @param limit Maximum number of results to return
     * @return certificateIds Array of certificate IDs
     * @return total Total number of certificates for this institution
     * @dev Iterates through all certificates (gas intensive for large datasets)
     *      Consider using The Graph for efficient queries in production
     */
    function getCertificatesByInstitution(
        address institution,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory certificateIds, uint256 total) {
        // First pass: count total
        uint256 count = 0;
        for (uint256 i = 1; i < _certificateIdCounter; i++) {
            if (certificates[i].issuingInstitution == institution) {
                count++;
            }
        }

        total = count;

        // Handle pagination
        if (offset >= count) {
            return (new uint256[](0), total);
        }

        uint256 resultCount = limit;
        if (offset + limit > count) {
            resultCount = count - offset;
        }

        certificateIds = new uint256[](resultCount);

        // Second pass: collect results
        uint256 found = 0;
        uint256 added = 0;
        for (uint256 i = 1; i < _certificateIdCounter && added < resultCount; i++) {
            if (certificates[i].issuingInstitution == institution) {
                if (found >= offset) {
                    certificateIds[added] = i;
                    added++;
                }
                found++;
            }
        }

        return (certificateIds, total);
    }

    /**
     * @notice Get current contract version
     * @return Current version string
     */
    function getVersion() public pure virtual returns (string memory) {
        return VERSION;
    }

    /**
     * @notice Get complete upgrade history
     * @return Array of all UpgradeInfo structs
     */
    function getUpgradeHistory() external view returns (UpgradeInfo[] memory) {
        return upgradeHistory;
    }

    /**
     * @notice Record a contract upgrade
     * @param newVersion Version string for the upgrade (e.g., "2.0.0")
     * @param notes Description of changes in this upgrade
     * @dev Only callable by super admin. Should be called after upgrading the contract.
     */
    function recordUpgrade(
        string calldata newVersion,
        string calldata notes
    ) external onlyRole(SUPER_ADMIN_ROLE) {
        upgradeHistory.push(UpgradeInfo({
            version: newVersion,
            timestamp: block.timestamp,
            upgrader: msg.sender,
            notes: notes
        }));
    }

    /**
     * @dev Storage gap for future upgrades
     * Reserves 47 slots for adding new state variables without breaking storage layout
     * If adding new variables, reduce this number accordingly (50 - added slots)
     */
    uint256[47] private __gap;

    /**
     * @notice Update the institution registry address
     * @param _institutionRegistry New InstitutionRegistry address
     * @dev Only callable by super admin
     */
    function setInstitutionRegistry(
        address _institutionRegistry
    ) external onlyRole(SUPER_ADMIN_ROLE) {
        if (_institutionRegistry == address(0)) revert InvalidAddress();
        institutionRegistry = IInstitutionRegistry(_institutionRegistry);
    }

    /**
     * @notice Authorize contract upgrade
     * @param newImplementation Address of the new implementation
     * @dev Only callable by super admin
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(SUPER_ADMIN_ROLE) {}
}

