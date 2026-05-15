// frontend/src/components/ProgressSteps.tsx
/**
 * Progress Steps Component
 * ========================
 * 
 * Visual indicator for multi-step processes like ZK registration.
 * 
 * Usage:
 * ```tsx
 * <ProgressSteps
 *   steps={[
 *     { label: 'Connect Wallet', status: 'complete' },
 *     { label: 'Generate Keys', status: 'current' },
 *     { label: 'Secure Identity', status: 'pending' }
 *   ]}
 * />
 * ```
 */

interface Step {
  label: string;
  status: 'complete' | 'current' | 'pending' | 'error';
  description?: string;
}

interface ProgressStepsProps {
  steps: Step[];
  className?: string;
}

export function ProgressSteps({ steps, className = '' }: ProgressStepsProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        
        return (
          <div key={index} className="relative">
            {/* Connector Line */}
            {!isLast && (
              <div 
                className={`absolute left-4 top-8 w-0.5 h-full transition-colors duration-300 ${
                  step.status === 'complete' 
                    ? 'bg-green-500' 
                    : 'bg-surface-700'
                }`}
              />
            )}
            
            {/* Step Content */}
            <div className="flex items-start gap-3 relative">
              {/* Status Icon */}
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 
                transition-all duration-300 relative z-10
                ${step.status === 'complete' 
                  ? 'bg-green-500 text-white' 
                  : step.status === 'current'
                  ? 'bg-primary-500 text-white animate-pulse'
                  : step.status === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-surface-700 text-surface-400'
                }
              `}>
                {step.status === 'complete' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {step.status === 'current' && (
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {step.status === 'error' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {step.status === 'pending' && (
                  <div className="w-2 h-2 rounded-full bg-surface-400" />
                )}
              </div>
              
              {/* Step Label and Description */}
              <div className="flex-1 pt-0.5">
                <div className={`
                  font-medium transition-colors duration-300
                  ${step.status === 'complete' 
                    ? 'text-green-400' 
                    : step.status === 'current'
                    ? 'text-white'
                    : step.status === 'error'
                    ? 'text-red-400'
                    : 'text-surface-400'
                  }
                `}>
                  {step.label}
                </div>
                
                {step.description && (
                  <div className="text-sm text-surface-400 mt-0.5">
                    {step.description}
                  </div>
                )}
                
                {/* Status Text */}
                <div className={`
                  text-xs mt-1 transition-opacity duration-300
                  ${step.status === 'complete' 
                    ? 'text-green-400 opacity-100' 
                    : step.status === 'current'
                    ? 'text-primary-400 opacity-100'
                    : step.status === 'error'
                    ? 'text-red-400 opacity-100'
                    : 'opacity-0'
                  }
                `}>
                  {step.status === 'complete' && '✓ Done'}
                  {step.status === 'current' && '⏳ In Progress...'}
                  {step.status === 'error' && '✗ Failed'}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function ProgressStepsCompact({ steps, className = '' }: ProgressStepsProps) {
  const currentIndex = steps.findIndex(s => s.status === 'current');
  const completedCount = steps.filter(s => s.status === 'complete').length;
  
  return (
    <div className={`${className}`}>
      {/* Progress Bar */}
      <div className="w-full bg-surface-700 rounded-full h-2 overflow-hidden mb-2">
        <div 
          className="bg-primary-500 h-full transition-all duration-500 ease-out"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>
      
      {/* Current Step Text */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-surface-300">
          {currentIndex >= 0 ? steps[currentIndex].label : 'Complete'}
        </span>
        <span className="text-surface-400">
          {completedCount} / {steps.length}
        </span>
      </div>
    </div>
  );
}

