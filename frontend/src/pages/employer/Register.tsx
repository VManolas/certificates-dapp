/**
 * @fileoverview Employer Registration Page
 * @module pages/employer/Register
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useEmployerRegistration, useEmployerInfo } from '@/hooks/useEmployerRegistry';
import { useAuthStore } from '@/store/authStore';
import { EMPLOYER_VALIDATION, type EmployerRegistrationForm } from '@/types/employer';

export default function EmployerRegister() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { setRole } = useAuthStore();
  
  const [formData, setFormData] = useState<EmployerRegistrationForm>({
    companyName: '',
    vatNumber: '',
  });
  
  const [validationErrors, setValidationErrors] = useState<Partial<EmployerRegistrationForm>>({});

  const { registerEmployer, status, error, isRegistering, transactionHash } = useEmployerRegistration();
  const { employer } = useEmployerInfo(address);

  // Redirect if already registered
  useEffect(() => {
    if (employer && employer.isActive) {
      setRole('employer');
      navigate('/employer/dashboard');
    }
  }, [employer, setRole, navigate]);

  const validateForm = (): boolean => {
    const errors: Partial<EmployerRegistrationForm> = {};

    // Validate company name
    if (!formData.companyName) {
      errors.companyName = 'Company name is required';
    } else if (formData.companyName.length < EMPLOYER_VALIDATION.companyName.minLength) {
      errors.companyName = `Minimum ${EMPLOYER_VALIDATION.companyName.minLength} characters required`;
    } else if (formData.companyName.length > EMPLOYER_VALIDATION.companyName.maxLength) {
      errors.companyName = `Maximum ${EMPLOYER_VALIDATION.companyName.maxLength} characters allowed`;
    }

    // Validate VAT number
    if (!formData.vatNumber) {
      errors.vatNumber = 'VAT number is required';
    } else if (formData.vatNumber.length < EMPLOYER_VALIDATION.vatNumber.minLength) {
      errors.vatNumber = `Minimum ${EMPLOYER_VALIDATION.vatNumber.minLength} characters required`;
    } else if (formData.vatNumber.length > EMPLOYER_VALIDATION.vatNumber.maxLength) {
      errors.vatNumber = `Maximum ${EMPLOYER_VALIDATION.vatNumber.maxLength} characters allowed`;
    } else if (!EMPLOYER_VALIDATION.vatNumber.pattern.test(formData.vatNumber)) {
      errors.vatNumber = 'VAT number can only contain letters, numbers, and hyphens';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !address) {
      alert('Please connect your wallet first');
      return;
    }

    if (!validateForm()) {
      return;
    }

    await registerEmployer(formData.companyName, formData.vatNumber);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear validation error for this field
    if (validationErrors[name as keyof EmployerRegistrationForm]) {
      setValidationErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  // Show success and redirect after successful registration
  useEffect(() => {
    if (status === 'registered' && transactionHash) {
      setTimeout(() => {
        setRole('employer');
        navigate('/employer/dashboard');
      }, 2000);
    }
  }, [status, transactionHash, setRole, navigate]);

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <svg className="w-20 h-20 mx-auto mb-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-3xl font-bold text-white mb-4">Wallet Not Connected</h1>
          <p className="text-surface-400 mb-8">Please connect your wallet to register as an employer.</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Register as Employer</h1>
          <p className="text-surface-400 text-lg">
            Register your company to verify student credentials and certificates
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-surface-900 rounded-2xl shadow-2xl p-8 border border-surface-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-surface-300 mb-2">
                Company Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                className={`input ${validationErrors.companyName ? 'border-red-500' : ''}`}
                placeholder="e.g., Acme Corporation"
                disabled={isRegistering}
                required
              />
              {validationErrors.companyName && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.companyName}
                </p>
              )}
            </div>

            {/* VAT Number */}
            <div>
              <label htmlFor="vatNumber" className="block text-sm font-medium text-surface-300 mb-2">
                VAT Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="vatNumber"
                name="vatNumber"
                value={formData.vatNumber}
                onChange={handleInputChange}
                className={`input ${validationErrors.vatNumber ? 'border-red-500' : ''}`}
                placeholder="e.g., GB123456789"
                disabled={isRegistering}
                required
              />
              {validationErrors.vatNumber && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.vatNumber}
                </p>
              )}
              <p className="mt-2 text-sm text-surface-500">
                Your company's VAT identification number
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </p>
              </div>
            )}

            {/* Success Display */}
            {status === 'registered' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Registration successful! Redirecting to dashboard...
                </p>
                {transactionHash && (
                  <p className="text-surface-400 text-xs mt-2 font-mono truncate">
                    Transaction: {transactionHash}
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="btn-secondary flex-1"
                disabled={isRegistering}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={isRegistering}
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
                  'Register as Employer'
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
              <li>• Your registration will be submitted to the blockchain</li>
              <li>• You'll be able to verify student certificates</li>
              <li>• Access batch verification tools</li>
              <li>• Track verification history</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

