/**
 * Modal Component
 * ===============
 * 
 * Reusable modal wrapper with consistent styling and behavior.
 * Provides backdrop, container, and accessibility features.
 * 
 * Features:
 * - Configurable backdrop blur and opacity
 * - Consistent z-index management
 * - Optional close on backdrop click
 * - Keyboard navigation (ESC to close)
 * - Scroll lock when open
 * - Customizable max width
 * - Animation support
 * 
 * @module components/ui/Modal
 */

import { useEffect, useCallback, type ReactNode } from 'react';

export interface ModalProps {
  /** Whether the modal is currently open */
  isOpen: boolean;
  
  /** Callback when modal should close */
  onClose: () => void;
  
  /** Modal content */
  children: ReactNode;
  
  /** Maximum width of modal content */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  
  /** Whether clicking backdrop closes modal (default: true) */
  closeOnBackdropClick?: boolean;
  
  /** Whether ESC key closes modal (default: true) */
  closeOnEscape?: boolean;
  
  /** Custom z-index (default: z-50) */
  zIndex?: 50 | 60 | 70;
  
  /** Custom backdrop blur class (default: backdrop-blur-sm) */
  backdropBlur?: 'none' | 'sm' | 'md' | 'lg';
  
  /** Custom backdrop opacity (default: bg-black/60) */
  backdropOpacity?: 40 | 50 | 60 | 70 | 80;
  
  /** Show animation (default: true) */
  showAnimation?: boolean;
  
  /** Custom padding for modal content */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  
  /** Additional className for modal container */
  className?: string;
  
  /** Additional className for backdrop */
  backdropClassName?: string;
}

const MAX_WIDTH_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-full',
};

const PADDING_CLASSES = {
  none: 'p-0',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-8',
};

const BACKDROP_BLUR_CLASSES = {
  none: '',
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
};

/**
 * Modal wrapper component
 * 
 * @example
 * ```tsx
 * <Modal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   maxWidth="lg"
 * >
 *   <div className="p-6">
 *     <h2>Modal Title</h2>
 *     <p>Modal content...</p>
 *   </div>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  children,
  maxWidth = 'lg',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  zIndex = 50,
  backdropBlur = 'sm',
  backdropOpacity = 60,
  showAnimation = true,
  padding = 'md',
  className = '',
  backdropClassName = '',
}: ModalProps) {
  // Handle ESC key press
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [closeOnEscape, isOpen, onClose]
  );

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (closeOnEscape) {
        document.addEventListener('keydown', handleEscape);
      }
    }

    return () => {
      document.body.style.overflow = '';
      if (closeOnEscape) {
        document.removeEventListener('keydown', handleEscape);
      }
    };
  }, [isOpen, closeOnEscape, handleEscape]);

  // Handle backdrop click
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const zIndexClass = `z-${zIndex}`;
  const maxWidthClass = MAX_WIDTH_CLASSES[maxWidth];
  const paddingClass = PADDING_CLASSES[padding];
  const backdropBlurClass = BACKDROP_BLUR_CLASSES[backdropBlur];
  const backdropOpacityClass = `bg-black/${backdropOpacity}`;
  const animationClass = showAnimation ? 'animate-fadeIn' : '';

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center ${paddingClass} ${animationClass} ${backdropOpacityClass} ${backdropBlurClass} ${backdropClassName}`.trim()}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-surface-900 rounded-2xl shadow-2xl w-full border border-surface-700 ${maxWidthClass} ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Modal Header Component
 * Standardized modal header with title and close button
 */
export interface ModalHeaderProps {
  /** Header title */
  title: string;
  
  /** Optional subtitle */
  subtitle?: string;
  
  /** Callback when close button clicked */
  onClose: () => void;
  
  /** Optional icon */
  icon?: ReactNode;
  
  /** Additional className */
  className?: string;
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
  icon,
  className = '',
}: ModalHeaderProps) {
  return (
    <div className={`flex items-center justify-between p-6 border-b border-surface-700 ${className}`.trim()}>
      <div className="flex items-center gap-3">
        {icon && <div className="text-2xl">{icon}</div>}
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {subtitle && (
            <p className="text-sm text-surface-400 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-surface-400 hover:text-white transition-colors"
        aria-label="Close modal"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Modal Body Component
 * Standardized modal body with optional scrolling
 */
export interface ModalBodyProps {
  /** Body content */
  children: ReactNode;
  
  /** Enable scrolling for overflow content */
  scrollable?: boolean;
  
  /** Maximum height for scrollable content */
  maxHeight?: string;
  
  /** Additional className */
  className?: string;
}

export function ModalBody({
  children,
  scrollable = false,
  maxHeight = 'max-h-[70vh]',
  className = '',
}: ModalBodyProps) {
  const scrollClass = scrollable ? `overflow-y-auto ${maxHeight}` : '';
  
  return (
    <div className={`p-6 ${scrollClass} ${className}`.trim()}>
      {children}
    </div>
  );
}

/**
 * Modal Footer Component
 * Standardized modal footer with action buttons
 */
export interface ModalFooterProps {
  /** Footer content */
  children: ReactNode;
  
  /** Additional className */
  className?: string;
}

export function ModalFooter({
  children,
  className = '',
}: ModalFooterProps) {
  return (
    <div className={`flex items-center justify-end gap-3 p-6 border-t border-surface-700 ${className}`.trim()}>
      {children}
    </div>
  );
}
