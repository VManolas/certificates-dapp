// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IInstitutionRegistry
 * @notice Interface for the Institution Registry contract
 * @dev Defines the external functions for institution management
 */
interface IInstitutionRegistry {
    /// @notice Institution data structure
    struct Institution {
        string name;
        string emailDomain;
        address walletAddress;
        bool isVerified;
        bool isActive;
        uint256 verificationDate;
        uint256 totalCertificatesIssued;
    }

    /// @notice Emitted when a new institution registers
    event InstitutionRegistered(
        address indexed wallet,
        string name,
        string emailDomain
    );

    /// @notice Emitted when an institution is approved by super admin
    event InstitutionApproved(address indexed wallet, uint256 timestamp);

    /// @notice Emitted when an institution is suspended
    event InstitutionSuspended(address indexed wallet, uint256 timestamp);

    /// @notice Emitted when an institution is reactivated
    event InstitutionReactivated(address indexed wallet, uint256 timestamp);

    /// @notice Check if an institution can issue certificates
    /// @param wallet The wallet address of the institution
    /// @return bool True if the institution is verified and active
    function canIssueCertificates(address wallet) external view returns (bool);

    /// @notice Increment the certificate count for an institution
    /// @param wallet The wallet address of the institution
    function incrementCertificateCount(address wallet) external;

    /// @notice Get institution details
    /// @param wallet The wallet address of the institution
    /// @return Institution struct with all details
    function getInstitution(address wallet) external view returns (Institution memory);

    /// @notice Get all registered institution addresses
    /// @return Array of institution wallet addresses
    function getAllInstitutions() external view returns (address[] memory);

    /// @notice Get the total number of registered institutions
    /// @return The count of institutions
    function getInstitutionCount() external view returns (uint256);

    /// @notice Get institution statistics by status
    /// @return totalRegistered Total number of registered institutions
    /// @return totalVerified Number of verified institutions
    /// @return totalActive Number of active institutions
    /// @return totalSuspended Number of suspended institutions
    function getInstitutionStats() external view returns (
        uint256 totalRegistered,
        uint256 totalVerified,
        uint256 totalActive,
        uint256 totalSuspended
    );

    /// @notice Get institutions with pagination for efficient listing
    /// @param offset Starting index for pagination
    /// @param limit Maximum number of results to return
    /// @return institutionAddresses Array of institution wallet addresses
    /// @return institutionData Array of Institution structs
    /// @return total Total number of institutions
    function getInstitutionsPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (
        address[] memory institutionAddresses,
        Institution[] memory institutionData,
        uint256 total
    );
}

