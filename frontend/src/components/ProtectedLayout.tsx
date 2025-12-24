// src/components/ProtectedLayout.tsx
import { Outlet } from 'react-router-dom';
import { RouteGuard } from './RouteGuard';
import { UserRole } from '../types/auth';

interface ProtectedLayoutProps {
  requiredRole?: UserRole;
  allowedRoles?: UserRole[];
}

/**
 * ProtectedLayout component
 * 
 * Wraps an entire route section with role-based protection
 * All child routes will inherit the protection
 * 
 * @example
 * ```tsx
 * <Route path="university" element={<ProtectedLayout requiredRole="university" />}>
 *   <Route path="dashboard" element={<Dashboard />} />
 *   <Route path="issue" element={<Issue />} />
 * </Route>
 * ```
 */
export function ProtectedLayout({ requiredRole, allowedRoles }: ProtectedLayoutProps) {
  return (
    <RouteGuard requiredRole={requiredRole} allowedRoles={allowedRoles}>
      <Outlet />
    </RouteGuard>
  );
}

