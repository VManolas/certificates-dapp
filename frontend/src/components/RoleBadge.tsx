// frontend/src/components/RoleBadge.tsx
import { memo } from 'react';
import { UserRole } from '@/store/authStore';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const ROLE_CONFIG: Record<NonNullable<UserRole>, { 
  label: string; 
  icon: string;
  bgClass: string;
  textClass: string;
  disabledBgClass: string;
  disabledTextClass: string;
}> = {
  admin: {
    label: 'Admin',
    icon: '🛡️',
    bgClass: 'bg-red-500/10 border-red-500/30',
    textClass: 'text-red-400',
    disabledBgClass: 'bg-surface-800 border-surface-700',
    disabledTextClass: 'text-surface-600',
  },
  university: {
    label: 'University',
    icon: '🎓',
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    textClass: 'text-blue-400',
    disabledBgClass: 'bg-surface-800 border-surface-700',
    disabledTextClass: 'text-surface-600',
  },
  student: {
    label: 'Student',
    icon: '📜',
    bgClass: 'bg-green-500/10 border-green-500/30',
    textClass: 'text-green-400',
    disabledBgClass: 'bg-surface-800 border-surface-700',
    disabledTextClass: 'text-surface-600',
  },
  employer: {
    label: 'Employer',
    icon: '🔍',
    bgClass: 'bg-purple-500/10 border-purple-500/30',
    textClass: 'text-purple-400',
    disabledBgClass: 'bg-surface-800 border-surface-700',
    disabledTextClass: 'text-surface-600',
  },
};

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

  const config = ROLE_CONFIG[role];
  const isClickable = !!onClick && !disabled;
  
  const className = `
    inline-flex items-center gap-1.5 rounded-full border font-medium
    ${disabled 
      ? `${config.disabledBgClass} ${config.disabledTextClass} opacity-50` 
      : `${config.bgClass} ${config.textClass}`
    }
    ${SIZE_CLASSES[size]}
    ${isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
    ${disabled ? 'cursor-not-allowed' : ''}
  `;
  
  const content = (
    <>
      {showIcon && <span className={disabled ? 'grayscale' : ''}>{config.icon}</span>}
      <span>{config.label}</span>
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

