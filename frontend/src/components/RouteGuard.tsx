// src/components/RouteGuard.tsx
import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useUserRoles } from '../hooks/useUserRoles';
import { UserRole } from '../types/auth';

interface RouteGuardProps {
  children: ReactNode;
  requiredRole?: UserRole;
  allowedRoles?: UserRole[];
  redirectTo?: string;
  showAccessDenied?: boolean;
}

/**
 * RouteGuard component to protect routes based on user roles
 * 
 * **SECURITY**: This component uses blockchain-verified roles from useUserRoles,
 * NOT user-selected roles from authStore. This prevents unauthorized access.
 * 
 * @param children - The component to render if access is granted
 * @param requiredRole - Single required role (alternative to allowedRoles)
 * @param allowedRoles - Array of allowed roles
 * @param redirectTo - Path to redirect to if access is denied (default: '/')
 * 
 * @example
 * ```tsx
 * <RouteGuard requiredRole="university">
 *   <UniversityDashboard />
 * </RouteGuard>
 * ```
 */
export function RouteGuard({ 
  children, 
  requiredRole, 
  allowedRoles,
  redirectTo = '/',
  showAccessDenied = true
}: RouteGuardProps) {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  
  // 🔒 SECURITY: Use blockchain-verified role, NOT user-selected role
  const { primaryRole, isLoading: isRoleLoading } = useUserRoles();

  useEffect(() => {
    // Wait for role detection to complete
    if (isRoleLoading) {
      return;
    }

    // Redirect if wallet not connected
    if (!isConnected) {
      console.warn('RouteGuard: Wallet not connected, redirecting to', redirectTo);
      navigate(redirectTo, { replace: true });
      return;
    }

    // Redirect if no role detected on blockchain
    if (!primaryRole) {
      console.warn('RouteGuard: No blockchain-verified role detected, redirecting to', redirectTo);
      navigate(redirectTo, { replace: true });
      return;
    }

    // Determine allowed roles
    const rolesAllowed = requiredRole ? [requiredRole] : (allowedRoles || []);
    
    // 🔒 SECURITY CHECK: Verify blockchain-verified role matches required role
    if (rolesAllowed.length > 0 && !rolesAllowed.includes(primaryRole)) {
      console.warn(`🔒 RouteGuard: SECURITY BLOCK - User's blockchain role "${primaryRole}" not in allowed roles:`, rolesAllowed);
      
      // Navigate to access denied page or custom redirect
      if (showAccessDenied) {
        navigate('/access-denied', { replace: true, state: { from: window.location.pathname } });
      } else {
        navigate(redirectTo, { replace: true });
      }
      return;
    }
    
    console.log(`✅ RouteGuard: Access granted for role "${primaryRole}"`);
  }, [isConnected, primaryRole, isRoleLoading, requiredRole, allowedRoles, navigate, redirectTo, showAccessDenied]);

  // Show loading state while role detection is in progress
  if (isRoleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-4 text-gray-600">Verifying blockchain credentials...</p>
        </div>
      </div>
    );
  }

  // Don't render children until access is confirmed
  if (!isConnected || !primaryRole) {
    return null;
  }

  // Final security check before rendering
  const rolesAllowed = requiredRole ? [requiredRole] : (allowedRoles || []);
  if (rolesAllowed.length > 0 && !rolesAllowed.includes(primaryRole)) {
    return null;
  }

  return <>{children}</>;
}

