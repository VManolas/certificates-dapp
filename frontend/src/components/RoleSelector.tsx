// frontend/src/components/RoleSelector.tsx
/**
 * Role Selector Component
 * =======================
 * 
 * Allows users to select their role/user type BEFORE connecting their wallet.
 * This is the first step in the authentication flow.
 * 
 * Flow:
 * 1. User selects role (Admin, University, Student, Employer)
 * 2. User clicks "Continue"
 * 3. User connects wallet
 * 4. Auth method selector appears based on selected role
 */

import { useState } from 'react';
import type { UserRole } from '@/store/authStore';

interface RoleSelectorProps {
  isOpen: boolean;
  onSelectRole: (role: UserRole, openConnectModal?: () => void) => void;
  openConnectModal?: () => void;
}

interface RoleOption {
  role: UserRole;
  icon: string;
  title: string;
  description: string;
  badge?: string;
  features: string[];
}

const roleOptions: RoleOption[] = [
  {
    role: 'admin',
    icon: '👔',
    title: 'Admin',
    description: 'System administrator with full access',
    badge: 'Public Auth Only',
    features: [
      'Manage universities and employers',
      'Oversee all certificates',
      'System configuration',
      'Must use standard Web3 login',
    ],
  },
  {
    role: 'university',
    icon: '🏛️',
    title: 'University',
    description: 'Educational institution issuing certificates',
    badge: 'Public Auth Only',
    features: [
      'Issue student certificates',
      'Bulk certificate operations',
      'Manage certificate templates',
      'Must use standard Web3 login',
    ],
  },
  {
    role: 'student',
    icon: '🎓',
    title: 'Student',
    description: 'Certificate holder with privacy options',
    badge: 'Privacy Recommended',
    features: [
      'View your certificates',
      'Share certificates privately',
      'Generate verification links',
      'Private or standard login available',
    ],
  },
  {
    role: 'employer',
    icon: '💼',
    title: 'Employer',
    description: 'Organization verifying credentials',
    badge: 'Flexible Auth',
    features: [
      'Verify student certificates',
      'Access certificate data',
      'Manage verification requests',
      'Private or standard login available',
    ],
  },
];

export function RoleSelector({ isOpen, onSelectRole, openConnectModal }: RoleSelectorProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  if (!isOpen) return null;

  const handleContinue = () => {
    if (selectedRole) {
      onSelectRole(selectedRole, openConnectModal);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-surface-900 rounded-2xl border border-surface-700 shadow-2xl w-full max-w-5xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="relative px-8 py-6 bg-gradient-to-r from-primary-900/30 to-accent-900/30 border-b border-surface-700">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Welcome to zkCredentials
            </h2>
            <p className="text-surface-300 text-sm">
              Select your role to continue with the appropriate authentication method
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {roleOptions.map((option) => (
              <button
                key={option.role}
                onClick={() => setSelectedRole(option.role)}
                className={`group text-left p-6 rounded-xl border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
                  selectedRole === option.role
                    ? 'border-primary-400 bg-primary-900/20 ring-2 ring-primary-500/30'
                    : 'border-surface-700 bg-surface-800/50 hover:border-primary-500/60'
                }`}
              >
                {/* Icon and Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-primary-500/10 flex items-center justify-center text-3xl group-hover:bg-primary-500/20 transition-colors">
                    {option.icon}
                  </div>
                  {option.badge && (
                    <span className={`px-2 py-1 text-xs rounded-full border ${
                      option.role === 'student'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : option.role === 'employer'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                    }`}>
                      {option.badge}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white mb-2">
                  {option.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-surface-400 mb-4">
                  {option.description}
                </p>

                {/* Features */}
                <div className="space-y-2">
                  {option.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <svg 
                        className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M5 13l4 4L19 7" 
                        />
                      </svg>
                      <span className="text-sm text-surface-300">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Selection Indicator */}
                {selectedRole === option.role && (
                  <div className="mt-4 pt-4 border-t border-primary-500/20">
                    <div className="flex items-center gap-2 text-primary-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path 
                          fillRule="evenodd" 
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!selectedRole}
            className={`w-full py-4 px-6 rounded-xl font-medium transition-all duration-300 ${
              selectedRole
                ? 'bg-primary-500 text-white hover:bg-primary-600 hover:shadow-lg hover:shadow-primary-500/30'
                : 'bg-surface-800 text-surface-500 cursor-not-allowed'
            }`}
          >
            {selectedRole ? (
              <span className="flex items-center justify-center gap-2">
                Continue as {roleOptions.find(r => r.role === selectedRole)?.title}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            ) : (
              'Select a role to continue'
            )}
          </button>

          {/* Info Footer */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-surface-300">
                  <strong className="text-white">Your role determines your authentication options.</strong> After selecting your role, you'll connect your wallet and choose between Private (ZKP) or Standard (Web3) login based on what's available for your role.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

