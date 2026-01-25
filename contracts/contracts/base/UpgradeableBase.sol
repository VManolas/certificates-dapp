// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title UpgradeableBase
 * @notice Abstract base contract providing common upgrade management functionality
 * @dev Extends OpenZeppelin's upgradeable contracts with standardized version tracking
 * 
 * Features:
 * - Version management with history tracking
 * - UUPS upgrade pattern support
 * - Access control for upgrade operations
 * - Storage gap for safe future upgrades
 * 
 * Usage:
 * - Inherit from this contract in upgradeable contracts
 * - Override getVersion() to return current version
 * - Call recordUpgrade() after each upgrade
 */
abstract contract UpgradeableBase is 
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable 
{
    /// @notice Struct to track contract upgrades
    struct UpgradeInfo {
        string version;
        uint256 timestamp;
        address upgrader;
        string notes;
    }

    /// @notice Admin role constant (must match inheriting contracts)
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Array tracking all contract upgrades
    UpgradeInfo[] public upgradeHistory;

    /// @notice Emitted when an upgrade is recorded
    event UpgradeRecorded(
        string version,
        uint256 timestamp,
        address indexed upgrader,
        string notes
    );

    /**
     * @notice Get current contract version
     * @return Current version string
     * @dev Must be overridden by inheriting contracts to return their specific version
     */
    function getVersion() public pure virtual returns (string memory);

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
     * @dev Only callable by admin. Should be called after upgrading the contract.
     */
    function recordUpgrade(
        string calldata newVersion,
        string calldata notes
    ) external onlyRole(ADMIN_ROLE) {
        upgradeHistory.push(UpgradeInfo({
            version: newVersion,
            timestamp: block.timestamp,
            upgrader: msg.sender,
            notes: notes
        }));

        emit UpgradeRecorded(newVersion, block.timestamp, msg.sender, notes);
    }

    /**
     * @notice Authorize upgrade (required by UUPS)
     * @param newImplementation Address of new implementation
     * @dev Only callable by admin role
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        virtual
        override 
        onlyRole(ADMIN_ROLE) 
    {
        // Authorization logic - can be extended by child contracts
    }

    /**
     * @dev Storage gap for future upgrades
     * Reserves 47 slots for adding new state variables without breaking storage layout
     * If adding new variables, reduce this number accordingly (50 - added slots)
     * 
     * Current usage: 1 slot (upgradeHistory array)
     * Available: 47 slots
     */
    uint256[47] private __gap;
}
