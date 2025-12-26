// src/components/RouteGuard.tsx
import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
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
 * **SECURITY**: This component now supports BOTH authentication methods:
 * - ZK Auth: Uses role from ZK session (privacy-preserving)
 * - Web3 Auth: Uses blockchain-verified roles from useUserRoles
 * 
 * This prevents unauthorized access regardless of authentication method.
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
  
  // 🔒 SECURITY: Use unified auth to support both ZK and Web3
  const unifiedAuth = useUnifiedAuth();
  
  const { isAuthenticated, role, authMethod, isLoading } = unifiedAuth;

  useEffect(() => {
    // Wait for auth detection to complete
    if (isLoading) {
      return;
    }

    // Redirect if wallet not connected (required for both auth methods)
    if (!isConnected) {
      console.warn('RouteGuard: Wallet not connected, redirecting to', redirectTo);
      navigate(redirectTo, { replace: true });
      return;
    }

    // Redirect if not authenticated (via either ZK or Web3)
    if (!isAuthenticated || !role) {
      console.warn('RouteGuard: Not authenticated or no role, redirecting to', redirectTo);
      navigate(redirectTo, { replace: true });
      return;
    }

    // Determine allowed roles
    const rolesAllowed = requiredRole ? [requiredRole] : (allowedRoles || []);
    
    // 🔒 SECURITY CHECK: Verify role matches required role
    if (rolesAllowed.length > 0 && !rolesAllowed.includes(role)) {
      console.warn(`🔒 RouteGuard: SECURITY BLOCK - User's ${authMethod} role "${role}" not in allowed roles:`, rolesAllowed);
      
      // Navigate to access denied page or custom redirect
      if (showAccessDenied) {
        navigate('/access-denied', { replace: true, state: { from: window.location.pathname } });
      } else {
        navigate(redirectTo, { replace: true });
      }
      return;
    }
    
    console.log(`✅ RouteGuard: Access granted for ${authMethod} role "${role}"`);
  }, [isConnected, isAuthenticated, role, authMethod, isLoading, requiredRole, allowedRoles, navigate, redirectTo, showAccessDenied]);

  // Show loading state while auth detection is in progress
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-4 text-gray-600">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  // Don't render children until access is confirmed
  if (!isConnected || !isAuthenticated || !role) {
    return null;
  }

  // Final security check before rendering
  const rolesAllowed = requiredRole ? [requiredRole] : (allowedRoles || []);
  if (rolesAllowed.length > 0 && !rolesAllowed.includes(role)) {
    return null;
  }

  return <>{children}</>;
}

