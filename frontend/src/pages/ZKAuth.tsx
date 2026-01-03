// frontend/src/pages/ZKAuth.tsx
/**
 * ZK Authentication Page
 * ======================
 * 
 * Standalone page for testing and demonstrating ZK authentication.
 * Shows the complete flow from registration to login to session management.
 * 
 * Features:
 * - Interactive registration with role selection
 * - Login with stored credentials
 * - Session information display
 * - Credential management (clear/reset)
 * - Educational content about ZK auth
 * - Progress tracking for user guidance
 * - Estimated time indicators
 * 
 * Phase 1 Enhancements:
 * - Added ProgressSteps component for visual progress tracking
 * - Synced dark theme styling with home page
 * - Added estimated time indicators for each step
 * - Improved error messages with actionable suggestions
 * 
 * Phase 2 Enhancements:
 * - Integrated UnifiedAuthFlow for complete guided experience
 * - Added collapsible educational content
 * - Implemented "What's Happening" technical details
 * - Enhanced animations and transitions
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/store/authStore';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { UnifiedAuthFlow } from '@/components/UnifiedAuthFlow';
import { DevModeBanner } from '@/components/DevModeBanner';

// Role options for inline display
interface RoleOption {
  role: UserRole;
  icon: string;
  title: string;
  description: string;
  badge?: string;
  features: string[];
}

const roleOptions: RoleOption[] = [
  {
    role: 'admin',
    icon: '👔',
    title: 'Admin',
    description: 'System administrator with full access',
    badge: 'Public Auth Only',
    features: [
      'Manage universities and employers',
      'Oversee all certificates',
      'System configuration',
      'Must use standard Web3 login',
    ],
  },
  {
    role: 'university',
    icon: '🏛️',
    title: 'University',
    description: 'Educational institution issuing certificates',
    badge: 'Public Auth Only',
    features: [
      'Issue student certificates',
      'Bulk certificate operations',
      'Manage certificate templates',
      'Must use standard Web3 login',
    ],
  },
  {
    role: 'student',
    icon: '🎓',
    title: 'Student',
    description: 'Certificate holder with privacy options',
    badge: 'Privacy Recommended',
    features: [
      'View your certificates',
      'Share certificates privately',
      'Generate verification links',
      'Private or standard login available',
    ],
  },
  {
    role: 'employer',
    icon: '💼',
    title: 'Employer',
    description: 'Organization verifying credentials',
    badge: 'Flexible Auth',
    features: [
      'Verify student certificates',
      'Access certificate data',
      'Manage verification requests',
      'Private or standard login available',
    ],
  },
];

export default function ZKAuthPage() {
  const navigate = useNavigate();
  const { role: authenticatedRole } = useAuthStore();
  const unifiedAuth = useUnifiedAuth();
  
  const [showAuthFlow, setShowAuthFlow] = useState(false);
  const [preSelectedRole, setPreSelectedRole] = useState<UserRole | null>(null);
  const [showEducationalContent, setShowEducationalContent] = useState(true);

  // Handle role selection
  const handleRoleSelection = (selectedRole: UserRole) => {
    setPreSelectedRole(selectedRole);
    setShowAuthFlow(true);
    setShowEducationalContent(false);
  };

  // Handle successful authentication
  const handleAuthSuccess = () => {
    console.log('Authentication successful!');
    // Navigate to appropriate dashboard based on role
    const role = unifiedAuth.role;
    if (role === 'student') {
      navigate('/student/certificates');
    } else if (role === 'university') {
      navigate('/university/dashboard');
    } else if (role === 'employer') {
      navigate('/employer/dashboard');
    } else if (role === 'admin') {
      navigate('/admin/dashboard');
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    setShowAuthFlow(false);
    setPreSelectedRole(null);
    setShowEducationalContent(true);
  };

  // If already authenticated, show welcome screen
  if (unifiedAuth.isAuthenticated && authenticatedRole) {
    return (
      <div className="relative overflow-hidden min-h-screen">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-950/50 via-surface-950 to-accent-950/30" />
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl animate-pulse-slow" />
        </div>

        <div className="relative py-12 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="card bg-surface-900 p-12">
              <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-4">
                You're Already Authenticated!
              </h1>
              
              <p className="text-surface-300 mb-2">
                {unifiedAuth.authMethod === 'zk' 
                  ? '🔐 Using privacy-preserving ZK authentication'
                  : '🌐 Using standard Web3 authentication'
                }
              </p>
              
              <p className="text-lg text-surface-400 mb-8">
                Role: <span className="text-primary-400 font-semibold capitalize">{authenticatedRole}</span>
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => handleAuthSuccess()}
                  className="btn-primary"
                >
                  Go to Dashboard
                </button>
                
                <button
                  onClick={() => {
                    unifiedAuth.logout();
                    setShowEducationalContent(true);
                  }}
                  className="btn-secondary"
                >
                  Logout & Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main page content - Role selection or Auth flow
  return (
    <div className="relative overflow-hidden min-h-screen">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-950/50 via-surface-950 to-accent-950/30" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Development Mode Banner */}
          <div className="mb-8">
            <DevModeBanner variant="card" />
          </div>

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
              <span className="text-sm text-primary-300">Privacy-Preserving Authentication</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              <span className="gradient-text">Zero-Knowledge</span>
              <br />
              <span className="text-white">Authentication</span>
            </h1>
            <p className="text-lg text-surface-300 max-w-2xl mx-auto">
              Privacy-preserving authentication powered by zero-knowledge proofs.
              One-time setup, then login privately forever.
            </p>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left/Main Column - Auth Flow or Role Selection */}
            <div className="flex-1 lg:max-w-3xl animate-fade-in">
              {!showAuthFlow ? (
                <div className="card bg-surface-900 animate-scale-in">
                  <h2 className="text-2xl font-bold text-white mb-4">
                    Get Started
                  </h2>
                  <p className="text-surface-300 mb-6">
                    Select your role to begin the authentication process. You can choose between privacy-preserving ZK authentication or standard Web3 login.
                  </p>
                  
                  {/* Inline Role Selection - Not a modal */}
                  <div className="space-y-4">
                    {roleOptions.map((option) => (
                      <button
                        key={option.role}
                        onClick={() => handleRoleSelection(option.role)}
                        className="group w-full text-left p-6 rounded-xl border-2 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl border-surface-700 bg-surface-800/50 hover:border-primary-500/60"
                      >
                        {/* Icon and Badge */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-2xl group-hover:bg-primary-500/20 transition-colors">
                            {option.icon}
                          </div>
                          {option.badge && (
                            <span className={`px-2 py-1 text-xs rounded-full border ${
                              option.role === 'student'
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : option.role === 'employer'
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                            }`}>
                              {option.badge}
                            </span>
                          )}
                        </div>

                        {/* Title and Description */}
                        <h3 className="text-lg font-bold text-white mb-2">
                          {option.title}
                        </h3>
                        <p className="text-sm text-surface-400 mb-3">
                          {option.description}
                        </p>

                        {/* Features Summary */}
                        <div className="flex flex-wrap gap-2">
                          {option.features.slice(0, 2).map((feature, index) => (
                            <span key={index} className="text-xs text-surface-500 flex items-center gap-1">
                              <svg className="w-3 h-3 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {feature}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card bg-surface-900 animate-slide-in-left">
                  <UnifiedAuthFlow
                    preSelectedRole={preSelectedRole}
                    onComplete={handleAuthSuccess}
                    onCancel={handleCancel}
                  />
                </div>
              )}
            </div>

            {/* Right Column - Educational Content */}
            {showEducationalContent && (
              <div className="w-full lg:w-80 lg:flex-shrink-0 space-y-6 animate-slide-in-right">
                <EducationalContent />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Educational Content Component
function EducationalContent() {
  const [expandedSection, setExpandedSection] = useState<string | null>('how-it-works');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <>
      {/* How It Works */}
      <div className="card bg-surface-900 transition-smooth hover:border-primary-500/20">
        <button
          onClick={() => toggleSection('how-it-works')}
          className="w-full flex items-center justify-between text-left transition-smooth hover:text-primary-400"
        >
          <h3 className="text-lg font-bold text-white">How It Works</h3>
          <svg
            className={`w-4 h-4 text-surface-400 transition-all duration-300 ${
              expandedSection === 'how-it-works' ? 'rotate-180 text-primary-400' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSection === 'how-it-works' && (
          <ol className="space-y-3 text-sm text-surface-300 mt-4 animate-fade-in">
            <li className="flex gap-2 transition-smooth hover:translate-x-1">
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-primary-500/20 text-primary-400 rounded-full font-bold text-xs">
                1
              </span>
              <div className="flex-1">
                <strong className="text-white text-xs">One-Time Setup</strong>
                <p className="text-xs leading-relaxed">Connect wallet to register a cryptographic commitment</p>
              </div>
            </li>
            <li className="flex gap-2 transition-smooth hover:translate-x-1">
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-primary-500/20 text-primary-400 rounded-full font-bold text-xs">
                2
              </span>
              <div className="flex-1">
                <strong className="text-white text-xs">Generate Keys</strong>
                <p className="text-xs leading-relaxed">Browser generates encryption keys locally</p>
              </div>
            </li>
            <li className="flex gap-2 transition-smooth hover:translate-x-1">
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-primary-500/20 text-primary-400 rounded-full font-bold text-xs">
                3
              </span>
              <div className="flex-1">
                <strong className="text-white text-xs">Compute Hash</strong>
                <p className="text-xs leading-relaxed font-mono">commitment = hash(...)</p>
              </div>
            </li>
            <li className="flex gap-2 transition-smooth hover:translate-x-1">
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-primary-500/20 text-primary-400 rounded-full font-bold text-xs">
                4
              </span>
              <div className="flex-1">
                <strong className="text-white text-xs">Private Login</strong>
                <p className="text-xs leading-relaxed">Generate ZK proofs without revealing wallet</p>
              </div>
            </li>
          </ol>
        )}
      </div>

      {/* Privacy Model */}
      <div className="card bg-surface-900 transition-smooth hover:border-primary-500/20">
        <button
          onClick={() => toggleSection('privacy-model')}
          className="w-full flex items-center justify-between text-left transition-smooth hover:text-primary-400"
        >
          <h3 className="text-lg font-bold text-white">Privacy Model</h3>
          <svg
            className={`w-4 h-4 text-surface-400 transition-all duration-300 ${
              expandedSection === 'privacy-model' ? 'rotate-180 text-primary-400' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSection === 'privacy-model' && (
          <div className="space-y-3 mt-4 animate-fade-in">
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg transition-smooth hover:border-yellow-500/40">
              <h4 className="font-semibold text-yellow-400 mb-1 flex items-center gap-2 text-sm">
                <span>⚠️</span>
                <span>Setup Phase</span>
              </h4>
              <p className="text-xs text-yellow-300 leading-relaxed">
                Wallet visible during registration. Use a dedicated wallet for maximum privacy.
              </p>
            </div>
            
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg transition-smooth hover:border-green-500/40">
              <h4 className="font-semibold text-green-400 mb-1 flex items-center gap-2 text-sm">
                <span>✅</span>
                <span>Auth Phase</span>
              </h4>
              <p className="text-xs text-green-300 leading-relaxed">
                Login privately using ZK proofs. No wallet exposure.
              </p>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg transition-smooth hover:border-blue-500/40">
              <h4 className="font-semibold text-blue-400 mb-1 flex items-center gap-2 text-sm">
                <span>🎯</span>
                <span>Usage Phase</span>
              </h4>
              <p className="text-xs text-blue-300 leading-relaxed">
                You control when to reveal wallet for transactions.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="card bg-yellow-500/10 border border-yellow-500/20 transition-smooth hover:border-yellow-500/40">
        <div className="flex gap-2">
          <span className="text-lg">⚠️</span>
          <div className="text-sm flex-1">
            <h4 className="font-semibold text-yellow-400 mb-1 text-xs">
              Development Mode
            </h4>
            <p className="text-yellow-300 text-xs leading-relaxed">
              Using development verifier. Full cryptographic verification in Phase 2.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
