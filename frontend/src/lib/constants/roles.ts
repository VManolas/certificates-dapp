/**
 * Role Constants and Metadata
 * ===========================
 * 
 * Centralized role definitions for the zkCredentials application.
 * This file is the single source of truth for role-related metadata.
 * 
 * Used by:
 * - RoleSelector: Full role cards with features
 * - RoleDropdown: Compact role selection
 * - RoleBadge: Role display badges
 * - RoleSwitcher: Role switching dropdown
 * 
 * @module lib/constants/roles
 */

import type { UserRole } from '@/types/auth';

/**
 * All possible user roles in display order
 */
export const ALL_ROLES: NonNullable<UserRole>[] = [
  'admin',
  'university',
  'student',
  'employer',
] as const;

/**
 * Complete role metadata with all display information
 */
export interface RoleMetadata {
  /** Internal role identifier */
  role: UserRole;
  
  /** Display icon (emoji) */
  icon: string;
  
  /** Human-readable role name */
  label: string;
  
  /** Full title for role cards */
  title: string;
  
  /** Short description of the role */
  description: string;
  
  /** Badge text (e.g., "Public Auth Only", "Privacy") */
  badge: string;
  
  /** Badge style variant */
  badgeVariant: 'public' | 'privacy' | 'flexible';
  
  /** List of role features/capabilities */
  features: string[];
  
  /** Tailwind CSS classes for badge background */
  bgClass: string;
  
  /** Tailwind CSS classes for badge text */
  textClass: string;
  
  /** Tailwind CSS classes for disabled badge background */
  disabledBgClass: string;
  
  /** Tailwind CSS classes for disabled badge text */
  disabledTextClass: string;
  
  /** Tooltip message when role is disabled/locked */
  disabledTooltip: string;
}

/**
 * Complete role metadata configuration
 * Single source of truth for all role-related display information
 */
export const ROLE_METADATA: Record<NonNullable<UserRole>, RoleMetadata> = {
  admin: {
    role: 'admin',
    icon: '👔',
    label: 'Admin',
    title: 'Admin',
    description: 'System administrator with full access',
    badge: 'Public Auth Only',
    badgeVariant: 'public',
    features: [
      'Manage universities and employers',
      'Oversee all certificates',
      'System configuration',
      'Must use standard Web3 login',
    ],
    bgClass: 'bg-red-500/10 border-red-500/30',
    textClass: 'text-red-400',
    disabledBgClass: 'bg-surface-800 border-surface-700',
    disabledTextClass: 'text-surface-600',
    disabledTooltip: 'Admin access is restricted to platform administrators',
  },
  
  university: {
    role: 'university',
    icon: '🏛️',
    label: 'University',
    title: 'University',
    description: 'Educational institution issuing certificates',
    badge: 'Public Auth Only',
    badgeVariant: 'public',
    features: [
      'Issue student certificates',
      'Bulk certificate operations',
      'Manage certificate templates',
      'Must use standard Web3 login',
    ],
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    textClass: 'text-blue-400',
    disabledBgClass: 'bg-surface-800 border-surface-700',
    disabledTextClass: 'text-surface-600',
    disabledTooltip: 'Register your institution to access university features',
  },
  
  student: {
    role: 'student',
    icon: '🎓',
    label: 'Student',
    title: 'Student',
    description: 'Certificate holder with privacy options',
    badge: 'Privacy Recommended',
    badgeVariant: 'privacy',
    features: [
      'View your certificates',
      'Share certificates privately',
      'Generate verification links',
      'Private or standard login available',
    ],
    bgClass: 'bg-green-500/10 border-green-500/30',
    textClass: 'text-green-400',
    disabledBgClass: 'bg-surface-800 border-surface-700',
    disabledTextClass: 'text-surface-600',
    disabledTooltip: "You'll appear here once you receive a certificate",
  },
  
  employer: {
    role: 'employer',
    icon: '💼',
    label: 'Employer',
    title: 'Employer',
    description: 'Organization verifying credentials',
    badge: 'Flexible Auth',
    badgeVariant: 'flexible',
    features: [
      'Verify student certificates',
      'Access certificate data',
      'Manage verification requests',
      'Private or standard login available',
    ],
    bgClass: 'bg-purple-500/10 border-purple-500/30',
    textClass: 'text-purple-400',
    disabledBgClass: 'bg-surface-800 border-surface-700',
    disabledTextClass: 'text-surface-600',
    disabledTooltip: '', // Never disabled for employers
  },
};

/**
 * Badge variant color mapping
 * Maps badge variants to their Tailwind CSS classes
 */
export const BADGE_VARIANT_CLASSES: Record<RoleMetadata['badgeVariant'], string> = {
  public: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  privacy: 'bg-green-500/20 text-green-400 border-green-500/30',
  flexible: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

/**
 * Get role metadata by role identifier
 * 
 * @param role - The role to get metadata for
 * @returns Role metadata or null if role is invalid
 * 
 * @example
 * ```typescript
 * const metadata = getRoleMetadata('student');
 * console.log(metadata.icon); // "🎓"
 * console.log(metadata.features); // ["View your certificates", ...]
 * ```
 */
export function getRoleMetadata(role: UserRole): RoleMetadata | null {
  if (!role) return null;
  return ROLE_METADATA[role] || null;
}

/**
 * Get compact role information for dropdowns
 * 
 * @param role - The role to get information for
 * @returns Compact role info or null
 * 
 * @example
 * ```typescript
 * const info = getRoleInfo('admin');
 * console.log(info); // { role: 'admin', icon: '👔', label: 'Admin', badge: 'Public Auth Only' }
 * ```
 */
export function getRoleInfo(role: UserRole): Pick<RoleMetadata, 'role' | 'icon' | 'label' | 'badge'> | null {
  const metadata = getRoleMetadata(role);
  if (!metadata) return null;
  
  return {
    role: metadata.role,
    icon: metadata.icon,
    label: metadata.label,
    badge: metadata.badge,
  };
}

/**
 * Get role badge styling classes
 * 
 * @param role - The role to get badge classes for
 * @param disabled - Whether the badge is in disabled state
 * @returns Object with bgClass and textClass
 * 
 * @example
 * ```typescript
 * const classes = getRoleBadgeClasses('student', false);
 * console.log(classes.bgClass); // "bg-green-500/10 border-green-500/30"
 * ```
 */
export function getRoleBadgeClasses(
  role: UserRole,
  disabled: boolean = false
): { bgClass: string; textClass: string } {
  const metadata = getRoleMetadata(role);
  if (!metadata) {
    return {
      bgClass: 'bg-surface-800 border-surface-700',
      textClass: 'text-surface-600',
    };
  }
  
  return disabled
    ? {
        bgClass: metadata.disabledBgClass,
        textClass: metadata.disabledTextClass,
      }
    : {
        bgClass: metadata.bgClass,
        textClass: metadata.textClass,
      };
}

/**
 * Get tooltip message for disabled/locked role
 * 
 * @param role - The role to get tooltip for
 * @returns Tooltip message or empty string
 * 
 * @example
 * ```typescript
 * const tooltip = getRoleDisabledTooltip('admin');
 * console.log(tooltip); // "Admin access is restricted to platform administrators"
 * ```
 */
export function getRoleDisabledTooltip(role: UserRole): string {
  const metadata = getRoleMetadata(role);
  return metadata?.disabledTooltip || '';
}

/**
 * Check if a role supports privacy-preserving authentication
 * 
 * @param role - The role to check
 * @returns True if role supports ZK-proof authentication
 * 
 * @example
 * ```typescript
 * supportsPrivateAuth('student'); // true
 * supportsPrivateAuth('admin'); // false
 * ```
 */
export function supportsPrivateAuth(role: UserRole): boolean {
  if (!role) return false;
  return role === 'student' || role === 'employer';
}

/**
 * Check if a role requires public authentication only
 * 
 * @param role - The role to check
 * @returns True if role requires Web3 authentication
 * 
 * @example
 * ```typescript
 * requiresPublicAuth('admin'); // true
 * requiresPublicAuth('student'); // false
 * ```
 */
export function requiresPublicAuth(role: UserRole): boolean {
  if (!role) return false;
  return role === 'admin' || role === 'university';
}

/**
 * Get badge variant class for a role
 * 
 * @param role - The role to get badge variant for
 * @returns Tailwind CSS classes for the badge variant
 * 
 * @example
 * ```typescript
 * const classes = getBadgeVariantClass('student');
 * console.log(classes); // "bg-green-500/20 text-green-400 border-green-500/30"
 * ```
 */
export function getBadgeVariantClass(role: UserRole): string {
  const metadata = getRoleMetadata(role);
  if (!metadata) return '';
  return BADGE_VARIANT_CLASSES[metadata.badgeVariant];
}
