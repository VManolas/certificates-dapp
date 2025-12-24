// src/components/RouteGuard.tsx
import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useAuthStore } from '../store/authStore';
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
  const { role, hasSelectedRole, isRoleDetectionComplete } = useAuthStore();

  useEffect(() => {
    // Wait for role detection to complete
    if (!isRoleDetectionComplete) {
      return;
    }

    // Redirect if wallet not connected
    if (!isConnected) {
      console.warn('RouteGuard: Wallet not connected, redirecting to', redirectTo);
      navigate(redirectTo, { replace: true });
      return;
    }

    // Redirect if no role selected yet
    if (!hasSelectedRole || !role) {
      console.warn('RouteGuard: No role selected, redirecting to', redirectTo);
      navigate(redirectTo, { replace: true });
      return;
    }

    // Determine allowed roles
    const rolesAllowed = requiredRole ? [requiredRole] : (allowedRoles || []);
    
    // Check if user's role is allowed
    if (rolesAllowed.length > 0 && !rolesAllowed.includes(role)) {
      console.warn(`RouteGuard: Access denied. User role "${role}" not in allowed roles:`, rolesAllowed);
      
      // Navigate to access denied page or custom redirect
      if (showAccessDenied) {
        navigate('/access-denied', { replace: true, state: { from: window.location.pathname } });
      } else {
        navigate(redirectTo, { replace: true });
      }
      return;
    }
  }, [isConnected, role, hasSelectedRole, isRoleDetectionComplete, requiredRole, allowedRoles, navigate, redirectTo]);

  // Show loading state while role detection is in progress
  if (!isRoleDetectionComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Don't render children until access is confirmed
  if (!isConnected || !hasSelectedRole || !role) {
    return null;
  }

  const rolesAllowed = requiredRole ? [requiredRole] : (allowedRoles || []);
  if (rolesAllowed.length > 0 && !rolesAllowed.includes(role)) {
    return null;
  }

  return <>{children}</>;
}

