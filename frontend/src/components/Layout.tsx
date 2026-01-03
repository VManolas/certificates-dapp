// src/components/Layout.tsx
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useAuthStore, type UserRole } from '@/store/authStore';
import { useEffect, useState, lazy, Suspense } from 'react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { SkipToContent } from './SkipToContent';
import { logger } from '@/lib/logger';

// Lazy load heavy auth components - only load when needed
const RoleSwitcher = lazy(() => import('./RoleSwitcher').then(m => ({ default: m.RoleSwitcher })));
const RoleSelectorModal = lazy(() => import('./RoleSelectorModal').then(m => ({ default: m.RoleSelectorModal })));
const RoleDropdown = lazy(() => import('./RoleDropdown').then(m => ({ default: m.RoleDropdown })));
const ZKAuthStatus = lazy(() => import('./zkauth/ZKAuthStatus').then(m => ({ default: m.ZKAuthStatus })));
const AuthMethodSelector = lazy(() => import('./AuthMethodSelector').then(m => ({ default: m.AuthMethodSelector })));
const AuthStatusBadge = lazy(() => import('./AuthStatusBadge').then(m => ({ default: m.AuthStatusBadge })));
const DevModeBanner = lazy(() => import('./DevModeBanner').then(m => ({ default: m.DevModeBanner })));
const RoleConflictModal = lazy(() => import('./RoleConflictModal').then(m => ({ default: m.RoleConflictModal })));

// Loading fallback for lazy components
const ComponentLoader = () => <div className="animate-pulse bg-surface-700 rounded h-8 w-24" />;

export function Layout() {
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const { 
    setAddress, 
    role, 
    preSelectedRole,
    setPreSelectedRole,
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
  
  // Role conflict state
  const [showRoleConflict, setShowRoleConflict] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{
    requested: UserRole;
    detected: UserRole;
  } | null>(null);

  // Use unified auth for both ZK and Web3
  // OPTIMIZATION: Only initialize unified auth when wallet is connected
  // This avoids unnecessary blockchain queries for anonymous visitors
  const unifiedAuth = useUnifiedAuth();

  // Get user roles from unified auth (only populated when connected)
  const userRoles = unifiedAuth.web3Auth;
  const availableRoles = userRoles.availableRoles;
  const isDetectingRoles = isConnected ? unifiedAuth.isLoading : false;
  const universityData = userRoles.isUniversity ? institutionData : null;
  const canRegisterAsEmployer = userRoles.canRegisterAsEmployer;

  // Set refetch function in auth store for other components
  useEffect(() => {
    // Note: refetch is not exposed in unified auth, but it's called internally
    setRefetchInstitution(() => {
      // Placeholder - unified auth handles this internally
    });
  }, [setRefetchInstitution]);

  // Sync wallet connection with auth store
  useEffect(() => {
    setAddress(isConnected && address ? address : null);
  }, [address, isConnected, setAddress]);

  // Sync institution data to auth store
  useEffect(() => {
    // If user is a university, update institution data in store
    if (role === 'university' && userRoles.isUniversity && userRoles.universityData) {
      // Only update if data has changed to avoid infinite loops
      // Compare without using JSON.stringify to avoid BigInt serialization errors
      const hasChanged = !institutionData || 
        institutionData.name !== userRoles.universityData.name ||
        institutionData.emailDomain !== userRoles.universityData.emailDomain ||
        institutionData.isVerified !== userRoles.universityData.isVerified ||
        institutionData.isActive !== userRoles.universityData.isActive ||
        institutionData.verificationDate !== userRoles.universityData.verificationDate ||
        institutionData.totalCertificatesIssued !== userRoles.universityData.totalCertificatesIssued;
      
      if (hasChanged) {
        logger.info('Updating institution data in store', {
          name: userRoles.universityData.name,
          emailDomain: userRoles.universityData.emailDomain,
          isVerified: userRoles.universityData.isVerified,
          isActive: userRoles.universityData.isActive,
          totalCertificatesIssued: userRoles.universityData.totalCertificatesIssued.toString(), // Convert BigInt to string for logging
        });
        setInstitutionData(userRoles.universityData);
      }
    } else if (role !== 'university' && institutionData) {
      // Clear if role changes away from university
      setInstitutionData(null);
    }
  }, [role, userRoles.isUniversity, userRoles.universityData, institutionData, setInstitutionData]);

  // Handle role detection completion and synchronization
  useEffect(() => {
    if (!isDetectingRoles && isConnected) {
      setDetectedRoles(availableRoles);
      setIsRoleDetectionComplete(true);

      // CONFLICT DETECTION: Check if pre-selected role conflicts with detected roles
      const hasPreSelection = preSelectedRole && !role; // User selected role before connecting
      const preSelectionConflict = hasPreSelection && 
                                   availableRoles.length > 0 && 
                                   !availableRoles.includes(preSelectedRole);
      
      if (preSelectionConflict && userRoles.primaryRole) {
        // User selected a role that conflicts with their wallet's actual role
        logger.warn('⚠️ Role conflict detected', {
          preSelected: preSelectedRole,
          detected: userRoles.primaryRole,
          availableRoles,
        });
        
        // Show conflict modal to explain the situation
        setConflictInfo({
          requested: preSelectedRole,
          detected: userRoles.primaryRole,
        });
        setShowRoleConflict(true);
        
        // Don't auto-select - let user decide via modal
        return;
      }

      // Check if current role is still valid for this wallet
      const currentRoleStillValid = role && availableRoles.includes(role);
      
      // If current role is not valid (e.g., switched from admin to university wallet)
      if (!currentRoleStillValid && availableRoles.length > 0 && !hasPreSelection) {
        logger.info('Current role not valid for this wallet, resetting...', {
          currentRole: role,
          availableRoles,
        });
        
        // Auto-select if only one role available
        if (availableRoles.length === 1) {
          logger.info('Auto-selecting only available role', { role: availableRoles[0] });
          setRole(availableRoles[0]);
        } else if (availableRoles.length > 1) {
          // Show modal if multiple roles
          logger.info('Multiple roles available, showing selector');
          setRole(null); // Clear invalid role
          setShowRoleSelector(true);
        }
      }
      // If user hasn't selected a role yet (fresh connection)
      else if (!hasSelectedRole && !hasPreSelection) {
        if (availableRoles.length === 1) {
          // Auto-select if only one role
          setRole(availableRoles[0]);
        } else if (availableRoles.length > 1) {
          // Show modal if multiple roles
          setShowRoleSelector(true);
        } else if (availableRoles.length === 0 && canRegisterAsEmployer) {
          // New user with no roles yet - show modal to allow aspirational role selection
          logger.info('New user with no roles, showing selector for aspirational role selection');
          setShowRoleSelector(true);
        }
      }
    }
  }, [availableRoles, isDetectingRoles, isConnected, hasSelectedRole, role, preSelectedRole, canRegisterAsEmployer, userRoles.primaryRole, setDetectedRoles, setIsRoleDetectionComplete, setRole, setShowRoleSelector]);

  // Handle role change from dropdown
  const handleRoleChange = (newRole: UserRole) => {
    if (!isConnected) {
      setPreSelectedRole(newRole);
      // Reset auth state when changing role
      unifiedAuth.logout();
    }
  };
  
  // Handle role conflict resolution
  const handleAcceptDetectedRole = () => {
    if (conflictInfo?.detected) {
      logger.info('✅ User accepted detected role', { 
        requested: conflictInfo.requested, 
        accepted: conflictInfo.detected 
      });
      
      // Clear pre-selected role that caused conflict
      setPreSelectedRole(null);
      
      // Set the detected role as current role
      setRole(conflictInfo.detected);
      
      // Close conflict modal
      setShowRoleConflict(false);
      setConflictInfo(null);
    }
  };
  
  const handleCloseRoleConflict = () => {
    setShowRoleConflict(false);
    // Keep conflict info in case user wants to see it again
  };

  const isActive = (path: string) => location.pathname === path;

  // Determine if ZK Auth should be shown (hide for admin and university)
  const showZKAuth = preSelectedRole !== 'admin' && 
                     preSelectedRole !== 'university' && 
                     role !== 'admin' && 
                     role !== 'university';

  return (
    <div className="min-h-screen flex flex-col">
      <SkipToContent />
      
      {/* Development Mode Banner - Lazy loaded */}
      <Suspense fallback={null}>
        <DevModeBanner variant="banner" />
      </Suspense>
      
      {/* Auth Method Selector Modal - Lazy loaded */}
      <Suspense fallback={null}>
        <AuthMethodSelector
          isOpen={unifiedAuth.showAuthMethodSelector}
          onClose={() => {
            // User can close without selecting
          }}
          onSelectMethod={unifiedAuth.selectAuthMethod}
          required={!unifiedAuth.authMethod} // Required if no method selected yet
          userRole={userRoles.primaryRole} // Pass detected role for messaging
          allowedMethods={unifiedAuth.allowedAuthMethods} // Pass allowed methods
          defaultMethod={unifiedAuth.defaultAuthMethod} // Pass recommended method
        />
      </Suspense>
      
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
            
            {/* Student: My Certificates (show first) */}
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
            
            {/* University Dashboard Link - Show after Home */}
            {isConnected && role === 'university' && !isAspirationalRole && (
              <Link
                to="/university/dashboard"
                className={`text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/university')
                    ? 'text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                University Dashboard
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
            
            {/* Employer Dashboard */}
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
            
            {/* Admin Dashboard */}
            {isConnected && role === 'admin' && (
              <Link
                to="/admin/dashboard"
                className={`text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/admin')
                    ? 'text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Admin Dashboard
              </Link>
            )}
            
            {/* Verify Link - Show before ZK Auth for students, after dashboard for others */}
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
            
            {/* ZK Auth link - Show last for students */}
            {showZKAuth && (
              <Link
                to="/zkauth"
                className={`text-sm font-medium transition-colors ${
                  isActive('/zkauth') ? 'text-white' : 'text-surface-400 hover:text-white'
                }`}
                aria-current={isActive('/zkauth') ? 'page' : undefined}
              >
                🔐 ZK Auth
              </Link>
            )}
          </nav>

          {/* Wallet Connection + Role Display */}
          <div className="flex items-center gap-3">
            {/* Show role dropdown when role is pre-selected - Lazy loaded */}
            {preSelectedRole && !isConnected && (
              <Suspense fallback={<ComponentLoader />}>
                <RoleDropdown
                  currentRole={preSelectedRole}
                  onChangeRole={handleRoleChange}
                />
              </Suspense>
            )}
            
            {/* Auth Status Badge - Shows role and auth method - Lazy loaded */}
            <Suspense fallback={<ComponentLoader />}>
              <AuthStatusBadge />
            </Suspense>
            
            {/* Show ZK Auth status when using ZK method (don't require wallet connection) - Lazy loaded */}
            {unifiedAuth.authMethod === 'zk' && showZKAuth && (
              <Suspense fallback={<ComponentLoader />}>
                <ZKAuthStatus />
              </Suspense>
            )}
            {isConnected && !isDetectingRoles && (
              <Suspense fallback={<ComponentLoader />}>
                <RoleSwitcher availableRoles={detectedRoles} />
              </Suspense>
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

      {/* Role Selector Modal - Lazy loaded */}
      <Suspense fallback={null}>
        <RoleSelectorModal
          isOpen={showRoleSelector}
          onClose={() => setShowRoleSelector(false)}
          availableRoles={detectedRoles}
          universityData={universityData}
          studentCertificateCount={0}
          canRegisterAsEmployer={canRegisterAsEmployer}
        />
      </Suspense>
      
      {/* Role Conflict Modal - Shows when pre-selected role conflicts with detected role */}
      <Suspense fallback={null}>
        <RoleConflictModal
          isOpen={showRoleConflict}
          onClose={handleCloseRoleConflict}
          requestedRole={conflictInfo?.requested || null}
          detectedRole={conflictInfo?.detected || null}
          detectedRoles={detectedRoles}
          walletAddress={address || ''}
          onAcceptDetectedRole={handleAcceptDetectedRole}
        />
      </Suspense>

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

