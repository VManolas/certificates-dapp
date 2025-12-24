// frontend/src/components/RoleSwitcher.tsx
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useAuthStore, UserRole } from '@/store/authStore';
import { RoleBadge } from './RoleBadge';

// All possible roles in display order
const ALL_ROLES: NonNullable<UserRole>[] = ['admin', 'university', 'student', 'employer'];

// Tooltip messages for disabled roles
const DISABLED_TOOLTIPS: Record<NonNullable<UserRole>, string> = {
  admin: 'Admin access is restricted to platform administrators',
  university: 'Register your institution to access university features',
  student: "You'll appear here once you receive a certificate",
  employer: '', // Never disabled
};

interface RoleSwitcherProps {
  /** Roles that the user is eligible to select */
  availableRoles: UserRole[];
}

export const RoleSwitcher = memo(function RoleSwitcher({ availableRoles }: RoleSwitcherProps) {
  const { role, setRole } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredRole, setHoveredRole] = useState<UserRole>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Memoize Set creation for O(1) lookup
  const availableRolesSet = useMemo(() => 
    new Set(availableRoles.filter(Boolean)), 
    [availableRoles]
  );

  // Memoize toggle function
  const toggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Memoize role selection handler
  const handleRoleSelect = useCallback((selectedRole: NonNullable<UserRole>) => {
    setRole(selectedRole);
    setIsOpen(false);
  }, [setRole]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If no roles available yet, don't show anything
  if (availableRoles.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <RoleBadge 
        role={role} 
        size="sm" 
        onClick={toggleDropdown} 
      />
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface-800 border border-surface-700 shadow-xl z-50">
          <div className="p-2">
            <p className="text-xs text-surface-500 px-2 py-1 mb-1">Switch Role</p>
            {ALL_ROLES.map((r) => {
              const isAvailable = availableRolesSet.has(r);
              const isActive = r === role;
              const isHovered = r === hoveredRole;

              return (
                <div key={r} className="relative">
                  <button
                    onClick={() => {
                      if (isAvailable) {
                        handleRoleSelect(r);
                      }
                    }}
                    onMouseEnter={() => setHoveredRole(r)}
                    onMouseLeave={() => setHoveredRole(null)}
                    disabled={!isAvailable}
                    className={`
                      w-full px-3 py-2 rounded-lg text-left text-sm transition-all
                      ${isActive 
                        ? 'bg-primary-500/20 text-primary-300' 
                        : isAvailable
                          ? 'text-surface-300 hover:bg-surface-700 cursor-pointer'
                          : 'text-surface-600 cursor-not-allowed opacity-50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <RoleBadge 
                        role={r} 
                        size="sm" 
                        showIcon={true}
                      />
                      <span className="flex items-center gap-2">
                        {!isAvailable && (
                          <span className="text-xs text-surface-600">🔒</span>
                        )}
                        {isActive && (
                          <span className="text-primary-400">✓</span>
                        )}
                      </span>
                    </div>
                  </button>
                  
                  {/* Tooltip for disabled roles */}
                  {!isAvailable && isHovered && DISABLED_TOOLTIPS[r] && (
                    <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 
                                    px-3 py-2 bg-surface-900 border border-surface-700 
                                    rounded-lg shadow-lg text-xs text-surface-400 
                                    whitespace-nowrap z-50">
                      {DISABLED_TOOLTIPS[r]}
                      {/* Arrow pointing right */}
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full
                                      border-8 border-transparent border-l-surface-900" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Footer hint */}
          <div className="border-t border-surface-700 px-4 py-2">
            <p className="text-xs text-surface-500">
              🔒 Locked roles require specific on-chain status
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

