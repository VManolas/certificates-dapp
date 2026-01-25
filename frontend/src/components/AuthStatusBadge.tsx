// frontend/src/components/AuthStatusBadge.tsx
/**
 * Auth Status Badge Component
 * ===========================
 * 
 * Displays the current user's role and authentication method in the header.
 * Shows a clean, informative badge with icons and color coding.
 * 
 * Features:
 * - Role display with emoji icons
 * - Auth method indicator (Private/Public)
 * - Color-coded by auth method
 * - Responsive design
 * 
 * Usage:
 * ```tsx
 * <AuthStatusBadge />
 * ```
 */

import type { UserRole, AuthMethod } from '@/types/auth';
import { useAuthStore } from '@/store/authStore';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { logger } from '@/lib/logger';

const getRoleInfo = (role: UserRole) => {
  switch (role) {
    case 'student':
      return { emoji: '📜', label: 'Student', color: 'text-blue-400' };
    case 'university':
      return { emoji: '🏛️', label: 'University', color: 'text-purple-400' };
    case 'employer':
      return { emoji: '💼', label: 'Employer', color: 'text-green-400' };
    case 'admin':
      return { emoji: '👑', label: 'Admin', color: 'text-amber-400' };
    default:
      return { emoji: '👤', label: 'User', color: 'text-surface-400' };
  }
};

const getAuthMethodInfo = (authMethod: AuthMethod) => {
  if (authMethod === 'zk') {
    return {
      label: 'Private',
      icon: '🔐',
      bgColor: 'bg-primary-500/10',
      borderColor: 'border-primary-500/30',
      textColor: 'text-primary-400',
      description: 'ZKP Authentication'
    };
  } else if (authMethod === 'web3') {
    return {
      label: 'Public',
      icon: '🌐',
      bgColor: 'bg-accent-500/10',
      borderColor: 'border-accent-500/30',
      textColor: 'text-accent-400',
      description: 'Web3 Authentication'
    };
  }
  return null;
};

export const AuthStatusBadge = () => {
  const { role } = useAuthStore();
  const unifiedAuth = useUnifiedAuth();

  // Debug logging
  logger.debug('AuthStatusBadge render check', {
    role,
    isAuthenticated: unifiedAuth.isAuthenticated,
    authMethod: unifiedAuth.authMethod,
    shouldShow: unifiedAuth.isAuthenticated && role !== null,
  });

  // Don't show if not authenticated
  if (!unifiedAuth.isAuthenticated || !role) {
    return null;
  }

  const roleInfo = getRoleInfo(role);
  const authMethodInfo = getAuthMethodInfo(unifiedAuth.authMethod);

  return (
    <>
      {/* Role Icon Badge - Just the emoji */}
      <div 
        className="flex flex-col items-center justify-center px-2 py-1 rounded-lg bg-surface-800/50 border border-surface-700"
        aria-label={`Role: ${roleInfo.label}`}
      >
        <span className="text-xl leading-none" aria-hidden="true">{roleInfo.emoji}</span>
        <span className={`text-xs font-medium mt-0.5 ${roleInfo.color}`}>
          {roleInfo.label}
        </span>
      </div>

      {/* Auth Method Badge - Show for all auth methods (both Private and Public) */}
      {authMethodInfo && (
        <div 
          className={`flex flex-col items-center justify-center px-2 py-1 rounded-lg border ${authMethodInfo.bgColor} ${authMethodInfo.borderColor}`}
          aria-label={`Authentication: ${authMethodInfo.description}`}
          title={authMethodInfo.description}
        >
          <span className="text-xl leading-none" aria-hidden="true">{authMethodInfo.icon}</span>
          <span className={`text-xs font-medium mt-0.5 ${authMethodInfo.textColor}`}>
            {authMethodInfo.label}
          </span>
        </div>
      )}
    </>
  );
};


