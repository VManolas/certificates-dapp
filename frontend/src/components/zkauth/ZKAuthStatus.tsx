// frontend/src/components/zkauth/ZKAuthStatus.tsx
/**
 * ZK Auth Status Indicator
 * ========================
 * 
 * Shows the current ZK authentication status in the header.
 * Provides quick visual feedback and access to ZK auth settings.
 */

import { useAuthStore } from '@/store/authStore';
import { Link } from 'react-router-dom';

export function ZKAuthStatus() {
  const { zkAuth, role } = useAuthStore();

  // Don't show if no role selected
  if (!role) return null;

  const isEnabled = zkAuth.isZKAuthEnabled;
  const isAuthenticated = zkAuth.isZKAuthenticated;

  return (
    <Link
      to="/zkauth"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800/50 hover:bg-surface-800 transition-colors border border-surface-700"
      title={isEnabled ? 'ZK Auth Enabled' : 'ZK Auth Disabled'}
    >
      <div className={`w-2 h-2 rounded-full ${isEnabled && isAuthenticated ? 'bg-green-400 animate-pulse' : isEnabled ? 'bg-yellow-400' : 'bg-surface-600'}`} />
      <span className="text-xs text-surface-300 hidden md:inline">
        ZK: {isEnabled ? (isAuthenticated ? 'Active' : 'Ready') : 'Off'}
      </span>
      <svg className="w-3 h-3 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    </Link>
  );
}

