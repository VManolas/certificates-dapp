// src/pages/AccessDenied.tsx
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

/**
 * AccessDenied page component
 * 
 * Displayed when a user tries to access a route they don't have permission for
 */
export default function AccessDenied() {
  const navigate = useNavigate();
  const { role } = useAuthStore();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-6">
            <ShieldAlert className="w-16 h-16 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Access Denied
        </h1>
        
        <p className="text-lg text-gray-600 mb-2">
          You don't have permission to access this page.
        </p>
        
        {role && (
          <p className="text-sm text-gray-500 mb-8">
            Current role: <span className="font-semibold capitalize">{role}</span>
          </p>
        )}
        
        <div className="space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Go Back
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Need access?</strong>
            {role === 'student' && (
              <span className="block mt-1">
                This page is only available for universities. Please contact your institution if you believe you should have access.
              </span>
            )}
            {role === 'university' && (
              <span className="block mt-1">
                Make sure your institution is verified and approved by an administrator.
              </span>
            )}
            {role === 'employer' && (
              <span className="block mt-1">
                This page is only available for universities and administrators.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

