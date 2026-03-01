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
 * - Integrated UnifiedAuthFlow for complete guided experience
 * - Collapsible educational content
 * - "What's Happening" technical details
 * - Enhanced animations and transitions
 * 
 * Production Implementation:
 * - UltraPlonk verifier (production-grade cryptography)
 * - Full zero-knowledge proof verification
 * - Secure credential storage with encryption
 * - On-chain commitment verification
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';
import type { UserRole } from '@/types/auth';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { UnifiedAuthFlow } from '@/components/UnifiedAuthFlow';
import { DevModeBanner } from '@/components/DevModeBanner';
import { ZKAuthUpgrade } from '@/components/zkauth/ZKAuthUpgrade';
import { getSwitchTxProgressFromEvent, type SwitchTxPhase } from '@/lib/authSwitchStatus';
import { SwitchTxStatusPanel, getSwitchToStandardButtonLabel, isSwitchInFlight } from '@/components/SwitchTxStatusPanel';

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
  const unifiedAuth = useUnifiedAuth();
  
  const [showAuthFlow, setShowAuthFlow] = useState(false);
  const [preSelectedRole, setPreSelectedRole] = useState<UserRole | null>(null);
  const effectiveRole = unifiedAuth.isAuthenticated ? unifiedAuth.role : preSelectedRole;
  const [showEducationalContent, setShowEducationalContent] = useState(true);
  const [switchTxPhase, setSwitchTxPhase] = useState<SwitchTxPhase>('idle');
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switchSkippedOnchainTx, setSwitchSkippedOnchainTx] = useState(false);
  const [showSwitchResultNotice, setShowSwitchResultNotice] = useState(false);
  const showEmployerRegistrationCta =
    unifiedAuth.authMethod === 'web3' &&
    !unifiedAuth.isAuthenticated &&
    !showAuthFlow &&
    !preSelectedRole &&
    unifiedAuth.web3Auth.canRegisterAsEmployer;

  // Prevent stale switch status from leaking between auth-mode transitions.
  useEffect(() => {
    if (unifiedAuth.authMethod !== 'zk' && switchTxPhase !== 'idle' && !showSwitchResultNotice) {
      setSwitchTxPhase('idle');
      setSwitchError(null);
      setSwitchSkippedOnchainTx(false);
    }
  }, [unifiedAuth.authMethod, switchTxPhase, showSwitchResultNotice]);

  const handleSwitchToStandard = async () => {
    try {
      setSwitchError(null);
      setSwitchSkippedOnchainTx(false);
      setShowSwitchResultNotice(false);
      setSwitchTxPhase('awaiting_wallet_confirmation');
      await unifiedAuth.switchAuthMethod('web3', (event) => {
        const progress = getSwitchTxProgressFromEvent(event);
        if (progress) {
          setSwitchSkippedOnchainTx(progress.skippedOnchainTx);
          setSwitchTxPhase(progress.phase);
        }
      });
      // Keep the switch result visible briefly before showing other Web3 UI cards.
      setShowSwitchResultNotice(true);
      setTimeout(() => {
        setShowSwitchResultNotice(false);
        setSwitchTxPhase('idle');
        setSwitchError(null);
        setSwitchSkippedOnchainTx(false);
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to switch authentication method';
      setSwitchError(message);
      setSwitchTxPhase('failed');
    }
  };


  // Handle role selection
  const handleRoleSelection = (selectedRole: UserRole) => {
    setPreSelectedRole(selectedRole);
    setShowAuthFlow(true);
    setShowEducationalContent(false);
  };

  // Handle successful authentication
  const handleAuthSuccess = () => {
    logger.info('ZK authentication successful', { role: unifiedAuth.role });
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
  if (unifiedAuth.isAuthenticated && unifiedAuth.role) {
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
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Main Authentication Status Card */}
            <div className="card bg-surface-900 p-12 text-center">
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
                Role: <span className="text-primary-400 font-semibold capitalize">{effectiveRole}</span>
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

            {/* ZK Auth Upgrade Card - Show for Web3 users who can upgrade */}
            {showSwitchResultNotice && (
              <div className="card bg-gradient-to-r from-green-900/40 to-emerald-800/30 border-green-500/30">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white mb-2">Switched to Standard Login</h4>
                    <p className="text-sm text-surface-200">
                      {switchSkippedOnchainTx
                        ? 'No active private session found on-chain. Switched locally to standard login.'
                        : 'Private session closure confirmed on-chain. You are now using standard login.'}
                    </p>
                    <p className="text-xs text-surface-400 mt-2">
                      This message will close automatically in a moment.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {unifiedAuth.authMethod === 'web3' && !showSwitchResultNotice && (
              <ZKAuthUpgrade 
                variant="card" 
                onUpgradeComplete={() => {
                  setSwitchTxPhase('idle');
                  setSwitchError(null);
                  logger.info('ZK auth upgrade completed from ZKAuth page');
                  // Force component re-render by logging state
                  logger.debug('Current auth state after upgrade:', {
                    authMethod: unifiedAuth.authMethod,
                    isAuthenticated: unifiedAuth.isAuthenticated,
                    role: unifiedAuth.role,
                  });
                }}
              />
            )}

            {/* Switch to Standard Card - Show for ZK users who want to switch back */}
            {unifiedAuth.authMethod === 'zk' && (effectiveRole === 'student' || effectiveRole === 'employer') && (
              <div className="card bg-gradient-to-r from-primary-900/50 to-primary-700/30 border-primary-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-lg font-semibold text-white">Private Login Active</h4>
                      <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                        ✓ Authenticated
                      </span>
                      <div className="relative group">
                        <button
                          type="button"
                          className="text-primary-300/80 hover:text-primary-200 transition-colors cursor-help"
                          aria-label="ZKP algorithm information"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="absolute left-1/2 -translate-x-1/2 top-6 z-50 hidden group-hover:block w-80 max-w-[80vw]">
                          <div className="bg-surface-900 border border-surface-700 rounded-lg shadow-xl p-3 text-left">
                            <p className="text-xs font-semibold text-white mb-1">ZKP algorithm used</p>
                            <p className="text-xs text-surface-300 mb-2">
                              This flow uses a Noir-based circuit with an <span className="text-primary-300 font-medium">UltraPlonk</span> verifier on-chain.
                            </p>
                            <p className="text-xs text-surface-400">
                              Chosen for strong security with practical proof generation and verification performance for real user login flows.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-surface-300 mb-4">
                      Your wallet address is hidden. You're using privacy-preserving authentication.
                    </p>
                    <div className="mb-4 rounded-lg border border-primary-500/20 bg-surface-900/50 p-4">
                      <h5 className="text-sm font-semibold text-white mb-2">Why Private Login helps</h5>
                      <div className="space-y-2 text-xs text-surface-300">
                        <p className="flex items-start gap-2">
                          <span className="text-green-400">•</span>
                          <span><strong className="text-white">Protects identity:</strong> routine logins do not publicly expose your wallet address.</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="text-green-400">•</span>
                          <span><strong className="text-white">Reduces tracking:</strong> it becomes harder to correlate your activity across sessions.</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="text-green-400">•</span>
                          <span><strong className="text-white">Keeps trust strong:</strong> authentication still relies on cryptographic proof verification.</span>
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <SwitchTxStatusPanel
                        phase={switchTxPhase}
                        skippedOnchainTx={switchSkippedOnchainTx}
                        error={switchError}
                      />
                    </div>
                    <div className="mb-3 rounded-lg border border-surface-700 bg-surface-900/40 p-3">
                      <h6 className="text-xs font-semibold text-white mb-1">When to switch to Standard login</h6>
                      <p className="text-xs text-surface-400 leading-relaxed">
                        Use Standard mode when you need full wallet-visible interactions or troubleshooting steps that
                        require explicit wallet context. You can switch back to Private login any time.
                      </p>
                    </div>
                    <button
                      onClick={handleSwitchToStandard}
                      disabled={isSwitchInFlight(switchTxPhase)}
                      className="btn-secondary text-sm disabled:opacity-50"
                    >
                      {getSwitchToStandardButtonLabel(switchTxPhase)}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
          {showEmployerRegistrationCta && (
            <div className="mb-6 card bg-blue-500/10 border border-blue-500/30">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Public login is active, but this wallet has no on-chain role yet
                  </h3>
                  <p className="text-sm text-surface-300">
                    To use standard Web3 employer access, complete one-time employer registration.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/employer/register')}
                  className="btn-primary whitespace-nowrap"
                >
                  Register as Employer
                </button>
              </div>
            </div>
          )}

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

      {/* Impact of ZK Auth */}
      <div className="card bg-surface-900 transition-smooth hover:border-primary-500/20">
        <button
          onClick={() => toggleSection('impact')}
          className="w-full flex items-center justify-between text-left transition-smooth hover:text-primary-400"
        >
          <h3 className="text-lg font-bold text-white">Impact of ZK Auth</h3>
          <svg
            className={`w-4 h-4 text-surface-400 transition-all duration-300 ${
              expandedSection === 'impact' ? 'rotate-180 text-primary-400' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSection === 'impact' && (
          <div className="space-y-3 mt-4 animate-fade-in">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg transition-smooth hover:border-green-500/40">
              <h4 className="font-semibold text-green-400 mb-1 text-sm">🔒 Privacy Impact</h4>
              <p className="text-xs text-green-300 leading-relaxed">
                Daily authentication no longer exposes your wallet address. This reduces account linkability across sessions.
              </p>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg transition-smooth hover:border-blue-500/40">
              <h4 className="font-semibold text-blue-400 mb-1 text-sm">🛡 Security Impact</h4>
              <p className="text-xs text-blue-300 leading-relaxed">
                Access is backed by cryptographic proof verification on-chain, not just session cookies or front-end flags.
              </p>
            </div>

            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg transition-smooth hover:border-purple-500/40">
              <h4 className="font-semibold text-purple-400 mb-1 text-sm">⚡ UX Impact</h4>
              <p className="text-xs text-purple-300 leading-relaxed">
                One-time setup has extra wallet prompts; after setup, private login is fast and repeatable.
              </p>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg transition-smooth hover:border-yellow-500/40">
              <h4 className="font-semibold text-yellow-400 mb-1 text-sm">📊 Transparency Trade-off</h4>
              <p className="text-xs text-yellow-300 leading-relaxed">
                Privacy increases during authentication, while operational blockchain actions remain auditable when transactions are submitted.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="card bg-yellow-500/10 border border-yellow-500/20 transition-smooth hover:border-yellow-500/40">
        <div className="flex gap-2">
          <span className="text-lg">✅</span>
          <div className="text-sm flex-1">
            <h4 className="font-semibold text-green-400 mb-1 text-xs">
              Production Ready
            </h4>
            <p className="text-green-300 text-xs leading-relaxed">
              Using UltraPlonk verifier with full cryptographic verification on local network.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
