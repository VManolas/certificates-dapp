// frontend/src/components/RoleBadge.tsx
import { memo } from 'react';
import type { UserRole } from '@/types/auth';
import { getRoleMetadata, getRoleBadgeClasses } from '@/lib/constants/roles';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export const RoleBadge = memo(function RoleBadge({ 
  role, 
  size = 'md', 
  showIcon = true, 
  onClick,
  disabled = false,
}: RoleBadgeProps) {
  if (!role) return null;

  const metadata = getRoleMetadata(role);
  if (!metadata) return null;

  const { bgClass, textClass } = getRoleBadgeClasses(role, disabled);
  const isClickable = !!onClick && !disabled;
  
  const className = `
    inline-flex items-center gap-1.5 rounded-full border font-medium
    ${disabled 
      ? `${bgClass} ${textClass} opacity-50` 
      : `${bgClass} ${textClass}`
    }
    ${SIZE_CLASSES[size]}
    ${isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
    ${disabled ? 'cursor-not-allowed' : ''}
  `;
  
  const content = (
    <>
      {showIcon && <span className={disabled ? 'grayscale' : ''}>{metadata.icon}</span>}
      <span>{metadata.label}</span>
      {isClickable && (
        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </>
  );

  // If clickable, render as button. Otherwise, render as div to avoid nesting issues
  if (isClickable) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {content}
      </button>
    );
  }
  
  return (
    <div className={className}>
      {content}
    </div>
  );
});

