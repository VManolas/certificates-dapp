// src/components/Layout.tsx
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import { useUserRoles } from '@/hooks/useUserRoles';
import { RoleSwitcher } from './RoleSwitcher';
import { RoleSelectorModal } from './RoleSelectorModal';
import { SkipToContent } from './SkipToContent';

export function Layout() {
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const { 
    setAddress, 
    role, 
    isAspirationalRole,
    setRole,
    hasSelectedRole, 
    detectedRoles,
    setDetectedRoles,
    showRoleSelector,
    setShowRoleSelector,
    setIsRoleDetectionComplete,
    institutionData,
    setInstitutionData,
    setRefetchInstitution,
  } = useAuthStore();

  // Detect user roles from on-chain data
  const { 
    availableRoles, 
    isLoading: isDetectingRoles, 
    universityData,
    studentCertificateCount,
    canRegisterAsEmployer,
    refetch: refetchRoles,
  } = useUserRoles();

  // Set refetch function in auth store for other components
  useEffect(() => {
    setRefetchInstitution(refetchRoles);
  }, [refetchRoles, setRefetchInstitution]);

  // Sync wallet connection with auth store
  useEffect(() => {
    setAddress(isConnected && address ? address : null);
  }, [address, isConnected, setAddress]);

  // Sync institution data to auth store
  useEffect(() => {
    if (universityData) {
      setInstitutionData({
        name: universityData.name,
        emailDomain: universityData.emailDomain,
        isVerified: universityData.isVerified,
        isActive: universityData.isActive,
        verificationDate: Number(universityData.verificationDate),
        totalCertificatesIssued: Number(universityData.totalCertificatesIssued),
      });
    } else if (role === 'university' && !universityData) {
      // Clear institution data if no longer detected
      setInstitutionData(null);
    }
  }, [universityData, role, setInstitutionData]);

  // Handle role detection completion
  useEffect(() => {
    if (!isDetectingRoles && isConnected && availableRoles.length > 0) {
      setDetectedRoles(availableRoles);
      setIsRoleDetectionComplete(true);

      // If user hasn't selected a role yet
      if (!hasSelectedRole) {
        if (availableRoles.length === 1) {
          // Auto-select if only one role
          setRole(availableRoles[0]);
        } else if (availableRoles.length > 1) {
          // Show modal if multiple roles
          setShowRoleSelector(true);
        }
      }
    }
  }, [availableRoles, isDetectingRoles, isConnected, hasSelectedRole, setDetectedRoles, setIsRoleDetectionComplete, setRole, setShowRoleSelector]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col">
      <SkipToContent />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-surface-800 bg-surface-950/80 backdrop-blur-lg" role="banner">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center gap-2"
            aria-label="zkCredentials - Home"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center" aria-hidden="true">
              <span className="text-white font-bold text-sm">zk</span>
            </div>
            <span className="text-xl font-bold gradient-text">zkCredentials</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6" role="navigation" aria-label="Main navigation">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors ${
                isActive('/') ? 'text-white' : 'text-surface-400 hover:text-white'
              }`}
              aria-current={isActive('/') ? 'page' : undefined}
            >
              Home
            </Link>
            {isConnected && role !== 'admin' && (
              <Link
                to="/verify"
                className={`text-sm font-medium transition-colors ${
                  isActive('/verify') ? 'text-white' : 'text-surface-400 hover:text-white'
                }`}
                aria-current={isActive('/verify') ? 'page' : undefined}
              >
                Verify
              </Link>
            )}
            {isConnected && role === 'university' && !isAspirationalRole && (
              <Link
                to="/university/dashboard"
                className={`text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/university')
                    ? 'text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Dashboard
              </Link>
            )}
            {isConnected && role === 'university' && isAspirationalRole && (
              <Link
                to="/university/register"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/university/register'
                    ? 'text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Register Institution
              </Link>
            )}
            {isConnected && role === 'student' && (
              <Link
                to="/student/certificates"
                className={`text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/student')
                    ? 'text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                My Certificates
              </Link>
            )}
            {isConnected && role === 'employer' && (
              <Link
                to="/employer/dashboard"
                className={`text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/employer')
                    ? 'text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Dashboard
              </Link>
            )}
            {isConnected && role === 'admin' && (
              <Link
                to="/admin/dashboard"
                className={`text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/admin')
                    ? 'text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Wallet Connection + Role Display */}
          <div className="flex items-center gap-3">
            {isConnected && !isDetectingRoles && (
              <RoleSwitcher availableRoles={detectedRoles} />
            )}
            {isConnected && isDetectingRoles && (
              <div className="animate-pulse bg-surface-700 rounded-full px-3 py-1 text-xs text-surface-400">
                Detecting roles...
              </div>
            )}
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />
          </div>
        </div>
      </header>

      {/* Role Selector Modal */}
      <RoleSelectorModal
        isOpen={showRoleSelector}
        onClose={() => setShowRoleSelector(false)}
        availableRoles={detectedRoles}
        universityData={universityData}
        studentCertificateCount={studentCertificateCount}
        canRegisterAsEmployer={canRegisterAsEmployer}
      />

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-800 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-surface-400 text-sm">
              © 2024 zkCredentials. Built on zkSync Era.
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://docs.zksync.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-surface-400 hover:text-white text-sm transition-colors"
              >
                zkSync Docs
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-surface-400 hover:text-white text-sm transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

