// frontend/src/components/RoleSelectorModal.tsx
import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, UserRole } from '@/store/authStore';

// All possible roles in display order
const ALL_ROLES: NonNullable<UserRole>[] = ['admin', 'university', 'student', 'employer'];

// Roles that support aspirational selection
const ASPIRATIONAL_ROLES: Set<NonNullable<UserRole>> = new Set(['university', 'student', 'employer']);

interface RoleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableRoles: UserRole[];
  universityData?: { name: string; isVerified: boolean } | null;
  studentCertificateCount?: number;
  canRegisterAsEmployer?: boolean;
}

const ROLE_INFO: Record<NonNullable<UserRole>, { 
  title: string; 
  description: string; 
  aspirationalDescription?: string;
  icon: string;
  color: string;
  disabledReason: string;
  aspirationalAction?: string;
}> = {
  admin: {
    title: 'Platform Administrator',
    description: 'Manage institutions, approve registrations, and oversee platform operations',
    icon: '🛡️',
    color: 'from-red-500 to-orange-500',
    disabledReason: 'Restricted to platform administrators with SUPER_ADMIN_ROLE',
  },
  university: {
    title: 'Educational Institution',
    description: 'Issue and manage educational certificates for your students',
    aspirationalDescription: 'Register your institution to start issuing certificates',
    icon: '🎓',
    color: 'from-blue-500 to-cyan-500',
    disabledReason: 'Register your institution first to access this role',
    aspirationalAction: 'Register Institution →',
  },
  student: {
    title: 'Student / Graduate',
    description: 'View and share your educational certificates with employers',
    aspirationalDescription: 'Once you receive certificates, they will appear here',
    icon: '📜',
    color: 'from-green-500 to-emerald-500',
    disabledReason: 'You will gain access once you receive a certificate',
    aspirationalAction: 'Explore as Student →',
  },
  employer: {
    title: 'Employer / Verifier',
    description: 'Verify candidate credentials instantly on the blockchain',
    aspirationalDescription: 'Register your company to access verification tools',
    icon: '🔍',
    color: 'from-purple-500 to-pink-500',
    disabledReason: 'Register as an employer to access this role',
    aspirationalAction: 'Register as Employer →',
  },
};

export const RoleSelectorModal = memo(function RoleSelectorModal({ 
  isOpen, 
  onClose, 
  availableRoles,
  universityData,
  studentCertificateCount = 0,
  canRegisterAsEmployer = false,
}: RoleSelectorModalProps) {
  const { setRole, setHasSelectedRole, setShowRoleSelector } = useAuthStore();
  const [showAspirational, setShowAspirational] = useState(false);
  const navigate = useNavigate();

  // Create a Set for O(1) lookup
  const availableRolesSet = new Set(availableRoles.filter(Boolean));

  const handleSelectRole = (role: NonNullable<UserRole>, isAspirational: boolean = false) => {
    console.log('🎯 handleSelectRole called', { role, isAspirational, canRegisterAsEmployer });
    
    // For non-aspirational, must be in available roles
    if (!isAspirational && !availableRolesSet.has(role)) return;
    // For aspirational, must be in ASPIRATIONAL_ROLES
    if (isAspirational && !ASPIRATIONAL_ROLES.has(role) && role !== 'employer') return;
    
    // Special handling for employer aspirational mode
    if (isAspirational && role === 'employer') {
      console.log('🚀 Navigating to /employer/register', { canRegisterAsEmployer });
      if (canRegisterAsEmployer) {
        navigate('/employer/register');
        onClose();
        return;
      } else {
        console.warn('❌ Cannot register as employer - canRegisterAsEmployer is false');
        return;
      }
    }
    
    setRole(role, isAspirational);
    setHasSelectedRole(true);
    setShowRoleSelector(false);
    onClose();
  };

  if (!isOpen) return null;

  // Show only verified roles, or all roles if showing aspirational
  const rolesToShow = ALL_ROLES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
        aria-hidden="true" 
      />

      {/* Modal */}
      <div className="relative mx-auto max-w-lg w-full bg-surface-900 rounded-2xl border border-surface-700 shadow-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="text-2xl font-bold text-white mb-2">
          Select Your Role
        </div>
        <div className="text-surface-400 mb-6">
          Choose how you'd like to use zkCredentials. Locked roles require specific on-chain status.
        </div>

        <div className="space-y-3">
          {rolesToShow.map((role) => {
            const info = ROLE_INFO[role];
            const isAvailable = availableRolesSet.has(role);
            const canAspire = (ASPIRATIONAL_ROLES.has(role) && !isAvailable) || 
                              (role === 'employer' && canRegisterAsEmployer && !isAvailable);
            
            // Debug logging for employer role
            if (role === 'employer') {
              console.log('👔 Employer role debug:', { 
                isAvailable, 
                canRegisterAsEmployer, 
                canAspire,
                showAspirational,
                willShowButton: canAspire && showAspirational && info.aspirationalAction
              });
            }
            
            // Add extra context for certain roles
            let extraInfo = '';
            if (role === 'university' && universityData && isAvailable) {
              extraInfo = universityData.isVerified 
                ? `✓ Verified: ${universityData.name}`
                : `⏳ Pending verification: ${universityData.name}`;
            }
            if (role === 'student' && isAvailable) {
              extraInfo = `${studentCertificateCount} certificate${studentCertificateCount !== 1 ? 's' : ''}`;
            }

            return (
              <div key={role} className="space-y-2">
                <button
                  onClick={() => handleSelectRole(role, false)}
                  disabled={!isAvailable}
                  className={`
                    w-full p-4 rounded-xl border transition-all text-left
                    ${isAvailable 
                      ? 'border-surface-700 hover:border-surface-500 bg-surface-800 hover:bg-surface-750 cursor-pointer group'
                      : 'border-surface-800 bg-surface-900/50 cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  <div className="flex items-start gap-4">
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center text-2xl
                      ${isAvailable 
                        ? `bg-gradient-to-br ${info.color}` 
                        : 'bg-surface-800'
                      }
                    `}>
                      {info.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`
                          font-semibold transition-colors
                          ${isAvailable 
                            ? 'text-white group-hover:text-primary-300' 
                            : 'text-surface-500'
                          }
                        `}>
                          {info.title}
                        </h3>
                        {!isAvailable && (
                          <span className="text-surface-600 text-sm">🔒</span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${isAvailable ? 'text-surface-400' : 'text-surface-600'}`}>
                        {isAvailable ? info.description : info.disabledReason}
                      </p>
                      {extraInfo && isAvailable && (
                        <p className="text-xs text-primary-400 mt-2">
                          {extraInfo}
                        </p>
                      )}
                    </div>
                    {isAvailable && (
                      <svg 
                        className="w-5 h-5 text-surface-500 group-hover:text-white transition-colors mt-1" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </button>

                {/* Aspirational option for locked roles */}
                {canAspire && showAspirational && info.aspirationalAction && (
                  <button
                    onClick={() => handleSelectRole(role, true)}
                    className="w-full ml-4 p-3 rounded-lg border border-dashed border-surface-600 hover:border-primary-500/50 bg-surface-900/50 hover:bg-primary-500/5 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-lg">
                        ✨
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-surface-300 group-hover:text-primary-300 transition-colors">
                          {info.aspirationalAction}
                        </p>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {info.aspirationalDescription}
                        </p>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Toggle aspirational roles */}
        {!showAspirational && availableRoles.filter(r => r && !ASPIRATIONAL_ROLES.has(r as NonNullable<UserRole>)).length < ALL_ROLES.length && (
          <button
            onClick={() => setShowAspirational(true)}
            className="w-full mt-4 py-3 text-sm text-primary-400 hover:text-primary-300 transition-colors flex items-center justify-center gap-2"
          >
            <span>I want to explore a different role</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {showAspirational && (
          <button
            onClick={() => setShowAspirational(false)}
            className="w-full mt-4 py-3 text-sm text-surface-500 hover:text-surface-400 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span>Show only verified roles</span>
          </button>
        )}

        <p className="text-xs text-surface-500 mt-6 text-center">
          You can switch roles anytime from the header menu.
        </p>
      </div>
    </div>
  );
});
