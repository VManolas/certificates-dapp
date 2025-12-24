// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./CertificateRegistry.sol";

/**
 * @title CertificateRegistryV2
 * @notice Version 2.0.0 of the CertificateRegistry contract
 * @dev Example upgrade contract demonstrating:
 *      - Version update
 *      - New features (batch operations)
 *      - Storage layout preservation
 *      - Upgrade recording
 * 
 * IMPORTANT: This is a template/example. Actual V2 features should be implemented
 *           based on real requirements from Phase 2 of the roadmap.
 */
contract CertificateRegistryV2 is CertificateRegistry {
    /// @notice Updated version for V2
    string public constant VERSION_V2 = "2.0.0";

    /**
     * @dev New storage variables MUST be added at the end
     * Never reorder or delete existing variables from parent contract
     */
    
    /// @notice New feature: Track batch operations
    mapping(bytes32 => bool) public batchOperations;
    
    /// @notice New feature: Certificate templates
    mapping(uint256 => string) public certificateTemplates;
    uint256 public templateCounter;

    // Events for new features
    event BatchOperationRecorded(bytes32 indexed batchId, uint256 certificateCount);
    event TemplateCreated(uint256 indexed templateId, string templateName);

    /**
     * @notice Initialize V2 upgrade
     * @param notes Description of changes in this upgrade
     * @dev Use reinitializer(2) for V2, reinitializer(3) for V3, etc.
     *      This function should be called immediately after upgrade
     */
    function upgradeToV2(string calldata notes) external reinitializer(2) {
        // Record the upgrade
        upgradeHistory.push(UpgradeInfo({
            version: VERSION_V2,
            timestamp: block.timestamp,
            upgrader: msg.sender,
            notes: notes
        }));

        // Initialize new V2 state variables if needed
        templateCounter = 1;
    }

    /**
     * @notice Get current version (override to return V2 version)
     * @return Current version string
     */
    function getVersion() public pure override returns (string memory) {
        return VERSION_V2;
    }

    /**
     * @notice Issue multiple certificates in a single transaction
     * @param documentHashes Array of SHA-256 hashes
     * @param studentWallets Array of student wallet addresses
     * @param metadataURIs Array of metadata URIs
     * @return batchId Unique identifier for this batch operation
     * @return certificateIds Array of generated certificate IDs
     * @dev New feature in V2. Requires arrays to be same length.
     */
    function issueCertificateBatch(
        bytes32[] calldata documentHashes,
        address[] calldata studentWallets,
        string[] calldata metadataURIs
    ) external nonReentrant returns (bytes32 batchId, uint256[] memory certificateIds) {
        // Validate inputs
        require(
            documentHashes.length == studentWallets.length &&
            documentHashes.length == metadataURIs.length,
            "Array length mismatch"
        );
        require(documentHashes.length > 0, "Empty batch");
        require(documentHashes.length <= 100, "Batch too large");

        // Check authorization
        if (!institutionRegistry.canIssueCertificates(msg.sender))
            revert UnauthorizedIssuer();

        // Generate batch ID
        batchId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            documentHashes.length
        ));

        // Issue certificates
        certificateIds = new uint256[](documentHashes.length);
        for (uint256 i = 0; i < documentHashes.length; i++) {
            // Validate individual certificate
            if (studentWallets[i] == address(0)) revert InvalidStudentAddress();
            if (documentHashes[i] == bytes32(0)) revert InvalidDocumentHash();
            if (hashToCertificateId[documentHashes[i]] != 0)
                revert CertificateAlreadyExists();

            // Issue certificate using internal logic
            uint256 certificateId = _certificateIdCounter++;
            
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

            studentCertificates[studentWallets[i]].push(certificateId);
            hashToCertificateId[documentHashes[i]] = certificateId;
            certificateIds[i] = certificateId;

            emit CertificateIssued(
                certificateId,
                documentHashes[i],
                studentWallets[i],
                msg.sender,
                block.timestamp
            );
        }

        // Update institution stats
        for (uint256 i = 0; i < documentHashes.length; i++) {
            institutionRegistry.incrementCertificateCount(msg.sender);
        }

        // Record batch operation
        batchOperations[batchId] = true;
        emit BatchOperationRecorded(batchId, documentHashes.length);

        return (batchId, certificateIds);
    }

    /**
     * @notice Create a certificate template
     * @param templateName Name/description of the template
     * @return templateId The ID of the created template
     * @dev New feature in V2
     */
    function createTemplate(
        string calldata templateName
    ) external onlyRole(SUPER_ADMIN_ROLE) returns (uint256) {
        uint256 templateId = templateCounter++;
        certificateTemplates[templateId] = templateName;
        
        emit TemplateCreated(templateId, templateName);
        
        return templateId;
    }

    /**
     * @notice Check if a batch operation was recorded
     * @param batchId The batch identifier
     * @return True if the batch was recorded
     */
    function isBatchRecorded(bytes32 batchId) external view returns (bool) {
        return batchOperations[batchId];
    }

    /**
     * @notice Get template name by ID
     * @param templateId The template identifier
     * @return The template name
     */
    function getTemplate(uint256 templateId) external view returns (string memory) {
        return certificateTemplates[templateId];
    }

    /**
     * @dev Reduced storage gap to account for new variables
     * Original: uint256[47] (from V1)
     * New variables added: batchOperations (1 slot), certificateTemplates (1 slot), templateCounter (1 slot)
     * Adjusted gap: 47 - 3 = 44 slots remaining
     */
    uint256[44] private __gapV2;
}
