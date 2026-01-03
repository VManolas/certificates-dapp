// frontend/src/components/RoleConflictModal.tsx
import { memo } from 'react';
import { useDisconnect } from 'wagmi';
import { type UserRole } from '@/store/authStore';

interface RoleConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestedRole: UserRole;
  detectedRole: UserRole;
  detectedRoles: UserRole[];
  walletAddress: string;
  onAcceptDetectedRole: () => void;
}

const ROLE_DISPLAY: Record<NonNullable<UserRole>, { name: string; icon: string; color: string }> = {
  admin: { name: 'Administrator', icon: '🛡️', color: 'from-red-500 to-orange-500' },
  university: { name: 'University', icon: '🎓', color: 'from-blue-500 to-cyan-500' },
  student: { name: 'Student', icon: '📜', color: 'from-green-500 to-emerald-500' },
  employer: { name: 'Employer', icon: '🔍', color: 'from-purple-500 to-pink-500' },
};

const CONFLICT_REASONS: Record<NonNullable<UserRole>, string> = {
  admin: 'This wallet has admin privileges and can only be used for administrative functions.',
  university: 'This wallet is registered as an educational institution and can only issue certificates.',
  student: 'This wallet has received academic certificates and is registered as a student account.',
  employer: 'This wallet is registered as an employer organization.',
};

export const RoleConflictModal = memo(function RoleConflictModal({
  isOpen,
  onClose,
  requestedRole,
  detectedRole,
  detectedRoles,
  walletAddress,
  onAcceptDetectedRole,
}: RoleConflictModalProps) {
  const { disconnect } = useDisconnect();

  if (!isOpen || !requestedRole || !detectedRole) return null;

  const requestedRoleInfo = ROLE_DISPLAY[requestedRole as NonNullable<UserRole>];
  const detectedRoleInfo = ROLE_DISPLAY[detectedRole as NonNullable<UserRole>];

  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  const handleAcceptDetectedRole = () => {
    onAcceptDetectedRole();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-surface-900 rounded-2xl border border-surface-700 shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn">
        {/* Header with Warning */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-orange-900/40 to-red-900/40 border-b border-orange-500/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-1">
                Wallet Already Registered
              </h3>
              <p className="text-sm text-orange-200/80">
                This wallet has a different role assigned
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Requested vs Detected */}
          <div className="space-y-4">
            {/* Requested Role */}
            <div className="p-4 rounded-xl bg-surface-800/50 border border-surface-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-2xl">{requestedRoleInfo.icon}</div>
                <div className="flex-1">
                  <div className="text-xs text-surface-500 uppercase tracking-wide mb-1">
                    You Selected
                  </div>
                  <div className="font-semibold text-white">
                    {requestedRoleInfo.name}
                  </div>
                </div>
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>

            {/* Arrow Down */}
            <div className="flex justify-center">
              <svg className="w-6 h-6 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            {/* Detected Role */}
            <div className={`p-4 rounded-xl bg-gradient-to-br ${detectedRoleInfo.color} bg-opacity-10 border border-surface-600`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-2xl">{detectedRoleInfo.icon}</div>
                <div className="flex-1">
                  <div className="text-xs text-surface-400 uppercase tracking-wide mb-1">
                    This Wallet Is
                  </div>
                  <div className="font-semibold text-white">
                    {detectedRoleInfo.name}
                  </div>
                </div>
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-surface-300 mb-2">
                  <strong className="text-white">Why this happened:</strong>
                </p>
                <p className="text-sm text-surface-400">
                  {CONFLICT_REASONS[detectedRole as NonNullable<UserRole>]}
                </p>
              </div>
            </div>
          </div>

          {/* Wallet Address */}
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700">
            <div className="text-xs text-surface-500 uppercase tracking-wide mb-1">
              Connected Wallet
            </div>
            <div className="font-mono text-sm text-surface-300 break-all">
              {walletAddress}
            </div>
          </div>

          {/* Role Hierarchy Info */}
          <div className="p-4 rounded-xl bg-surface-800/30 border border-surface-700">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-white mb-1">
                  Role Hierarchy Policy
                </p>
                <p className="text-xs text-surface-400">
                  For security and data integrity, each wallet can only have one primary role. 
                  {detectedRoles.length > 1 ? (
                    <> However, this wallet has multiple roles available: {detectedRoles.filter(r => r).map(r => ROLE_DISPLAY[r as NonNullable<UserRole>].name).join(', ')}.</>
                  ) : (
                    <> Students cannot register as employers to maintain clear credential ownership.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
          {/* Primary Action: Accept Detected Role */}
          <button
            onClick={handleAcceptDetectedRole}
            className="w-full py-3 px-4 rounded-xl font-medium bg-primary-500 text-white hover:bg-primary-600 transition-all hover:shadow-lg hover:shadow-primary-500/30 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Continue as {detectedRoleInfo.name}
          </button>

          {/* Secondary Action: Disconnect & Use Different Wallet */}
          <button
            onClick={handleDisconnect}
            className="w-full py-3 px-4 rounded-xl font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white transition-all border border-surface-700 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Disconnect & Use Different Wallet
          </button>

          {/* Tertiary Action: Cancel */}
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-surface-500 hover:text-surface-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});

