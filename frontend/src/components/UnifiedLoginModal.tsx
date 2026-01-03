// frontend/src/components/UnifiedLoginModal.tsx
/**
 * Unified Login Modal
 * ===================
 * 
 * A modal wrapper for the UnifiedAuthFlow component.
 * Provides a consistent modal interface for authentication across the application.
 */

import { UnifiedAuthFlow } from './UnifiedAuthFlow';
import type { UserRole } from '@/store/authStore';

interface UnifiedLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
  /** Pre-selected role from the role selector */
  preSelectedRole?: UserRole | null;
}

export function UnifiedLoginModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Welcome to zkCredentials',
  description = 'Follow the steps to complete your authentication',
  preSelectedRole = null,
}: UnifiedLoginModalProps) {
  const handleSuccess = () => {
    console.log('[UnifiedLoginModal] Authentication successful! Closing modal and calling success callback.');
    
    // Close modal FIRST to prevent re-renders
    onClose();
    
    // Then call success callback (navigation)
    setTimeout(() => {
      onSuccess?.();
    }, 100);
  };

  // If not open, don't render
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-surface-900 rounded-2xl shadow-2xl border border-surface-700 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-primary-900/30 to-accent-900/30 border-b border-surface-700">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-surface-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="pr-10">
            <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
            <p className="text-surface-300 text-sm">{description}</p>
          </div>
        </div>

        {/* Unified Auth Flow */}
        <div className="p-6">
          <UnifiedAuthFlow
            preSelectedRole={preSelectedRole}
            onComplete={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
