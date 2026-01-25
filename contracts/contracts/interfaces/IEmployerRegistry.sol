// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IEmployerRegistry
 * @notice Interface for the EmployerRegistry contract
 * @dev Defines employer registration and management functions
 */
interface IEmployerRegistry {
    
    /**
     * @notice Struct representing an employer
     */
    struct Employer {
        address walletAddress;
        string companyName;
        string vatNumber;
        uint256 registrationDate;
        bool isActive;
    }
    
    // Events are inherited from implementation - not redeclared here
    
    /**
     * @notice Register as an employer
     * @param _companyName Name of the company
     * @param _vatNumber VAT number of the company
     * @dev Validates that caller is not admin, university, or student
     */
    function registerEmployer(
        string memory _companyName,
        string memory _vatNumber
    ) external;
    
    /**
     * @notice Update employer information
     * @param _companyName New company name
     * @param _vatNumber New VAT number
     */
    function updateEmployer(
        string memory _companyName,
        string memory _vatNumber
    ) external;
    
    /**
     * @notice Deactivate an employer (admin only)
     * @param employerAddress Address of the employer to deactivate
     */
    function deactivateEmployer(address employerAddress) external;
    
    /**
     * @notice Reactivate an employer (admin only)
     * @param employerAddress Address of the employer to reactivate
     */
    function reactivateEmployer(address employerAddress) external;
    
    /**
     * @notice Check if an address is a registered and active employer
     * @param employerAddress Address to check
     * @return bool True if registered and active
     */
    function isEmployer(address employerAddress) external view returns (bool);
    
    /**
     * @notice Get employer information
     * @param employerAddress Address of the employer
     * @return Employer struct with employer details
     */
    function getEmployer(address employerAddress) external view returns (Employer memory);
    
    /**
     * @notice Get all employer addresses
     * @return Array of all employer addresses
     */
    function getAllEmployers() external view returns (address[] memory);
    
    /**
     * @notice Get paginated list of employers
     * @param offset Starting index
     * @param limit Number of employers to return
     * @return Array of employer addresses
     */
    function getEmployersPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory);
    
    /**
     * @notice Check if a VAT number is available for registration
     * @param _vatNumber VAT number to check
     * @return bool True if available (not registered), false if already in use
     */
    function isVatAvailable(string calldata _vatNumber) external view returns (bool);
    
    /**
     * @notice Get the wallet address associated with a VAT number
     * @param _vatNumber VAT number to look up
     * @return address Wallet address (zero address if VAT not registered)
     */
    function getEmployerByVat(string calldata _vatNumber) external view returns (address);
    
    /**
     * @notice Get total number of registered employers
     * @return Total count of employers
     */
    function totalEmployers() external view returns (uint256);
}
