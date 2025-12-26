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
 */

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useZKAuth } from '@/hooks/useZKAuth';
import { ZKAuthButton } from '@/components/zkauth/ZKAuthButton';
import { logger } from '@/lib/logger';

export default function ZKAuthPage() {
  const { address, isConnected } = useAccount();
  const {
    isAuthenticated,
    role,
    commitment,
    sessionId,
    isLoading,
    error,
    hasCredentials,
    clearCredentials,
  } = useZKAuth();

  useEffect(() => {
    logger.info('ZKAuth page loaded', { 
      address, 
      isConnected, 
      isAuthenticated,
      hasCredentials 
    });
  }, [address, isConnected, isAuthenticated, hasCredentials]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔐 Zero-Knowledge Authentication
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Privacy-preserving authentication powered by zero-knowledge proofs.
            Authenticate without revealing your wallet address.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Authentication */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Authentication
            </h2>

            {/* Wallet Connection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Step 1: Connect Wallet
              </label>
              <ConnectButton />
            </div>

            {/* ZK Auth Button */}
            {isConnected && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step 2: {hasCredentials ? 'Login' : 'Register'}
                </label>
                <ZKAuthButton />
              </div>
            )}

            {/* Status Display */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Current Status
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Wallet Connected:</dt>
                  <dd className="font-medium">
                    {isConnected ? '✅ Yes' : '❌ No'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Has Credentials:</dt>
                  <dd className="font-medium">
                    {hasCredentials ? '✅ Yes' : '❌ No'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Authenticated:</dt>
                  <dd className="font-medium">
                    {isAuthenticated ? '✅ Yes' : '❌ No'}
                  </dd>
                </div>
                {isAuthenticated && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Role:</dt>
                    <dd className="font-medium text-blue-600">
                      {role}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Debug Info (Only in Development) */}
            {isAuthenticated && commitment && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-xs font-semibold text-gray-700 mb-2">
                  Session Details
                </h3>
                <dl className="space-y-1 text-xs font-mono">
                  <div>
                    <dt className="text-gray-500">Commitment:</dt>
                    <dd className="text-gray-900 break-all">
                      {commitment.slice(0, 20)}...{commitment.slice(-20)}
                    </dd>
                  </div>
                  {sessionId && (
                    <div>
                      <dt className="text-gray-500">Session ID:</dt>
                      <dd className="text-gray-900 break-all">
                        {sessionId.slice(0, 20)}...{sessionId.slice(-20)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Danger Zone */}
            {hasCredentials && (
              <div className="mt-6 pt-6 border-t border-red-100">
                <h3 className="text-sm font-semibold text-red-700 mb-2">
                  ⚠️ Danger Zone
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Clear stored credentials. You will need to register again.
                </p>
                <button
                  onClick={clearCredentials}
                  className="w-full px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  🗑️ Clear Credentials
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Information */}
          <div className="space-y-6">
            {/* How It Works */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                How It Works
              </h2>
              <ol className="space-y-4 text-sm text-gray-600">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-bold text-xs">
                    1
                  </span>
                  <div>
                    <strong className="text-gray-900">Generate Keypair</strong>
                    <p>Your browser generates a random private key (never leaves your device)</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-bold text-xs">
                    2
                  </span>
                  <div>
                    <strong className="text-gray-900">Compute Commitment</strong>
                    <p>hash(hash(privateKey), walletAddress, salt) = commitment</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-bold text-xs">
                    3
                  </span>
                  <div>
                    <strong className="text-gray-900">Register On-Chain</strong>
                    <p>Only the commitment is stored (wallet address hidden!)</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-bold text-xs">
                    4
                  </span>
                  <div>
                    <strong className="text-gray-900">Prove Ownership</strong>
                    <p>Generate ZK proof that you know the private key without revealing it</p>
                  </div>
                </li>
              </ol>
            </div>

            {/* Privacy Benefits */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Privacy Benefits
              </h2>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong className="text-gray-900">Wallet Privacy:</strong>{' '}
                    Your wallet address is not revealed during registration
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong className="text-gray-900">Key Security:</strong>{' '}
                    Private keys never touch the blockchain
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong className="text-gray-900">Zero-Knowledge:</strong>{' '}
                    Prove identity without revealing secrets
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong className="text-gray-900">Local Encryption:</strong>{' '}
                    Credentials encrypted with your wallet signature
                  </span>
                </li>
              </ul>
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <div className="flex gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="text-sm">
                  <h3 className="font-semibold text-yellow-900 mb-2">
                    Phase 1 - Testing Only
                  </h3>
                  <p className="text-yellow-800">
                    Currently using a mock verifier that accepts all proofs.
                    In Phase 2, this will be replaced with a real ZK-SNARK verifier
                    for production-grade security.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-xl">❌</span>
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                <p className="text-sm text-red-700">{error.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-sm mx-4 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-900 font-medium">Processing...</p>
              <p className="text-sm text-gray-500 mt-2">
                Please wait while we process your request
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

