// frontend/src/components/zkauth/ZKRegistrationFlow.tsx
/**
 * ZK Registration Flow Component
 * ==============================
 * 
 * Provides a step-by-step guided flow for ZK authentication registration and login.
 * 
 * Flow Steps:
 * 1. Select Role (student, university, employer)
 * 2. Connect Wallet (one-time setup)
 * 3. Generate ZK Credentials (private key, commitment)
 * 4. Register On-Chain (commitment stored)
 * 5. Complete Setup (ready for private login)
 * 
 * Features:
 * - Clear progress indicator showing current step
 * - Descriptive guidance for each step
 * - Automatic progression through steps
 * - Error handling with user-friendly messages
 * - Ability to go back to previous steps (where applicable)
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ProgressSteps } from '@/components/ProgressSteps';
import { useZKAuth } from '@/hooks/useZKAuth';
import { useAuthStore, type UserRole } from '@/store/authStore';
import { logger } from '@/lib/logger';
import { getFriendlyError } from '@/lib/errors/zkAuthErrors';

interface ZKRegistrationFlowProps {
  onComplete?: () => void;
  onCancel?: () => void;
  mode: 'register' | 'login';
}

type RegistrationStep = 
  | 'select-role'
  | 'connect-wallet'
  | 'generate-credentials'
  | 'register-onchain'
  | 'complete';

type LoginStep =
  | 'connect-wallet'
  | 'load-credentials'
  | 'generate-proof'
  | 'authenticate'
  | 'complete';

export function ZKRegistrationFlow({ onComplete, onCancel, mode }: ZKRegistrationFlowProps) {
  const { address, isConnected } = useAccount();
  const { register, login, error: zkError, isLoading } = useZKAuth();
  const { setRole } = useAuthStore();
  
  const [currentStep, setCurrentStep] = useState<RegistrationStep | LoginStep>(
    mode === 'register' ? 'select-role' : 'connect-wallet'
  );
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-advance steps based on state
  useEffect(() => {
    if (mode === 'register') {
      if (currentStep === 'select-role' && selectedRole) {
        setCurrentStep('connect-wallet');
      }
      if (currentStep === 'connect-wallet' && isConnected && address) {
        setCurrentStep('generate-credentials');
      }
    } else {
      // Login mode
      if (currentStep === 'connect-wallet' && isConnected && address) {
        setCurrentStep('load-credentials');
      }
    }
  }, [currentStep, selectedRole, isConnected, address, mode]);

  // Handle errors
  useEffect(() => {
    if (zkError) {
      setError(getFriendlyError(zkError));
    }
  }, [zkError]);

  // Registration: Generate credentials and register
  const handleGenerateAndRegister = async () => {
    if (!selectedRole) return;
    
    try {
      setError(null);
      setCurrentStep('register-onchain');
      
      await register(selectedRole as 'student' | 'university' | 'employer');
      setRole(selectedRole);
      
      setCurrentStep('complete');
      
      // Complete after a short delay
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    } catch (err) {
      logger.error('Registration failed:', err);
      setError(getFriendlyError(err as Error));
      setCurrentStep('generate-credentials');
    }
  };

  // Login: Load credentials and authenticate
  const handleLoginWithZK = async () => {
    try {
      setError(null);
      setCurrentStep('generate-proof');
      
      await login();
      
      setCurrentStep('complete');
      
      // Complete after a short delay
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    } catch (err) {
      logger.error('Login failed:', err);
      setError(getFriendlyError(err as Error));
      setCurrentStep('load-credentials');
    }
  };

  // Build progress steps for display
  const getProgressSteps = (): Array<{label: string, status: 'complete' | 'current' | 'pending' | 'error', description?: string}> => {
    if (mode === 'register') {
      return [
        {
          label: 'Select Role',
          status: (currentStep === 'select-role' ? 'current' : 
                  ['connect-wallet', 'generate-credentials', 'register-onchain', 'complete'].includes(currentStep) ? 'complete' : 'pending') as 'complete' | 'current' | 'pending',
          description: 'Choose your account type'
        },
        {
          label: 'Connect Wallet',
          status: (currentStep === 'connect-wallet' ? 'current' :
                  ['generate-credentials', 'register-onchain', 'complete'].includes(currentStep) ? 'complete' : 'pending') as 'complete' | 'current' | 'pending',
          description: 'One-time wallet connection for registration'
        },
        {
          label: 'Generate Credentials',
          status: (currentStep === 'generate-credentials' ? 'current' :
                  ['register-onchain', 'complete'].includes(currentStep) ? 'complete' : 'pending') as 'complete' | 'current' | 'pending',
          description: 'Create private ZK credentials'
        },
        {
          label: 'Register On-Chain',
          status: (currentStep === 'register-onchain' ? 'current' :
                  currentStep === 'complete' ? 'complete' : 'pending') as 'complete' | 'current' | 'pending',
          description: 'Store commitment on blockchain'
        },
        {
          label: 'Setup Complete',
          status: (currentStep === 'complete' ? 'complete' : 'pending') as 'complete' | 'pending',
          description: 'Ready for private login!'
        }
      ];
    } else {
      return [
        {
          label: 'Connect Wallet',
          status: (currentStep === 'connect-wallet' ? 'current' :
                  ['load-credentials', 'generate-proof', 'authenticate', 'complete'].includes(currentStep as LoginStep) ? 'complete' : 'pending') as 'complete' | 'current' | 'pending',
          description: 'Connect to load credentials'
        },
        {
          label: 'Load Credentials',
          status: (currentStep === 'load-credentials' ? 'current' :
                  ['generate-proof', 'authenticate', 'complete'].includes(currentStep as LoginStep) ? 'complete' : 'pending') as 'complete' | 'current' | 'pending',
          description: 'Retrieve stored ZK credentials'
        },
        {
          label: 'Generate Proof',
          status: (currentStep === 'generate-proof' ? 'current' :
                  ['authenticate', 'complete'].includes(currentStep as LoginStep) ? 'complete' : 'pending') as 'complete' | 'current' | 'pending',
          description: 'Create zero-knowledge proof'
        },
        {
          label: 'Authenticate',
          status: (currentStep === 'authenticate' ? 'current' :
                  currentStep === 'complete' ? 'complete' : 'pending') as 'complete' | 'current' | 'pending',
          description: 'Verify proof and login'
        },
        {
          label: 'Login Complete',
          status: (currentStep === 'complete' ? 'complete' : 'pending') as 'complete' | 'pending',
          description: 'You are now logged in!'
        }
      ];
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="bg-surface-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          {mode === 'register' ? 'ZK Registration Progress' : 'ZK Login Progress'}
        </h3>
        <ProgressSteps steps={getProgressSteps()} />
      </div>

      {/* Step Content */}
      <div className="bg-surface-800 rounded-lg p-6">
        {/* Select Role (Registration only) */}
        {mode === 'register' && currentStep === 'select-role' && (
          <div>
            <h4 className="text-white font-semibold mb-2">Step 1: Select Your Role</h4>
            <p className="text-surface-300 text-sm mb-4">
              Choose the role that best describes you. This will determine your permissions in the system.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['student', 'university', 'employer'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
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
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Connect Wallet */}
        {currentStep === 'connect-wallet' && (
          <div>
            <h4 className="text-white font-semibold mb-2">
              {mode === 'register' ? 'Step 2: Connect Wallet' : 'Step 1: Connect Wallet'}
            </h4>
            <p className="text-surface-300 text-sm mb-4">
              {mode === 'register' 
                ? 'Connect your wallet to register your ZK credentials on-chain. This is a one-time setup.'
                : 'Connect your wallet to access your stored ZK credentials and login privately.'
              }
            </p>
            <div className="flex justify-center py-4">
              <ConnectButton />
            </div>
            {!isConnected && (
              <p className="text-surface-400 text-xs text-center mt-2">
                ⚠️ Your wallet address will be visible during {mode === 'register' ? 'registration' : 'credential loading'}
              </p>
            )}
          </div>
        )}

        {/* Generate Credentials (Registration) */}
        {mode === 'register' && currentStep === 'generate-credentials' && (
          <div>
            <h4 className="text-white font-semibold mb-2">Step 3: Generate ZK Credentials</h4>
            <p className="text-surface-300 text-sm mb-4">
              Generate your private ZK credentials and register your commitment on the blockchain.
              Your private key will be encrypted and stored securely in your browser.
            </p>
            <button
              onClick={handleGenerateAndRegister}
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
                  <span>Generating Credentials...</span>
                </>
              ) : (
                'Generate & Register'
              )}
            </button>
          </div>
        )}

        {/* Register On-Chain (Registration) */}
        {mode === 'register' && currentStep === 'register-onchain' && (
          <div>
            <h4 className="text-white font-semibold mb-2">Step 4: Registering On-Chain</h4>
            <p className="text-surface-300 text-sm mb-4">
              Your commitment is being stored on the blockchain. Please confirm the transaction in your wallet...
            </p>
            <div className="flex justify-center py-6">
              <svg className="animate-spin h-12 w-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
        )}

        {/* Load Credentials (Login) */}
        {mode === 'login' && currentStep === 'load-credentials' && (
          <div>
            <h4 className="text-white font-semibold mb-2">Step 2: Load Credentials</h4>
            <p className="text-surface-300 text-sm mb-4">
              Your encrypted ZK credentials are being loaded from secure storage...
            </p>
            <button
              onClick={handleLoginWithZK}
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
                  <span>Authenticating...</span>
                </>
              ) : (
                'Login with ZK Proof'
              )}
            </button>
          </div>
        )}

        {/* Generate Proof (Login) */}
        {mode === 'login' && (currentStep === 'generate-proof' || currentStep === 'authenticate') && (
          <div>
            <h4 className="text-white font-semibold mb-2">
              {currentStep === 'generate-proof' ? 'Step 3: Generating Proof' : 'Step 4: Authenticating'}
            </h4>
            <p className="text-surface-300 text-sm mb-4">
              {currentStep === 'generate-proof' 
                ? 'Creating zero-knowledge proof to authenticate without revealing your credentials...'
                : 'Verifying your proof and completing login...'}
            </p>
            <div className="flex justify-center py-6">
              <svg className="animate-spin h-12 w-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
        )}

        {/* Complete */}
        {currentStep === 'complete' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-white font-semibold text-lg mb-2">
              {mode === 'register' ? 'Registration Complete!' : 'Login Successful!'}
            </h4>
            <p className="text-surface-300 text-sm">
              {mode === 'register' 
                ? 'You can now login privately using zero-knowledge proofs.'
                : 'Welcome back! You are now logged in with enhanced privacy.'}
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-surface-300 hover:text-white transition-colors"
        >
          Cancel
        </button>
        
        {mode === 'register' && currentStep === 'select-role' && (
          <button
            onClick={() => setCurrentStep('connect-wallet')}
            disabled={!selectedRole}
            className="px-6 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-surface-600 
                     text-white rounded-lg font-medium transition-colors"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

