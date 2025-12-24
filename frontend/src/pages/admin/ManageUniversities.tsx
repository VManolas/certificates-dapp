/**
 * @fileoverview Admin page for managing universities (registration and approval)
 * @module pages/admin/ManageUniversities
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { isAddress } from 'viem';
import { useRegisterInstitutionByAdmin, useIsInstitution } from '@/hooks/useInstitutionRegistry';

interface FormData {
  walletAddress: string;
  universityName: string;
  emailDomain: string;
}

export default function ManageUniversities() {
  const navigate = useNavigate();
  const { isConnected, address: connectedAddress } = useAccount();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>({
    walletAddress: '',
    universityName: '',
    emailDomain: '',
  });

  const [validationErrors, setValidationErrors] = useState<Partial<FormData>>({});
  const [successMessage, setSuccessMessage] = useState<string>('');

  const { registerInstitutionByAdmin, isRegistering, isSuccess: isRegisterSuccess, error: registerError, transactionHash } = useRegisterInstitutionByAdmin();
  const { isRegistered, isLoading: isCheckingRegistration } = useIsInstitution(
    isAddress(formData.walletAddress) ? formData.walletAddress as `0x${string}` : undefined
  );

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle successful registration
  useEffect(() => {
    if (isRegisterSuccess && transactionHash) {
      setSuccessMessage(`University registered and approved successfully!`);
      
      // Invalidate all institution-related queries to force refetch on dashboard
      queryClient.invalidateQueries({ queryKey: ['readContract'] });
      
      // Reset form
      setFormData({
        walletAddress: '',
        universityName: '',
        emailDomain: '',
      });
    }
  }, [isRegisterSuccess, transactionHash, queryClient]);

  const validateForm = (): boolean => {
    const errors: Partial<FormData> = {};

    // Validate wallet address
    if (!formData.walletAddress) {
      errors.walletAddress = 'Wallet address is required';
    } else if (!isAddress(formData.walletAddress)) {
      errors.walletAddress = 'Invalid Ethereum address format';
    } else if (connectedAddress && formData.walletAddress.toLowerCase() === connectedAddress.toLowerCase()) {
      errors.walletAddress = 'Admin cannot register their own wallet as a university';
    }

    // Validate university name
    if (!formData.universityName) {
      errors.universityName = 'University name is required';
    } else if (formData.universityName.length < 3) {
      errors.universityName = 'University name must be at least 3 characters';
    } else if (formData.universityName.length > 100) {
      errors.universityName = 'University name must be less than 100 characters';
    }

    // Validate email domain
    if (!formData.emailDomain) {
      errors.emailDomain = 'Email domain is required';
    } else if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/.test(formData.emailDomain)) {
      errors.emailDomain = 'Invalid email domain format (e.g., university.edu)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (isRegistered) {
      alert('This wallet address is already registered as a university');
      return;
    }

    try {
      await registerInstitutionByAdmin(
        formData.walletAddress as `0x${string}`,
        formData.universityName,
        formData.emailDomain
      );
      // Success will be handled by the useEffect watching isRegisterSuccess
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear validation error for this field
    if (validationErrors[name as keyof FormData]) {
      setValidationErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <svg className="w-20 h-20 mx-auto mb-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-3xl font-bold text-white mb-4">Wallet Not Connected</h1>
          <p className="text-surface-400 mb-8">Please connect your wallet to manage universities.</p>
          <button onClick={() => navigate('/admin/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="text-surface-400 hover:text-white transition-colors mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-white mb-4">Manage Universities</h1>
          <p className="text-surface-400 text-lg">
            Register new universities by adding their wallet addresses
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-green-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {successMessage}
            </p>
          </div>
        )}

        {/* Registration Form */}
        <div className="bg-surface-900 rounded-2xl shadow-2xl p-8 border border-surface-700">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            Register New University
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Wallet Address */}
            <div>
              <label htmlFor="walletAddress" className="block text-sm font-medium text-surface-300 mb-2">
                Wallet Address <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="walletAddress"
                name="walletAddress"
                value={formData.walletAddress}
                onChange={handleInputChange}
                className={`input ${validationErrors.walletAddress ? 'border-red-500' : ''}`}
                placeholder="0x..."
                disabled={isRegistering}
                required
              />
              {validationErrors.walletAddress && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.walletAddress}
                </p>
              )}
              {isCheckingRegistration && (
                <p className="mt-2 text-sm text-surface-400">Checking registration status...</p>
              )}
              {isRegistered && !isCheckingRegistration && (
                <p className="mt-2 text-sm text-yellow-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  This address is already registered
                </p>
              )}
            </div>

            {/* University Name */}
            <div>
              <label htmlFor="universityName" className="block text-sm font-medium text-surface-300 mb-2">
                University Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="universityName"
                name="universityName"
                value={formData.universityName}
                onChange={handleInputChange}
                className={`input ${validationErrors.universityName ? 'border-red-500' : ''}`}
                placeholder="e.g., Stanford University"
                disabled={isRegistering}
                required
              />
              {validationErrors.universityName && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.universityName}
                </p>
              )}
            </div>

            {/* Email Domain */}
            <div>
              <label htmlFor="emailDomain" className="block text-sm font-medium text-surface-300 mb-2">
                Email Domain <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="emailDomain"
                name="emailDomain"
                value={formData.emailDomain}
                onChange={handleInputChange}
                className={`input ${validationErrors.emailDomain ? 'border-red-500' : ''}`}
                placeholder="e.g., stanford.edu"
                disabled={isRegistering}
                required
              />
              {validationErrors.emailDomain && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.emailDomain}
                </p>
              )}
              <p className="mt-2 text-sm text-surface-500">
                The email domain associated with this university (e.g., stanford.edu)
              </p>
            </div>

            {/* Error Display */}
            {registerError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {registerError?.message || 'An error occurred'}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/admin/dashboard')}
                className="btn-secondary flex-1"
                disabled={isRegistering}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={isRegistering || isRegistered}
              >
                {isRegistering ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Registering...
                  </span>
                ) : (
                  'Register University'
                )}
              </button>
            </div>
          </form>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              What happens next?
            </h3>
            <ul className="text-sm text-surface-400 space-y-2 ml-7">
              <li>• The university's wallet will be registered in the system</li>
              <li>• The university will be automatically approved</li>
              <li>• They can then connect their wallet and access university features</li>
              <li>• They'll be able to issue certificates to students</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

