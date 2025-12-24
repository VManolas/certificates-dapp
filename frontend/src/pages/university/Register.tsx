// src/pages/university/Register.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useRegisterInstitution } from '@/hooks/useInstitutionRegistry';
import { useAuthStore } from '@/store/authStore';

interface FormData {
  name: string;
  emailDomain: string;
}

interface FormErrors {
  name?: string;
  emailDomain?: string;
}

export function UniversityRegister() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { institutionData, refetchInstitution } = useAuthStore();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    emailDomain: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isFormValid, setIsFormValid] = useState(false);

  const {
    registerInstitution,
    isPending,
    isConfirming,
    isSuccess,
    error: transactionError,
    transactionHash,
    reset,
  } = useRegisterInstitution();

  // Redirect if already registered
  useEffect(() => {
    if (institutionData?.isVerified || institutionData?.isActive) {
      navigate('/university/dashboard');
    }
  }, [institutionData, navigate]);

  // Redirect on successful registration
  useEffect(() => {
    if (isSuccess) {
      refetchInstitution?.();
      setTimeout(() => {
        navigate('/university/dashboard');
      }, 2000);
    }
  }, [isSuccess, navigate, refetchInstitution]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Institution name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Name must be less than 100 characters';
    }

    // Email domain validation
    if (!formData.emailDomain.trim()) {
      newErrors.emailDomain = 'Email domain is required';
    } else {
      const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;
      if (!domainRegex.test(formData.emailDomain.trim())) {
        newErrors.emailDomain = 'Invalid domain format (e.g., "university.edu")';
      }
    }

    setErrors(newErrors);
    const valid = Object.keys(newErrors).length === 0;
    setIsFormValid(valid);
    return valid;
  };

  // Validate on change
  useEffect(() => {
    if (formData.name || formData.emailDomain) {
      validateForm();
    }
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      registerInstitution(formData);
    } catch (err) {
      console.error('Registration error:', err);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="card text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-surface-400">Please connect your wallet to register your institution.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Register Your Institution</h1>
        <p className="text-surface-400">
          Join the zkCredentials network and start issuing verifiable credentials
        </p>
      </div>

      {/* Success State */}
      {isSuccess && (
        <div className="card border-success-500/50 bg-success-500/10 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-success-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-success-400 mb-1">
                Registration Successful!
              </h3>
              <p className="text-surface-300 text-sm mb-2">
                Your institution has been registered on the blockchain.
              </p>
              {transactionHash && (
                <a
                  href={`https://sepolia.explorer.zksync.io/tx/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300 text-sm inline-flex items-center gap-1"
                >
                  View transaction
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              <p className="text-surface-400 text-sm mt-2">
                Redirecting to dashboard...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {transactionError && (
        <div className="card border-error-500/50 bg-error-500/10 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-error-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-error-400 mb-1">Registration Failed</h3>
              <p className="text-surface-300 text-sm">
                {transactionError.message || 'An error occurred during registration'}
              </p>
              <button
                onClick={reset}
                className="mt-3 text-sm text-primary-400 hover:text-primary-300"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="card">
        <div className="space-y-6">
          {/* Institution Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-surface-200 mb-2">
              Institution Name <span className="text-error-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`input ${errors.name ? 'border-error-500 focus:border-error-500' : ''}`}
              placeholder="e.g., Massachusetts Institute of Technology"
              disabled={isPending || isConfirming || isSuccess}
              maxLength={100}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-error-400">{errors.name}</p>
            )}
            <p className="mt-1 text-xs text-surface-500">
              Official name of your educational institution
            </p>
          </div>

          {/* Email Domain */}
          <div>
            <label htmlFor="emailDomain" className="block text-sm font-medium text-surface-200 mb-2">
              Email Domain <span className="text-error-400">*</span>
            </label>
            <input
              id="emailDomain"
              type="text"
              value={formData.emailDomain}
              onChange={(e) => handleChange('emailDomain', e.target.value)}
              className={`input ${errors.emailDomain ? 'border-error-500 focus:border-error-500' : ''}`}
              placeholder="e.g., mit.edu"
              disabled={isPending || isConfirming || isSuccess}
            />
            {errors.emailDomain && (
              <p className="mt-1 text-sm text-error-400">{errors.emailDomain}</p>
            )}
            <p className="mt-1 text-xs text-surface-500">
              Your institution's official email domain (without @)
            </p>
          </div>

          {/* Connected Wallet */}
          <div className="rounded-lg bg-surface-800/50 p-4 border border-surface-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-400 mb-1">Registering Wallet</p>
                <p className="text-white font-mono text-sm">{address}</p>
              </div>
              <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <p className="text-xs text-surface-500 mt-2">
              This wallet will be authorized to issue certificates for your institution
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn-secondary flex-1"
              disabled={isPending || isConfirming}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={!isFormValid || isPending || isConfirming || isSuccess}
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Waiting for signature...
                </>
              ) : isConfirming ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Confirming on blockchain...
                </>
              ) : (
                'Register Institution'
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Info Section */}
      <div className="mt-8 card bg-surface-800/30">
        <h3 className="text-lg font-semibold text-white mb-3">What happens next?</h3>
        <ul className="space-y-2 text-sm text-surface-300">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Your institution will be registered on the blockchain immediately</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>You can start issuing certificates right away</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>All certificates will be cryptographically verifiable</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default UniversityRegister;
