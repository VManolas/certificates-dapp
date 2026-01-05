// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IInstitutionRegistry.sol";
import "./interfaces/ICertificateRegistry.sol";

/**
 * @title EmployerRegistry
 * @notice Manages employer registration with company details
 * @dev Only wallets that are NOT students, universities, or admins can register as employers
 */
contract EmployerRegistry is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    struct Employer {
        address walletAddress;
        string companyName;
        string vatNumber;
        uint256 registrationDate;
        bool isActive;
    }
    
    // Mapping from wallet address to employer data
    mapping(address => Employer) public employers;
    
    // Array to track all employer addresses
    address[] public employerAddresses;
    
    // Total count of registered employers
    uint256 public totalEmployers;
    
    // Registry contract references for role conflict validation
    IInstitutionRegistry public institutionRegistry;
    ICertificateRegistry public certificateRegistry;
    
    // Events
    event EmployerRegistered(
        address indexed walletAddress,
        string companyName,
        string vatNumber,
        uint256 timestamp
    );
    
    event EmployerDeactivated(
        address indexed walletAddress,
        uint256 timestamp
    );
    
    event EmployerReactivated(
        address indexed walletAddress,
        uint256 timestamp
    );
    
    event EmployerUpdated(
        address indexed walletAddress,
        string companyName,
        string vatNumber,
        uint256 timestamp
    );
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param admin Address of the admin
     */
    function initialize(address admin) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }
    
    /**
     * @notice Set registry contract addresses
     * @param _institutionRegistry Address of InstitutionRegistry
     * @param _certificateRegistry Address of CertificateRegistry
     * @dev Only callable by admin. Must be called after deployment.
     */
    function setRegistries(
        address _institutionRegistry,
        address _certificateRegistry
    ) external onlyRole(ADMIN_ROLE) {
        require(_institutionRegistry != address(0), "Invalid institution registry");
        require(_certificateRegistry != address(0), "Invalid certificate registry");
        institutionRegistry = IInstitutionRegistry(_institutionRegistry);
        certificateRegistry = ICertificateRegistry(_certificateRegistry);
    }
    
    /**
     * @notice Register as an employer
     * @param _companyName Name of the company
     * @param _vatNumber VAT number of the company
     */
    function registerEmployer(
        string memory _companyName,
        string memory _vatNumber
    ) external {
        require(bytes(_companyName).length > 0, "Company name required");
        require(bytes(_vatNumber).length > 0, "VAT number required");
        require(employers[msg.sender].walletAddress == address(0), "Already registered");
        
        // Role conflict validations
        require(!hasRole(ADMIN_ROLE, msg.sender), "Admin cannot register as employer");
        
        // Check not university (only if registry is set)
        // Check both: approved universities AND pending universities
        if (address(institutionRegistry) != address(0)) {
            // Get institution data - if walletAddress is not zero, they're registered (pending or approved)
            IInstitutionRegistry.Institution memory institution = institutionRegistry.getInstitution(msg.sender);
            require(
                institution.walletAddress == address(0),
                "University cannot register as employer"
            );
        }
        
        // Check not student (only if registry is set)
        if (address(certificateRegistry) != address(0)) {
            uint256[] memory certs = certificateRegistry.getCertificatesByStudent(msg.sender);
            require(certs.length == 0, "Student cannot register as employer");
        }
        
        employers[msg.sender] = Employer({
            walletAddress: msg.sender,
            companyName: _companyName,
            vatNumber: _vatNumber,
            registrationDate: block.timestamp,
            isActive: true
        });
        
        employerAddresses.push(msg.sender);
        totalEmployers++;
        
        emit EmployerRegistered(msg.sender, _companyName, _vatNumber, block.timestamp);
    }
    
    /**
     * @notice Update employer information
     * @param _companyName New company name
     * @param _vatNumber New VAT number
     */
    function updateEmployer(
        string memory _companyName,
        string memory _vatNumber
    ) external {
        require(employers[msg.sender].walletAddress != address(0), "Not registered");
        require(employers[msg.sender].isActive, "Account deactivated");
        require(bytes(_companyName).length > 0, "Company name required");
        require(bytes(_vatNumber).length > 0, "VAT number required");
        
        employers[msg.sender].companyName = _companyName;
        employers[msg.sender].vatNumber = _vatNumber;
        
        emit EmployerUpdated(msg.sender, _companyName, _vatNumber, block.timestamp);
    }
    
    /**
     * @notice Deactivate an employer (admin only)
     * @param employerAddress Address of the employer to deactivate
     */
    function deactivateEmployer(address employerAddress) external onlyRole(ADMIN_ROLE) {
        require(employers[employerAddress].walletAddress != address(0), "Not registered");
        require(employers[employerAddress].isActive, "Already deactivated");
        
        employers[employerAddress].isActive = false;
        
        emit EmployerDeactivated(employerAddress, block.timestamp);
    }
    
    /**
     * @notice Reactivate an employer (admin only)
     * @param employerAddress Address of the employer to reactivate
     */
    function reactivateEmployer(address employerAddress) external onlyRole(ADMIN_ROLE) {
        require(employers[employerAddress].walletAddress != address(0), "Not registered");
        require(!employers[employerAddress].isActive, "Already active");
        
        employers[employerAddress].isActive = true;
        
        emit EmployerReactivated(employerAddress, block.timestamp);
    }
    
    /**
     * @notice Check if an address is a registered and active employer
     * @param employerAddress Address to check
     * @return bool True if registered and active
     */
    function isEmployer(address employerAddress) external view returns (bool) {
        return employers[employerAddress].walletAddress != address(0) 
               && employers[employerAddress].isActive;
    }
    
    /**
     * @notice Get employer information
     * @param employerAddress Address of the employer
     * @return Employer struct with employer details
     */
    function getEmployer(address employerAddress) external view returns (Employer memory) {
        require(employers[employerAddress].walletAddress != address(0), "Not registered");
        return employers[employerAddress];
    }
    
    /**
     * @notice Get all employer addresses
     * @return Array of all employer addresses
     */
    function getAllEmployers() external view returns (address[] memory) {
        return employerAddresses;
    }
    
    /**
     * @notice Get paginated list of employers
     * @param offset Starting index
     * @param limit Number of employers to return
     * @return Array of employer addresses
     */
    function getEmployersPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory) {
        require(offset < employerAddresses.length, "Offset out of bounds");
        
        uint256 end = offset + limit;
        if (end > employerAddresses.length) {
            end = employerAddresses.length;
        }
        
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = employerAddresses[i];
        }
        
        return result;
    }
    
    /**
     * @notice Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
}

