// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ICertificateRegistry
 * @notice Interface for the Certificate Registry contract
 * @dev Defines the external functions for certificate management
 */
interface ICertificateRegistry {
    /// @notice Certificate data structure
    struct Certificate {
        bytes32 documentHash;
        address studentWallet;
        address issuingInstitution;
        uint256 issueDate;
        uint256 certificateId;
        string metadataURI;
        bool isRevoked;
        uint256 revokedAt;
        string revocationReason;
    }

    /// @notice Emitted when a new certificate is issued
    event CertificateIssued(
        uint256 indexed certificateId,
        bytes32 indexed documentHash,
        address indexed studentWallet,
        address issuingInstitution,
        uint256 issueDate
    );

    /// @notice Emitted when a certificate is revoked
    event CertificateRevoked(
        uint256 indexed certificateId,
        address indexed revokedBy,
        string reason,
        uint256 timestamp
    );

    /// @notice Issue a new certificate
    /// @param documentHash SHA-256 hash of the PDF document
    /// @param studentWallet Wallet address of the student
    /// @param metadataURI Optional IPFS/Arweave URI for additional metadata
    /// @return certificateId The unique ID of the issued certificate
    function issueCertificate(
        bytes32 documentHash,
        address studentWallet,
        string calldata metadataURI
    ) external returns (uint256 certificateId);

    /// @notice Revoke a certificate
    /// @param certificateId The ID of the certificate to revoke
    /// @param reason The reason for revocation
    function revokeCertificate(
        uint256 certificateId,
        string calldata reason
    ) external;

    /// @notice Get certificate by ID
    /// @param certificateId The ID of the certificate
    /// @return Certificate struct with all details
    function getCertificate(
        uint256 certificateId
    ) external view returns (Certificate memory);

    /// @notice Get certificate by document hash
    /// @param documentHash The SHA-256 hash of the document
    /// @return Certificate struct with all details
    function getCertificateByHash(
        bytes32 documentHash
    ) external view returns (Certificate memory);

    /// @notice Get all certificate IDs for a student
    /// @param studentWallet The wallet address of the student
    /// @return Array of certificate IDs
    function getCertificatesByStudent(
        address studentWallet
    ) external view returns (uint256[] memory);

    /// @notice Verify if a certificate is valid
    /// @param documentHash The SHA-256 hash of the document
    /// @return isValid True if the certificate exists and is not revoked
    /// @return certificateId The ID of the certificate (0 if not found)
    /// @return isRevoked True if the certificate has been revoked
    function isValidCertificate(
        bytes32 documentHash
    ) external view returns (bool isValid, uint256 certificateId, bool isRevoked);

    /// @notice Get total number of certificates issued
    /// @return The total count
    function getTotalCertificates() external view returns (uint256);

    /// @notice Check if a certificate exists without reverting
    /// @param certificateId The ID of the certificate to check
    /// @return exists True if the certificate exists
    function certificateExists(uint256 certificateId) external view returns (bool exists);

    /// @notice Check if a document hash already exists to prevent duplicates
    /// @param documentHash The SHA-256 hash to check
    /// @return exists True if a certificate with this hash exists
    function hashExists(bytes32 documentHash) external view returns (bool exists);

    /// @notice Get multiple certificates in a single batch call for gas efficiency
    /// @param certificateIds Array of certificate IDs to retrieve
    /// @return certificates_ Array of Certificate structs
    /// @return foundFlags Array indicating which certificates were found
    function getCertificatesBatch(
        uint256[] calldata certificateIds
    ) external view returns (
        Certificate[] memory certificates_,
        bool[] memory foundFlags
    );

    /// @notice Issue multiple certificates in a single transaction
    /// @param documentHashes Array of SHA-256 hashes of the PDF documents
    /// @param studentWallets Array of wallet addresses of the students
    /// @param metadataURIs Array of optional IPFS/Arweave URIs for additional metadata
    /// @return certificateIds Array of unique IDs of the issued certificates
    function issueCertificatesBatch(
        bytes32[] calldata documentHashes,
        address[] calldata studentWallets,
        string[] calldata metadataURIs
    ) external returns (uint256[] memory certificateIds);
}

