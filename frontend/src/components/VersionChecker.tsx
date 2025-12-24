import { useContractVersions } from '@/hooks/useContractVersion';

// Inline SVG icon components to match project style
const AlertCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const AlertTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

interface VersionCheckerProps {
  /**
   * If true, only shows warnings when versions don't match
   * If false, shows all version information
   */
  warningOnly?: boolean;
  /**
   * Custom className for styling
   */
  className?: string;
}

/**
 * Component to check and display contract version compatibility
 * 
 * Usage:
 * ```tsx
 * // Show only warnings (recommended for most pages)
 * <VersionChecker warningOnly />
 * 
 * // Show all version info (good for admin pages)
 * <VersionChecker />
 * ```
 */
export function VersionChecker({ warningOnly = false, className = '' }: VersionCheckerProps) {
  const {
    certificateRegistry,
    institutionRegistry,
    allCompatible,
    anyNeedsUpgrade,
    isLoading,
    hasError,
  } = useContractVersions();

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 text-sm ${className}`}>
        <LoaderIcon className="h-4 w-4 animate-spin" />
        <span>Checking contract versions...</span>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className={`flex items-center gap-2 text-red-600 text-sm ${className}`}>
        <AlertCircleIcon className="h-4 w-4" />
        <span>Unable to verify contract versions</span>
      </div>
    );
  }

  // All compatible - only show if not warningOnly mode
  if (allCompatible && warningOnly) {
    return null;
  }

  if (allCompatible) {
    return (
      <div className={`flex items-center gap-2 text-green-600 text-sm ${className}`}>
        <CheckCircleIcon className="h-4 w-4" />
        <span>All contracts compatible (v{certificateRegistry.currentVersion})</span>
      </div>
    );
  }

  // Version mismatch warning
  if (anyNeedsUpgrade) {
    return (
      <div className={`border border-yellow-400 bg-yellow-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">
              Contract Version Mismatch
            </h3>
            <div className="space-y-1 text-sm text-yellow-700">
              {certificateRegistry.needsUpgrade && (
                <p>
                  • CertificateRegistry: Expected v{certificateRegistry.expectedVersion}, found v
                  {certificateRegistry.currentVersion}
                </p>
              )}
              {institutionRegistry.needsUpgrade && (
                <p>
                  • InstitutionRegistry: Expected v{institutionRegistry.expectedVersion}, found v
                  {institutionRegistry.currentVersion}
                </p>
              )}
            </div>
            <p className="text-sm text-yellow-700 mt-2">
              Please refresh the page or contact support if the issue persists.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Detailed version information component for admin pages
 */
export function VersionDetails({ className = '' }: { className?: string }) {
  const {
    certificateRegistry,
    institutionRegistry,
    isLoading,
  } = useContractVersions();

  if (isLoading) {
    return (
      <div className={`animate-pulse space-y-2 ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-1">CertificateRegistry</h4>
        <div className="flex items-center gap-2">
          {certificateRegistry.isCompatible ? (
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangleIcon className="h-4 w-4 text-yellow-600" />
          )}
          <span className="text-sm text-gray-600">
            Current: v{certificateRegistry.currentVersion || 'Unknown'} | Expected: v
            {certificateRegistry.expectedVersion}
          </span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-1">InstitutionRegistry</h4>
        <div className="flex items-center gap-2">
          {institutionRegistry.isCompatible ? (
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangleIcon className="h-4 w-4 text-yellow-600" />
          )}
          <span className="text-sm text-gray-600">
            Current: v{institutionRegistry.currentVersion || 'Unknown'} | Expected: v
            {institutionRegistry.expectedVersion}
          </span>
        </div>
      </div>
    </div>
  );
}
