// frontend/src/components/zkauth/ZKAuthStatus.tsx
/**
 * ZK Auth Status Indicator
 * ========================
 * 
 * Shows the current ZK authentication status in the header.
 * Provides quick visual feedback and access to ZK auth settings.
 * 
 * Updated to use unified auth state for consistency across the app.
 */

import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { Link } from 'react-router-dom';

export function ZKAuthStatus() {
  const unifiedAuth = useUnifiedAuth();

  // For ZK auth, we need to check if:
  // 1. User is using ZK method (authMethod === 'zk')
  // 2. User has credentials OR is authenticated
  const isUsingZK = unifiedAuth.authMethod === 'zk';
  const hasCredentials = unifiedAuth.zkAuth.hasCredentials;
  const isAuthenticated = unifiedAuth.isAuthenticated;

  // Debug logging
  console.log('🔍 ZKAuthStatus Debug:', {
    role: unifiedAuth.role,
    authMethod: unifiedAuth.authMethod,
    isAuthenticated,
    hasCredentials,
    isUsingZK,
    shouldRender: isUsingZK && (hasCredentials || isAuthenticated)
  });

  // Don't show if not using ZK auth
  if (!isUsingZK) {
    console.log('❌ ZKAuthStatus: Not rendering - not using ZK auth');
    return null;
  }

  // Don't show if no credentials and not authenticated
  if (!hasCredentials && !isAuthenticated) {
    console.log('❌ ZKAuthStatus: Not rendering - no credentials and not authenticated');
    return null;
  }

  console.log('✅ ZKAuthStatus: Rendering with state:', {
    isUsingZK,
    isAuthenticated,
    hasCredentials
  });

  return (
    <Link
      to="/zkauth"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800/50 hover:bg-surface-800 transition-colors border border-surface-700"
      title={isAuthenticated ? 'ZK Auth Active' : hasCredentials ? 'ZK Auth Ready' : 'ZK Auth Disabled'}
    >
      <div className={`w-2 h-2 rounded-full ${
        isAuthenticated 
          ? 'bg-green-400 animate-pulse' 
          : hasCredentials 
            ? 'bg-yellow-400' 
            : 'bg-surface-600'
      }`} />
      <span className="text-xs text-surface-300 hidden md:inline">
        ZK: {isAuthenticated ? 'Active' : hasCredentials ? 'Ready' : 'Off'}
      </span>
      <svg className="w-3 h-3 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    </Link>
  );
}



