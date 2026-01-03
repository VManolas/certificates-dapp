// frontend/src/components/zkauth/ZKAuthButton.tsx
/**
 * ZK Authentication Button Component
 * ===================================
 * 
 * Provides one-click ZK authentication for users.
 * Handles both registration (first-time users) and login (returning users).
 * 
 * Features:
 * - Auto-detects if user has stored credentials
 * - Shows appropriate action (Register vs Login)
 * - Loading states and error handling
 * - Role selection for registration
 * 
 * Usage:
 * ```tsx
 * <ZKAuthButton />
 * ```
 */

import { useState } from 'react';
import { useZKAuth } from '@/hooks/useZKAuth';
import { useAccount } from 'wagmi';
import { logger } from '@/lib/logger';

type UserRole = 'student' | 'university' | 'employer';

export function ZKAuthButton() {
  const { isConnected } = useAccount();
  const { 
    register, 
    login, 
    logout,
    isAuthenticated, 
    role,
    isLoading, 
    hasCredentials,
    error 
  } = useZKAuth();

  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');

  const handleRegister = async () => {
    if (!selectedRole) {
      alert('Please select a role');
      return;
    }

    try {
      logger.info('Starting ZK registration', { role: selectedRole });
      await register(selectedRole);
      logger.info('Registration successful');
      alert(`✅ Registered as ${selectedRole}! You can now login.`);
      setShowRoleSelector(false);
      
      // Auto-login after registration
      setTimeout(async () => {
        await login();
      }, 500);
    } catch (error: any) {
      logger.error('Registration failed', error);
      alert(`❌ Registration failed: ${error.message}`);
    }
  };

  const handleLogin = async () => {
    try {
      logger.info('Starting ZK login');
      await login();
      logger.info('Login successful');
      alert('✅ Logged in successfully!');
    } catch (error: any) {
      logger.error('Login failed', error);
      alert(`❌ Login failed: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      alert('✅ Logged out successfully!');
    } catch (error: any) {
      logger.error('Logout failed', error);
      alert(`❌ Logout failed: ${error.message}`);
    }
  };

  // Not connected to wallet
  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg">
        <span>🔌</span>
        <span>Connect wallet to use ZK Auth</span>
      </div>
    );
  }

  // Already authenticated
  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 text-sm bg-green-50 border border-green-200 rounded-lg">
          <span>✅</span>
          <span className="font-medium text-green-700">
            Authenticated as {role}
          </span>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
        >
          {isLoading ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    );
  }

  // Role selection modal for registration
  if (showRoleSelector) {
    return (
      <div className="flex flex-col gap-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Select Your Role
          </h3>
          <button
            onClick={() => setShowRoleSelector(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="flex flex-col gap-2">
          {[
            { value: 'student', label: '🎓 Student', desc: 'Receive and manage certificates' },
            { value: 'university', label: '🏫 University', desc: 'Issue and manage certificates' },
            { value: 'employer', label: '💼 Employer', desc: 'Verify certificates' },
            { value: 'admin', label: '👑 Admin', desc: 'Manage system with privacy' },
          ].map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white"
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={selectedRole === option.value}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="mt-1"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">
                  {option.label}
                </span>
                <span className="text-xs text-gray-500">
                  {option.desc}
                </span>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={handleRegister}
          disabled={isLoading}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? '⏳ Registering...' : '🚀 Register with ZK Proof'}
        </button>

        {error && (
          <div className="p-2 text-xs text-red-600 bg-red-50 rounded">
            ❌ {error.message}
          </div>
        )}
      </div>
    );
  }

  // First-time user - show register button
  if (!hasCredentials) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowRoleSelector(true)}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? '⏳ Loading...' : '🔐 Register with ZK Auth'}
        </button>
        <p className="text-xs text-gray-500 text-center">
          Privacy-preserving authentication
        </p>
      </div>
    );
  }

  // Returning user - show login button
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        {isLoading ? '⏳ Logging in...' : '🔑 Login with ZK Proof'}
      </button>
      <p className="text-xs text-gray-500 text-center">
        Welcome back! Click to authenticate.
      </p>
      {error && (
        <div className="p-2 text-xs text-red-600 bg-red-50 rounded">
          ❌ {error.message}
        </div>
      )}
    </div>
  );
}

