// frontend/src/components/RoleDropdown.tsx
/**
 * Role Dropdown Component
 * =======================
 * 
 * Displays the currently selected role in the header and allows changing it
 * before wallet connection.
 * 
 * Features:
 * - Shows current role with icon
 * - Dropdown menu with all role options
 * - Only allows changing role before wallet connection
 * - Visual feedback for current selection
 */

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import type { UserRole } from '@/store/authStore';

interface RoleDropdownProps {
  currentRole: UserRole | null;
  onChangeRole: (role: UserRole) => void;
}

interface RoleOption {
  role: UserRole;
  icon: string;
  label: string;
  badge?: string;
}

const roleOptions: RoleOption[] = [
  {
    role: 'admin',
    icon: '👔',
    label: 'Admin',
    badge: 'Public Auth',
  },
  {
    role: 'university',
    icon: '🏛️',
    label: 'University',
    badge: 'Public Auth',
  },
  {
    role: 'student',
    icon: '🎓',
    label: 'Student',
    badge: 'Privacy',
  },
  {
    role: 'employer',
    icon: '💼',
    label: 'Employer',
    badge: 'Flexible',
  },
];

export function RoleDropdown({ currentRole, onChangeRole }: RoleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isConnected } = useAccount();

  const currentRoleOption = roleOptions.find(r => r.role === currentRole);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentRole || !currentRoleOption) return null;

  const handleRoleChange = (role: UserRole) => {
    if (!isConnected) {
      onChangeRole(role);
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => !isConnected && setIsOpen(!isOpen)}
        disabled={isConnected}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
          isConnected
            ? 'border-surface-700 bg-surface-800 cursor-not-allowed opacity-50'
            : 'border-surface-700 bg-surface-800 hover:border-primary-500 hover:bg-surface-700'
        }`}
        aria-label="Select role"
      >
        <span className="text-xl">{currentRoleOption.icon}</span>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-white">
            {currentRoleOption.label}
          </span>
          {currentRoleOption.badge && (
            <span className="text-xs text-surface-400">
              {currentRoleOption.badge}
            </span>
          )}
        </div>
        {!isConnected && (
          <svg
            className={`w-4 h-4 text-surface-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isConnected && (
        <div className="absolute right-0 mt-2 w-64 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
          <div className="p-2">
            <div className="px-3 py-2 text-xs text-surface-400 font-medium uppercase tracking-wider">
              Change Role
            </div>
            {roleOptions.map((option) => (
              <button
                key={option.role}
                onClick={() => handleRoleChange(option.role)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                  option.role === currentRole
                    ? 'bg-primary-500/20 border border-primary-500/50'
                    : 'hover:bg-surface-700'
                }`}
              >
                <span className="text-2xl">{option.icon}</span>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {option.label}
                    </span>
                    {option.role === currentRole && (
                      <svg
                        className="w-4 h-4 text-primary-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  {option.badge && (
                    <span className="text-xs text-surface-400">
                      {option.badge}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Info */}
          <div className="px-3 py-2 bg-surface-900 border-t border-surface-700">
            <p className="text-xs text-surface-400">
              <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Role can only be changed before connecting wallet
            </p>
          </div>
        </div>
      )}

      {/* Locked indicator when connected */}
      {isConnected && (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-surface-900 rounded-full border-2 border-surface-800 flex items-center justify-center">
          <svg className="w-3 h-3 text-surface-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
}

