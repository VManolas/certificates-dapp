// frontend/src/components/UnifiedAuthFlow.tsx
/**
 * Unified Authentication Flow Component
 * ====================================
 * 
 * Provides a comprehensive, progress-tracked authentication flow for both
 * ZK Auth and Web3 Auth, starting from role selection through completion.
 * 
 * Flow Steps (Common):
 * 1. Select Role - Choose your account type
 * 2. Choose Login Method - Select ZK Auth or Web3 Auth
 * 3. Authenticate - Complete authentication (varies by method)
 * 4. Complete - Authentication successful
 * 
 * Features:
 * - Unified progress indicator for all auth methods
 * - Clear step-by-step guidance
 * - Automatic progression through steps
 * - Error handling with user-friendly messages
 * - Ability to go back to previous steps (where applicable)
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { ProgressSteps } from './ProgressSteps';
import { getFriendlyError, getErrorAction, logError } from '@/lib/errors/zkAuthErrors';
import type { UserRole, AuthMethod } from '@/store/authStore';

interface UnifiedAuthFlowProps {
  onComplete?: () => void;
  onCancel?: () => void;
  preSelectedRole?: UserRole | null;
}

type FlowStep = 
  | 'select-role' 
  | 'choose-method' 
  | 'zk-connect-wallet'
  | 'zk-generate-credentials'
  | 'zk-register-onchain'
  | 'zk-load-credentials'
  | 'zk-generate-proof'
  | 'web3-connect-wallet'
  | 'complete';

export function UnifiedAuthFlow({
  onComplete,
  onCancel,
  preSelectedRole = null,
}: UnifiedAuthFlowProps) {
  const { isConnected } = useAccount();
  const unifiedAuth = useUnifiedAuth();
  
  const [currentStep, setCurrentStep] = useState<FlowStep>('select-role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(preSelectedRole);
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<AuthMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize with preselected role if provided
  useEffect(() => {
    if (preSelectedRole) {
      setSelectedRole(preSelectedRole);
      setCurrentStep('choose-method');
    }
  }, [preSelectedRole]);

  // Auto-progress when wallet connects for Web3
  useEffect(() => {
    if (currentStep === 'web3-connect-wallet' && isConnected && selectedAuthMethod === 'web3') {
      setCurrentStep('complete');
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    }
  }, [isConnected, currentStep, selectedAuthMethod, onComplete]);

  // Auto-progress when ZK authentication is detected
  useEffect(() => {
    if (unifiedAuth.isAuthenticated && unifiedAuth.authMethod === 'zk') {
      setCurrentStep('complete');
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    }
  }, [unifiedAuth.isAuthenticated, unifiedAuth.authMethod, onComplete]);

  // Handle role selection
  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setCurrentStep('choose-method');
  };

  // Handle auth method selection
  const handleAuthMethodSelect = (method: AuthMethod) => {
    setSelectedAuthMethod(method);
    unifiedAuth.selectAuthMethod(method, true);
    
    if (method === 'zk') {
      // Check if user has ZK credentials
      if (unifiedAuth.zkAuth.hasCredentials) {
        // Has credentials - go to login flow
        setCurrentStep('zk-load-credentials');
      } else {
        // No credentials - go to registration flow
        setCurrentStep('zk-connect-wallet');
      }
    } else {
      // Web3 flow
      setCurrentStep('web3-connect-wallet');
    }
  };

  // ZK Registration: Generate and register credentials
  const handleZKRegistration = async () => {
    if (!selectedRole || selectedRole === 'admin') return;
    
    try {
      setIsLoading(true);
      setError(null);
      setCurrentStep('zk-register-onchain');
      
      // Only students and employers can use ZK auth
      if (selectedRole !== 'student' && selectedRole !== 'employer') {
        throw new Error('Only students and employers can use ZK authentication');
      }
      
      await unifiedAuth.zkAuth.register(selectedRole);
      
      // Auto-login after successful registration
      // This matches the behavior of the /zkauth page
      console.log('✅ Registration successful, auto-logging in...');
      setCurrentStep('zk-generate-proof');
      
      try {
        await unifiedAuth.zkAuth.login();
        console.log('✅ Auto-login successful');
        
        setCurrentStep('complete');
        setTimeout(() => {
          onComplete?.();
        }, 1500);
      } catch (loginErr) {
        const err = loginErr as Error;
        // Silently handle auto-login failures - this is normal after updates or wallet switches
        if (err.message === 'CREDENTIALS_OUTDATED') {
          console.info('ℹ️ Registration successful! (Auto-login skipped due to outdated credentials - this is normal after updates)');
        } else {
          console.info('ℹ️ Registration successful! (Auto-login skipped - you can login manually later)');
        }
        // If auto-login fails, just complete the registration
        // User can manually login later
        setCurrentStep('complete');
        setTimeout(() => {
          onComplete?.();
        }, 1500);
      }
    } catch (err) {
      logError(err as Error, 'ZK Registration');
      setError(getFriendlyError(err as Error));
      setCurrentStep('zk-generate-credentials');
    } finally {
      setIsLoading(false);
    }
  };

  // ZK Login: Load credentials and authenticate
  const handleZKLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setCurrentStep('zk-generate-proof');
      
      await unifiedAuth.zkAuth.login();
      
      setCurrentStep('complete');
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    } catch (err) {
      logError(err as Error, 'ZK Login');
      setError(getFriendlyError(err as Error));
      setCurrentStep('zk-load-credentials');
    } finally {
      setIsLoading(false);
    }
  };

  // Build progress steps based on current flow
  const getProgressSteps = () => {
    const baseSteps = [
      {
        label: 'Select Role',
        status: currentStep === 'select-role' ? 'current' as const : 'complete' as const,
        description: 'Choose your account type'
      },
      {
        label: 'Choose Method',
        status: currentStep === 'select-role' ? 'pending' as const :
                currentStep === 'choose-method' ? 'current' as const : 'complete' as const,
        description: 'Select authentication method'
      },
    ];

    if (selectedAuthMethod === 'zk') {
      // ZK Flow steps
      const zkSteps = unifiedAuth.zkAuth.hasCredentials ? [
        // Login flow
        {
          label: 'Load Credentials',
          status: ['select-role', 'choose-method'].includes(currentStep) ? 'pending' as const :
                  currentStep === 'zk-load-credentials' ? 'current' as const : 'complete' as const,
          description: 'Access stored ZK credentials'
        },
        {
          label: 'Generate Proof',
          status: ['select-role', 'choose-method', 'zk-load-credentials'].includes(currentStep) ? 'pending' as const :
                  currentStep === 'zk-generate-proof' ? 'current' as const : 'complete' as const,
          description: 'Create authentication proof'
        },
      ] : [
        // Registration flow
        {
          label: 'Connect Wallet',
          status: ['select-role', 'choose-method'].includes(currentStep) ? 'pending' as const :
                  currentStep === 'zk-connect-wallet' ? 'current' as const :
                  ['zk-generate-credentials', 'zk-register-onchain', 'complete'].includes(currentStep) ? 'complete' as const : 'pending' as const,
          description: 'One-time wallet connection'
        },
        {
          label: 'Generate Credentials',
          status: ['select-role', 'choose-method', 'zk-connect-wallet'].includes(currentStep) ? 'pending' as const :
                  currentStep === 'zk-generate-credentials' ? 'current' as const :
                  ['zk-register-onchain', 'complete'].includes(currentStep) ? 'complete' as const : 'pending' as const,
          description: 'Create private ZK credentials'
        },
        {
          label: 'Register On-Chain',
          status: ['select-role', 'choose-method', 'zk-connect-wallet', 'zk-generate-credentials'].includes(currentStep) ? 'pending' as const :
                  currentStep === 'zk-register-onchain' ? 'current' as const :
                  currentStep === 'complete' ? 'complete' as const : 'pending' as const,
          description: 'Store commitment on blockchain'
        },
      ];
      return [...baseSteps, ...zkSteps];
    } else if (selectedAuthMethod === 'web3') {
      // Web3 Flow steps
      return [
        ...baseSteps,
        {
          label: 'Connect Wallet',
          status: ['select-role', 'choose-method'].includes(currentStep) ? 'pending' as const :
                  currentStep === 'web3-connect-wallet' ? 'current' as const : 'complete' as const,
          description: 'Connect your Web3 wallet'
        },
      ];
    }

    // Default (no method selected yet)
    return baseSteps;
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="bg-surface-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Authentication Progress
        </h3>
        <ProgressSteps steps={getProgressSteps()} />
      </div>

      {/* Step Content */}
      <div className="bg-surface-800 rounded-lg p-6">
        {/* Step 1: Select Role */}
        {currentStep === 'select-role' && (
          <div>
            <h4 className="text-white font-semibold mb-2">Step 1: Select Your Role</h4>
            <p className="text-surface-300 text-sm mb-4">
              Choose the role that best describes you. This will determine your permissions in the system.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {(['student', 'university', 'employer', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleSelect(role)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedRole === role
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-surface-600 hover:border-surface-500'
                  }`}
                >
                  <div className="text-white font-medium capitalize">{role}</div>
                  <div className="text-surface-400 text-xs mt-1">
                    {role === 'student' && 'Earn and manage credentials'}
                    {role === 'university' && 'Issue academic credentials'}
                    {role === 'employer' && 'Verify student credentials'}
                    {role === 'admin' && 'Manage the system'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Choose Authentication Method */}
        {currentStep === 'choose-method' && (
          <div>
            <h4 className="text-white font-semibold mb-2">Step 2: Choose Your Login Method</h4>
            <p className="text-surface-300 text-sm mb-4">
              Select how you want to authenticate. Each method has different privacy and security characteristics.
            </p>
            <div className={`grid grid-cols-1 gap-4 ${selectedRole !== 'admin' && selectedRole !== 'university' ? 'md:grid-cols-2' : 'max-w-md mx-auto'}`}>
              {/* ZK Auth Option - Only show for students and employers */}
              {selectedRole !== 'admin' && selectedRole !== 'university' && (
                <button
                  onClick={() => handleAuthMethodSelect('zk')}
                  className="p-6 rounded-lg border-2 border-primary-500 hover:border-primary-400 transition-all text-left"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-white font-semibold">Private Login (ZK Proof)</h5>
                      <p className="text-primary-400 text-xs">Recommended for privacy</p>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-surface-300">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>Login without revealing your wallet</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>Enhanced privacy after initial setup</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-400 mt-0.5">⚠</span>
                      <span>One-time wallet connection required for setup</span>
                    </li>
                  </ul>
                </button>
              )}

              {/* Web3 Auth Option */}
              <button
                onClick={() => handleAuthMethodSelect('web3')}
                className="p-6 rounded-lg border-2 border-surface-600 hover:border-surface-500 transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="text-white font-semibold">Standard Wallet Login</h5>
                    <p className="text-accent-400 text-xs">Simple and direct</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-surface-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Quick and easy setup</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>No additional registration needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">ℹ</span>
                    <span>Your wallet address is visible on-chain</span>
                  </li>
                </ul>
              </button>
            </div>

            {/* Informational message for admin/university - only one method available */}
            {(selectedRole === 'admin' || selectedRole === 'university') && (
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm text-surface-300">
                      {selectedRole === 'admin' && (
                        <>
                          <strong className="text-white">Why Standard Login only?</strong><br />
                          Admin accounts require public accountability and transparency. Standard Login ensures all administrative actions are traceable on-chain, maintaining trust in the platform.
                        </>
                      )}
                      {selectedRole === 'university' && (
                        <>
                          <strong className="text-white">Why Standard Login only?</strong><br />
                          Universities are public institutions that issue many certificates. Standard Login ensures transparency, accountability, and cost-efficiency for high-volume operations.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Back Button */}
            <button
              onClick={() => setCurrentStep('select-role')}
              className="mt-4 text-sm text-surface-400 hover:text-white transition-colors"
            >
              ← Back to Role Selection
            </button>
          </div>
        )}

        {/* ZK Registration Flow Steps */}
        {currentStep === 'zk-connect-wallet' && (
          <div>
            <h4 className="text-white font-semibold mb-2">Step 3: Connect Wallet</h4>
            <p className="text-surface-300 text-sm mb-4">
              Connect your wallet to register your ZK credentials on-chain. This is a one-time setup.
            </p>
            <div className="flex justify-center py-4">
              <ConnectButton />
            </div>
            {!isConnected && (
              <p className="text-surface-400 text-xs text-center mt-2">
                ⚠️ Your wallet address will be visible during registration
              </p>
            )}
            {isConnected && (
              <button
                onClick={() => setCurrentStep('zk-generate-credentials')}
                className="w-full mt-4 py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
              >
                Continue
              </button>
            )}
          </div>
        )}

        {currentStep === 'zk-generate-credentials' && (
          <div>
            <h4 className="text-white font-semibold mb-2">Step 4: Generate ZK Credentials</h4>
            <p className="text-surface-300 text-sm mb-4">
              Generate your private ZK credentials and register your commitment on the blockchain.
              Your private key will be encrypted and stored securely in your browser.
            </p>
            <button
              onClick={handleZKRegistration}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 disabled:bg-surface-600 
                       text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Generating & Registering...</span>
                </>
              ) : (
                'Generate & Register Credentials'
              )}
            </button>
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
                <p className="text-surface-400 text-xs mt-1">{getErrorAction(error).label}</p>
              </div>
            )}
          </div>
        )}

        {currentStep === 'zk-register-onchain' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500/20 mb-4">
              <svg className="animate-spin h-8 w-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h4 className="text-white font-semibold mb-2">Registering On-Chain...</h4>
            <p className="text-surface-300 text-sm">
              Please confirm the transaction in your wallet and wait for it to be confirmed on-chain.
            </p>
          </div>
        )}

        {/* ZK Login Flow Steps */}
        {currentStep === 'zk-load-credentials' && (
          <div>
            <h4 className="text-white font-semibold mb-2">Step 3: Load Credentials</h4>
            <p className="text-surface-300 text-sm mb-2">
              Your ZK credentials are encrypted and stored locally in your browser. 
              To decrypt them, you'll need to sign a message with your wallet.
            </p>
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <p className="text-blue-300 font-medium mb-1">What happens next:</p>
                  <ul className="text-blue-200 space-y-1 text-xs">
                    <li>• Your wallet will prompt you to approve access</li>
                    <li>• You'll be asked to sign a message (no transaction, free!)</li>
                    <li>• The signature decrypts your credentials locally</li>
                    <li>• Your wallet address remains private ✨</li>
                  </ul>
                </div>
              </div>
            </div>
            <button
              onClick={handleZKLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 disabled:bg-surface-600 
                       text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                'Load Credentials & Login'
              )}
            </button>
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
                <p className="text-surface-400 text-xs mt-1">{getErrorAction(error).label}</p>
              </div>
            )}
          </div>
        )}

        {currentStep === 'zk-generate-proof' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500/20 mb-4">
              <svg className="animate-spin h-8 w-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h4 className="text-white font-semibold mb-2">Generating Proof...</h4>
            <p className="text-surface-300 text-sm">
              Creating your zero-knowledge proof for private authentication.
            </p>
          </div>
        )}

        {/* Web3 Flow Steps */}
        {currentStep === 'web3-connect-wallet' && (
          <div>
            <h4 className="text-white font-semibold mb-2">Step 3: Connect Wallet</h4>
            <p className="text-surface-300 text-sm mb-4">
              Connect your Web3 wallet to authenticate. Your wallet address will be visible on-chain.
            </p>
            <div className="flex justify-center py-4">
              <ConnectButton />
            </div>
          </div>
        )}

        {/* Completion Step */}
        {currentStep === 'complete' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-white font-semibold mb-2">Authentication Complete!</h4>
            <p className="text-surface-300 text-sm">
              You're now authenticated and will be redirected to your dashboard...
            </p>
          </div>
        )}
      </div>

      {/* Cancel Button (except on complete step) */}
      {currentStep !== 'complete' && onCancel && (
        <button
          onClick={onCancel}
          className="w-full py-2 text-sm text-surface-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

