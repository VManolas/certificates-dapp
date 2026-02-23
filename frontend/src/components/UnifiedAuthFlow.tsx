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

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import type { ZKAuthProgressEvent } from '@/hooks/useZKAuth';
import { ProgressSteps } from './ProgressSteps';
import { getFriendlyError, getErrorAction, logError } from '@/lib/errors/zkAuthErrors';
import type { UserRole, AuthMethod } from '@/types/auth';
import { logger } from '@/lib/logger';

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
  const [walletInteractionStep, setWalletInteractionStep] = useState<1 | 2 | 3 | 4 | null>(null);
  const [walletInteractionHint, setWalletInteractionHint] = useState<string | null>(null);
  const [isOnchainPending, setIsOnchainPending] = useState(false);
  const [walletInteractionMode, setWalletInteractionMode] = useState<'setup' | 'login' | null>(null);
  const [contractInteractionStatus, setContractInteractionStatus] = useState<'idle' | 'awaiting_wallet_confirmation' | 'pending_onchain' | 'confirmed'>('idle');
  const activeRunIdRef = useRef(0);

  const beginNewRun = () => {
    activeRunIdRef.current += 1;
    return activeRunIdRef.current;
  };

  const isCurrentRun = (runId: number) => activeRunIdRef.current === runId;

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
    beginNewRun();
    setSelectedAuthMethod(method);
    unifiedAuth.selectAuthMethod(method, true);
    setWalletInteractionStep(null);
    setWalletInteractionHint(null);
    setIsOnchainPending(false);
    setWalletInteractionMode(null);
    setContractInteractionStatus('idle');
    
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
  const handleZKSetupProgress = (event: ZKAuthProgressEvent, runId: number) => {
    if (!isCurrentRun(runId)) return;
    switch (event) {
      case 'register_signature_required':
        setWalletInteractionStep(1);
        setWalletInteractionHint('Approve the signature request to encrypt your private ZK credentials locally.');
        setIsOnchainPending(false);
        break;
      case 'register_signature_complete':
        setWalletInteractionStep(2);
        setWalletInteractionHint('Next, approve the commitment registration transaction.');
        setIsOnchainPending(false);
        break;
      case 'register_transaction_required':
        setWalletInteractionStep(2);
        setWalletInteractionHint('MetaMask is waiting for your approval to register your commitment on-chain.');
        setIsOnchainPending(false);
        setContractInteractionStatus('awaiting_wallet_confirmation');
        break;
      case 'register_transaction_submitted':
        setWalletInteractionStep(2);
        setWalletInteractionHint('Commitment transaction submitted. Waiting for blockchain confirmation.');
        setIsOnchainPending(true);
        setContractInteractionStatus('pending_onchain');
        break;
      case 'register_transaction_confirmed':
        setWalletInteractionStep(3);
        setWalletInteractionHint('Commitment confirmed. Next, sign to unlock your private credentials.');
        setIsOnchainPending(false);
        setContractInteractionStatus('confirmed');
        break;
      case 'login_wallet_access_required':
        setWalletInteractionHint('If MetaMask asks for account access, approve it to continue.');
        setIsOnchainPending(false);
        break;
      case 'login_signature_required':
        setWalletInteractionStep(3);
        setWalletInteractionHint('Approve signature to unlock your local ZK credentials.');
        setIsOnchainPending(false);
        break;
      case 'login_signature_complete':
        setWalletInteractionStep(4);
        setWalletInteractionHint('Signature accepted. Final step: approve the session-start transaction.');
        setIsOnchainPending(false);
        setContractInteractionStatus('awaiting_wallet_confirmation');
        break;
      case 'login_transaction_required':
        setWalletInteractionStep(4);
        setWalletInteractionHint('Approve the final session-start transaction in MetaMask.');
        setIsOnchainPending(false);
        setContractInteractionStatus('awaiting_wallet_confirmation');
        break;
      case 'login_transaction_submitted':
        setWalletInteractionStep(4);
        setWalletInteractionHint('Session-start transaction submitted. Waiting for blockchain confirmation.');
        setIsOnchainPending(true);
        setContractInteractionStatus('pending_onchain');
        break;
      case 'login_transaction_confirmed':
        setWalletInteractionStep(4);
        setWalletInteractionHint('Final transaction confirmed. Private login is now active.');
        setIsOnchainPending(false);
        setContractInteractionStatus('confirmed');
        break;
      default:
        break;
    }
  };

  const handleZKLoginProgress = (event: ZKAuthProgressEvent, runId: number) => {
    if (!isCurrentRun(runId)) return;
    switch (event) {
      case 'login_wallet_access_required':
        setWalletInteractionStep(1);
        setWalletInteractionHint('Approve wallet account access in MetaMask to continue.');
        setIsOnchainPending(false);
        break;
      case 'login_signature_required':
        setWalletInteractionStep(2);
        setWalletInteractionHint('Approve the signature request to decrypt your local ZK credentials.');
        setIsOnchainPending(false);
        break;
      case 'login_signature_complete':
        setWalletInteractionStep(3);
        setWalletInteractionHint('Signature accepted. Next, approve the on-chain session start transaction.');
        setIsOnchainPending(false);
        break;
      case 'login_transaction_required':
        setWalletInteractionStep(4);
        setWalletInteractionHint('MetaMask is waiting for your approval to start a private ZK session on-chain.');
        setIsOnchainPending(false);
        setContractInteractionStatus('awaiting_wallet_confirmation');
        break;
      case 'login_transaction_submitted':
        setWalletInteractionStep(4);
        setWalletInteractionHint('Session start transaction submitted. Waiting for blockchain confirmation.');
        setIsOnchainPending(true);
        setContractInteractionStatus('pending_onchain');
        break;
      case 'login_transaction_confirmed':
        setWalletInteractionStep(4);
        setWalletInteractionHint('Private session transaction confirmed. Login is complete.');
        setIsOnchainPending(false);
        setContractInteractionStatus('confirmed');
        break;
      default:
        break;
    }
  };

  const handleZKRegistration = async () => {
    if (!selectedRole || selectedRole === 'admin') return;
    
    const runId = beginNewRun();

    try {
      if (!isCurrentRun(runId)) return;
      setIsLoading(true);
      setError(null);
      // Defensive optimization: if credentials already exist for this wallet,
      // skip registration and proceed directly to private login.
      if (unifiedAuth.zkAuth.hasCredentials) {
        if (!isCurrentRun(runId)) return;
        logger.info('Skipping ZK registration because credentials already exist for this wallet');
        setWalletInteractionMode('login');
        setWalletInteractionStep(1);
        setWalletInteractionHint('Existing private credentials detected. Proceeding directly to private login.');
        setIsOnchainPending(false);
        setContractInteractionStatus('idle');
        setCurrentStep('zk-generate-proof');
        await unifiedAuth.zkAuth.login((event) => handleZKLoginProgress(event, runId));
        if (!isCurrentRun(runId)) return;
        setCurrentStep('complete');
        setTimeout(() => {
          onComplete?.();
        }, 1500);
        return;
      }

      setWalletInteractionMode('setup');
      setWalletInteractionStep(1);
      setWalletInteractionHint('One-time setup requires three wallet confirmations for secure enrollment.');
      setIsOnchainPending(false);
      setContractInteractionStatus('idle');
      setCurrentStep('zk-register-onchain');
      
      // Only students and employers can use ZK auth
      if (selectedRole !== 'student' && selectedRole !== 'employer') {
        throw new Error('Only students and employers can use ZK authentication');
      }
      
      await unifiedAuth.zkAuth.register(selectedRole, (event) => handleZKSetupProgress(event, runId));
      if (!isCurrentRun(runId)) return;
      
      // Auto-login after successful registration
      // This matches the behavior of the /zkauth page
      logger.info('ZK registration successful, initiating auto-login', { role: selectedRole });
      setCurrentStep('zk-generate-proof');
      
      try {
        await unifiedAuth.zkAuth.login((event) => handleZKSetupProgress(event, runId));
        if (!isCurrentRun(runId)) return;
        logger.info('ZK auto-login successful');
        
        setCurrentStep('complete');
        setTimeout(() => {
          onComplete?.();
        }, 1500);
      } catch (loginErr) {
        if (!isCurrentRun(runId)) return;
        const err = loginErr as Error;
        // Registration succeeded, but authentication did not.
        // Do NOT mark flow complete because route guards require authenticated ZK session.
        logger.warn('ZK registration succeeded but auto-login failed; requiring explicit login', {
          message: err.message,
        });
        if (err.message === 'CREDENTIALS_OUTDATED') {
          // Credentials were cleared by the decrypt path; require a clean re-registration.
          setCurrentStep('zk-generate-credentials');
          setError('Your credentials became invalid during setup. Please generate and register once more to complete private login.');
        } else {
          setCurrentStep('zk-load-credentials');
          setError('Registration succeeded, but private session login was not completed. Please continue below to finish login.');
        }
      }
    } catch (err) {
      if (!isCurrentRun(runId)) return;
      logError(err as Error, 'ZK Registration');
      setError(getFriendlyError(err as Error));
      setCurrentStep('zk-generate-credentials');
      setWalletInteractionStep(null);
      setWalletInteractionHint(null);
      setIsOnchainPending(false);
    } finally {
      if (!isCurrentRun(runId)) return;
      setIsLoading(false);
    }
  };

  // ZK Login: Load credentials and authenticate
  const handleZKLogin = async () => {
    const runId = beginNewRun();

    if (!unifiedAuth.zkAuth.hasCredentials) {
      if (!isCurrentRun(runId)) return;
      setError('No private credentials found for this wallet. Please register once to enable private login.');
      setCurrentStep('zk-connect-wallet');
      return;
    }

    try {
      if (!isCurrentRun(runId)) return;
      setIsLoading(true);
      setError(null);
      setWalletInteractionMode('login');
      setWalletInteractionStep(1);
      setWalletInteractionHint('Private login includes three wallet interaction steps. Follow MetaMask prompts.');
      setIsOnchainPending(false);
      setContractInteractionStatus('idle');
      setCurrentStep('zk-generate-proof');
      
      await unifiedAuth.zkAuth.login((event) => handleZKLoginProgress(event, runId));
      if (!isCurrentRun(runId)) return;
      
      setCurrentStep('complete');
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    } catch (err) {
      if (!isCurrentRun(runId)) return;
      const loginError = err as Error;
      const message = loginError.message || '';

      // Expected recovery paths: credentials are missing/outdated for this wallet.
      // Move user to registration flow instead of looping on login errors.
      if (
        message === 'CREDENTIALS_OUTDATED' ||
        message.includes('No stored credentials')
      ) {
        setError('Private credentials are not available for this wallet. Please complete one-time registration to continue.');
        setCurrentStep('zk-connect-wallet');
      } else {
        logError(loginError, 'ZK Login');
        setError(getFriendlyError(loginError));
        setCurrentStep('zk-load-credentials');
      }

      setWalletInteractionStep(null);
      setWalletInteractionHint(null);
      setIsOnchainPending(false);
      setWalletInteractionMode(null);
      setContractInteractionStatus('idle');
    } finally {
      if (!isCurrentRun(runId)) return;
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

  const walletTransparencyPanel = walletInteractionStep !== null ? (
    <div className="mt-4 rounded-xl border border-surface-700 bg-surface-900/40 p-4 text-left">
      <h5 className="text-sm font-semibold text-white mb-2">Wallet Interaction Transparency</h5>
      <p className="text-xs text-surface-400 mb-3">
        {walletInteractionMode === 'login'
          ? 'This private login includes up to four wallet interactions, depending on your wallet prompts.'
          : 'First-time private setup includes four wallet interactions from enrollment to private session start.'}
      </p>
      <div className="space-y-2">
        {(walletInteractionMode === 'login'
          ? [
              { step: 1 as const, title: '1) Approve wallet account access' },
              { step: 2 as const, title: '2) Sign to decrypt credentials locally' },
              { step: 3 as const, title: '3) Sign to unlock credentials' },
              { step: 4 as const, title: '4) Start private session transaction' },
            ]
          : [
              { step: 1 as const, title: '1) Sign message' },
              { step: 2 as const, title: '2) Register commitment transaction' },
              { step: 3 as const, title: '3) Sign to unlock credentials' },
              { step: 4 as const, title: '4) Start private session transaction' },
            ]
        ).map((item) => {
          const isDone = walletInteractionStep > item.step;
          const isCurrent = walletInteractionStep === item.step;
          return (
            <div
              key={item.step}
              className={`flex items-center gap-2 rounded border p-2 ${
                isDone
                  ? 'border-green-500/30 bg-green-500/10'
                  : isCurrent
                  ? 'border-primary-500/30 bg-primary-500/10'
                  : 'border-surface-700 bg-surface-800/60'
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isDone
                    ? 'bg-green-500/20 text-green-300'
                    : isCurrent
                    ? 'bg-primary-500/20 text-primary-300'
                    : 'bg-surface-700 text-surface-400'
                }`}
              >
                {isDone ? '✓' : item.step}
              </div>
              <span className="text-xs text-surface-200">{item.title}</span>
            </div>
          );
        })}
      </div>
      {walletInteractionHint && (
        <p className="mt-3 text-xs text-blue-300">{walletInteractionHint}</p>
      )}
      {contractInteractionStatus !== 'idle' && (
        <div
          className={`mt-3 rounded border p-2 text-xs ${
            contractInteractionStatus === 'awaiting_wallet_confirmation'
              ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
              : contractInteractionStatus === 'pending_onchain'
              ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
              : 'border-green-500/30 bg-green-500/10 text-green-300'
          }`}
        >
          {contractInteractionStatus === 'awaiting_wallet_confirmation' && 'Contract interaction: waiting for wallet approval'}
          {contractInteractionStatus === 'pending_onchain' && 'Contract interaction: pending on blockchain'}
          {contractInteractionStatus === 'confirmed' && 'Contract interaction: confirmed'}
        </div>
      )}
      {isOnchainPending && (
        <p className="mt-1 text-xs text-yellow-300">
          Transaction sent to chain. Confirmation can take a few seconds.
        </p>
      )}
    </div>
  ) : null;

  const hasExistingCredentials = unifiedAuth.zkAuth.hasCredentials;

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
              We need your wallet once to anchor your private identity on-chain: your wallet signs to protect local credentials and approves registration/session transactions.
              After setup, you authenticate privately with ZK proofs instead of exposing your wallet on every login.
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
            <h4 className="text-white font-semibold mb-2">
              {hasExistingCredentials ? 'Step 4: Continue Private Login' : 'Step 4: Generate ZK Credentials'}
            </h4>
            <p className="text-surface-300 text-sm mb-4">
              {hasExistingCredentials
                ? 'Private credentials already exist for this wallet. Continue to start a private session without re-registering your commitment.'
                : 'Generate your private ZK credentials and register your commitment on the blockchain. Your private key will be encrypted and stored securely in your browser.'}
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
                hasExistingCredentials ? 'Continue Private Login' : 'Generate & Register Credentials'
              )}
            </button>
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
                <p className="text-surface-400 text-xs mt-1">{getErrorAction(error).label}</p>
              </div>
            )}
            {walletInteractionMode === 'login' && walletTransparencyPanel}
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
            {walletTransparencyPanel}
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
            {walletTransparencyPanel}
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

