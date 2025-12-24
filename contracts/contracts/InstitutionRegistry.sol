// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IInstitutionRegistry.sol";

/**
 * @title InstitutionRegistry
 * @notice Manages educational institutions that can issue certificates
 * @dev Implements UUPS upgradeable pattern with role-based access control
 * 
 * Roles:
 * - SUPER_ADMIN_ROLE: Can approve/suspend/reactivate institutions and upgrade contract
 * - DEFAULT_ADMIN_ROLE: Can manage other roles
 * 
 * Flow:
 * 1. Institution calls registerInstitution() with their details
 * 2. Super admin calls approveInstitution() to verify the institution
 * 3. Once approved, institution can issue certificates via CertificateRegistry
 */
contract InstitutionRegistry is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IInstitutionRegistry
{
    /// @notice Contract version for tracking upgrades
    string public constant VERSION = "1.0.0";

    /// @notice Role identifier for super admin
    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");

    /// @notice Role identifier for certificate registry contract
    bytes32 public constant CERTIFICATE_REGISTRY_ROLE = keccak256("CERTIFICATE_REGISTRY_ROLE");

    /// @notice Struct to track contract upgrades
    struct UpgradeInfo {
        string version;
        uint256 timestamp;
        address upgrader;
        string notes;
    }

    /// @notice Mapping from wallet address to institution data
    mapping(address => Institution) public institutions;

    /// @notice Array of all registered institution addresses
    address[] public institutionList;

    /// @notice Mapping from email domain to institution address (for uniqueness)
    mapping(string => address) public emailDomainToAddress;

    /// @notice Array tracking all contract upgrades
    UpgradeInfo[] public upgradeHistory;

    // Custom Errors
    error InstitutionAlreadyExists();
    error InstitutionNotFound();
    error InstitutionNotVerified();
    error InstitutionAlreadyVerified();
    error InstitutionNotActive();
    error InstitutionAlreadyActive();
    error EmailDomainAlreadyRegistered();
    error InvalidEmailDomain();
    error InvalidName();
    error InvalidAddress();
    error AdminCannotRegisterAsInstitution();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param superAdmin Address of the super admin
     */
    function initialize(address superAdmin) public initializer {
        if (superAdmin == address(0)) revert InvalidAddress();

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, superAdmin);
        _grantRole(SUPER_ADMIN_ROLE, superAdmin);

        // Record initial version
        upgradeHistory.push(UpgradeInfo({
            version: VERSION,
            timestamp: block.timestamp,
            upgrader: msg.sender,
            notes: "Initial deployment"
        }));
    }

    /**
     * @notice Register a new institution
     * @param name Official name of the institution
     * @param emailDomain Verified email domain (e.g., "mit.edu")
     * @dev Anyone can register, but must be approved by super admin to issue certificates
     */
    function registerInstitution(
        string calldata name,
        string calldata emailDomain
    ) external nonReentrant {
        if (bytes(name).length == 0) revert InvalidName();
        if (bytes(emailDomain).length == 0) revert InvalidEmailDomain();
        if (institutions[msg.sender].walletAddress != address(0))
            revert InstitutionAlreadyExists();
        if (emailDomainToAddress[emailDomain] != address(0))
            revert EmailDomainAlreadyRegistered();

        institutions[msg.sender] = Institution({
            name: name,
            emailDomain: emailDomain,
            walletAddress: msg.sender,
            isVerified: false,
            isActive: false,
            verificationDate: 0,
            totalCertificatesIssued: 0
        });

        institutionList.push(msg.sender);
        emailDomainToAddress[emailDomain] = msg.sender;

        emit InstitutionRegistered(msg.sender, name, emailDomain);
    }

    /**
     * @notice Register and approve a new institution (admin-initiated)
     * @param wallet Address of the institution to register
     * @param name Official name of the institution
     * @param emailDomain Verified email domain (e.g., "mit.edu")
     * @dev Only callable by super admin. Registers and auto-approves the institution.
     */
    function registerInstitutionByAdmin(
        address wallet,
        string calldata name,
        string calldata emailDomain
    ) external onlyRole(SUPER_ADMIN_ROLE) nonReentrant {
        if (wallet == address(0)) revert InvalidAddress();
        if (wallet == msg.sender) revert AdminCannotRegisterAsInstitution();
        if (bytes(name).length == 0) revert InvalidName();
        if (bytes(emailDomain).length == 0) revert InvalidEmailDomain();
        if (institutions[wallet].walletAddress != address(0))
            revert InstitutionAlreadyExists();
        if (emailDomainToAddress[emailDomain] != address(0))
            revert EmailDomainAlreadyRegistered();

        institutions[wallet] = Institution({
            name: name,
            emailDomain: emailDomain,
            walletAddress: wallet,
            isVerified: true,  // Auto-approve since admin is registering
            isActive: true,
            verificationDate: block.timestamp,
            totalCertificatesIssued: 0
        });

        institutionList.push(wallet);
        emailDomainToAddress[emailDomain] = wallet;

        emit InstitutionRegistered(wallet, name, emailDomain);
        emit InstitutionApproved(wallet, block.timestamp);
    }

    /**
     * @notice Approve a registered institution
     * @param wallet Address of the institution to approve
     * @dev Only callable by super admin
     */
    function approveInstitution(
        address wallet
    ) external onlyRole(SUPER_ADMIN_ROLE) {
        Institution storage inst = institutions[wallet];
        if (inst.walletAddress == address(0)) revert InstitutionNotFound();
        if (inst.isVerified) revert InstitutionAlreadyVerified();

        inst.isVerified = true;
        inst.isActive = true;
        inst.verificationDate = block.timestamp;

        emit InstitutionApproved(wallet, block.timestamp);
    }

    /**
     * @notice Suspend an active institution
     * @param wallet Address of the institution to suspend
     * @dev Only callable by super admin. Institution can be reactivated later.
     */
    function suspendInstitution(
        address wallet
    ) external onlyRole(SUPER_ADMIN_ROLE) {
        Institution storage inst = institutions[wallet];
        if (inst.walletAddress == address(0)) revert InstitutionNotFound();
        if (!inst.isActive) revert InstitutionNotActive();

        inst.isActive = false;

        emit InstitutionSuspended(wallet, block.timestamp);
    }

    /**
     * @notice Reactivate a suspended institution
     * @param wallet Address of the institution to reactivate
     * @dev Only callable by super admin. Institution must have been verified before.
     */
    function reactivateInstitution(
        address wallet
    ) external onlyRole(SUPER_ADMIN_ROLE) {
        Institution storage inst = institutions[wallet];
        if (inst.walletAddress == address(0)) revert InstitutionNotFound();
        if (!inst.isVerified) revert InstitutionNotVerified();
        if (inst.isActive) revert InstitutionAlreadyActive();

        inst.isActive = true;

        emit InstitutionReactivated(wallet, block.timestamp);
    }

    /**
     * @notice Check if an institution can issue certificates
     * @param wallet Address of the institution
     * @return True if the institution is verified and active
     */
    function canIssueCertificates(address wallet) external view returns (bool) {
        Institution storage inst = institutions[wallet];
        return inst.isVerified && inst.isActive;
    }

    /**
     * @notice Increment the certificate count for an institution
     * @param wallet Address of the institution
     * @dev Only callable by CertificateRegistry contract
     */
    function incrementCertificateCount(
        address wallet
    ) external onlyRole(CERTIFICATE_REGISTRY_ROLE) {
        institutions[wallet].totalCertificatesIssued++;
    }

    /**
     * @notice Get institution details
     * @param wallet Address of the institution
     * @return Institution struct with all details
     */
    function getInstitution(
        address wallet
    ) external view returns (Institution memory) {
        return institutions[wallet];
    }

    /**
     * @notice Get all registered institution addresses
     * @return Array of institution wallet addresses
     */
    function getAllInstitutions() external view returns (address[] memory) {
        return institutionList;
    }

    /**
     * @notice Get the total number of registered institutions
     * @return The count of institutions
     */
    function getInstitutionCount() external view returns (uint256) {
        return institutionList.length;
    }

    /**
     * @notice Get institution by email domain
     * @param emailDomain The email domain to look up
     * @return wallet Address of the institution
     */
    function getInstitutionByDomain(
        string calldata emailDomain
    ) external view returns (address wallet) {
        return emailDomainToAddress[emailDomain];
    }

    /**
     * @notice Get institution statistics by status
     * @return totalRegistered Total number of registered institutions
     * @return totalVerified Number of verified institutions
     * @return totalActive Number of active institutions
     * @return totalSuspended Number of suspended institutions
     * @dev Iterates through all institutions - gas intensive for large datasets
     */
    function getInstitutionStats() external view returns (
        uint256 totalRegistered,
        uint256 totalVerified,
        uint256 totalActive,
        uint256 totalSuspended
    ) {
        totalRegistered = institutionList.length;
        
        for (uint256 i = 0; i < institutionList.length; i++) {
            Institution storage inst = institutions[institutionList[i]];
            
            if (inst.isVerified) {
                totalVerified++;
            }
            
            if (inst.isActive) {
                totalActive++;
            }
            
            if (inst.isVerified && !inst.isActive) {
                totalSuspended++;
            }
        }
        
        return (totalRegistered, totalVerified, totalActive, totalSuspended);
    }

    /**
     * @notice Get institutions with pagination
     * @param offset Starting index for pagination
     * @param limit Maximum number of results to return
     * @return institutionAddresses Array of institution wallet addresses
     * @return institutionData Array of Institution structs
     * @return total Total number of institutions
     * @dev More gas-efficient than getAllInstitutions for large datasets
     */
    function getInstitutionsPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (
        address[] memory institutionAddresses,
        Institution[] memory institutionData,
        uint256 total
    ) {
        total = institutionList.length;
        
        // Handle edge cases
        if (offset >= total) {
            return (new address[](0), new Institution[](0), total);
        }
        
        // Calculate actual number of results
        uint256 resultCount = limit;
        if (offset + limit > total) {
            resultCount = total - offset;
        }
        
        // Allocate memory
        institutionAddresses = new address[](resultCount);
        institutionData = new Institution[](resultCount);
        
        // Populate results
        for (uint256 i = 0; i < resultCount; i++) {
            address instAddress = institutionList[offset + i];
            institutionAddresses[i] = instAddress;
            institutionData[i] = institutions[instAddress];
        }
        
        return (institutionAddresses, institutionData, total);
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
     * @notice Authorize contract upgrade
     * @param newImplementation Address of the new implementation
     * @dev Only callable by super admin
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(SUPER_ADMIN_ROLE) {}

    /**
     * @notice Grant CERTIFICATE_REGISTRY_ROLE to an address
     * @param certificateRegistry Address of the CertificateRegistry contract
     * @dev Only callable by super admin
     */
    function setCertificateRegistry(
        address certificateRegistry
    ) external onlyRole(SUPER_ADMIN_ROLE) {
        if (certificateRegistry == address(0)) revert InvalidAddress();
        _grantRole(CERTIFICATE_REGISTRY_ROLE, certificateRegistry);
    }
}

