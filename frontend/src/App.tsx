// src/App.tsx
import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RouteGuard } from './components/RouteGuard';
import { ProtectedLayout } from './components/ProtectedLayout';
import { useAccountChangeHandler } from './hooks';

// Lazy load all route components for code splitting
const Home = lazy(() => import('./pages/Home'));
const Verify = lazy(() => import('./pages/Verify'));
const AccessDenied = lazy(() => import('./pages/AccessDenied'));
const UniversityDashboard = lazy(() => import('./pages/university/Dashboard'));
const UniversityRegister = lazy(() => import('./pages/university/Register'));
const UniversityCertificates = lazy(() => import('./pages/university/Certificates'));
const BulkUpload = lazy(() => import('./pages/university/BulkUpload'));
const IssueCertificate = lazy(() => import('./pages/university/IssueCertificate'));
const EmployerDashboard = lazy(() => import('./pages/employer/Dashboard'));
const EmployerRegister = lazy(() => import('./pages/employer/Register'));
const BatchVerify = lazy(() => import('./pages/employer/BatchVerify'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const ManageUniversities = lazy(() => import('./pages/admin/ManageUniversities'));
const StudentCertificates = lazy(() => import('./pages/student/Certificates'));

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" role="status">
        <span className="sr-only">Loading...</span>
      </div>
      <p className="mt-4 text-gray-600">Loading page...</p>
    </div>
  </div>
);

function App() {
  // Handle wallet account changes - clears cache and reloads
  useAccountChangeHandler();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="verify" element={<Verify />} />
          <Route path="access-denied" element={<AccessDenied />} />
          
          {/* University registration - PUBLIC (no protection) */}
          <Route path="university/register" element={<UniversityRegister />} />
          
          {/* University routes - ALL other routes under /university/* are protected */}
          {/* Any URL like /university/login, /university/xyz will be blocked for non-university roles */}
          <Route path="university/*" element={<ProtectedLayout requiredRole="university" />}>
            <Route path="dashboard" element={<UniversityDashboard />} />
            <Route path="certificates" element={<UniversityCertificates />} />
            <Route path="bulk-upload" element={<BulkUpload />} />
            <Route path="issue" element={<IssueCertificate />} />
            {/* Catch-all for any other /university/* routes - will show access denied */}
            <Route path="*" element={<AccessDenied />} />
          </Route>

          {/* Student routes - ALL routes under /student/* are protected */}
          <Route path="student/*" element={<ProtectedLayout requiredRole="student" />}>
            <Route path="certificates" element={<StudentCertificates />} />
            {/* Catch-all for any other /student/* routes */}
            <Route path="*" element={<AccessDenied />} />
          </Route>

          {/* Employer routes - Registration is public, dashboard requires employer role */}
          <Route path="employer">
            <Route path="register" element={<EmployerRegister />} />
            <Route path="dashboard" element={<RouteGuard requiredRole="employer"><EmployerDashboard /></RouteGuard>} />
            <Route path="batch-verify" element={<RouteGuard requiredRole="employer"><BatchVerify /></RouteGuard>} />
          </Route>

          {/* Admin routes - ALL routes under /admin/* are protected */}
          <Route path="admin/*" element={<ProtectedLayout requiredRole="admin" />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="universities" element={<ManageUniversities />} />
            {/* Catch-all for any other /admin/* routes */}
            <Route path="*" element={<AccessDenied />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;

