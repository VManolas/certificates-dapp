/**
 * @fileoverview Employer-related type definitions
 * @module types/employer
 */

/**
 * Employer data structure as stored in the EmployerRegistry contract
 */
export interface Employer {
  walletAddress: string;
  companyName: string;
  vatNumber: string;
  registrationDate: bigint;
  isActive: boolean;
}

/**
 * Form data for employer registration
 */
export interface EmployerRegistrationForm {
  companyName: string;
  vatNumber: string;
}

/**
 * Employer registration validation rules
 */
export const EMPLOYER_VALIDATION = {
  companyName: {
    minLength: 2,
    maxLength: 100,
    required: true,
  },
  vatNumber: {
    minLength: 5,
    maxLength: 20,
    required: true,
    // Common VAT format pattern (flexible for international use)
    pattern: /^[A-Z0-9-]+$/i,
  },
} as const;

/**
 * Employer registration status
 */
export type EmployerRegistrationStatus = 
  | 'idle'
  | 'checking'
  | 'not_registered'
  | 'registered'
  | 'registering'
  | 'error';

