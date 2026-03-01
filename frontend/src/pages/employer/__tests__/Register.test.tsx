import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmployerRegister from '@/pages/employer/Register';

const mockNavigate = vi.fn();
const mockSetRole = vi.fn();
const mockRegisterEmployer = vi.fn();

let mockVatAvailable: boolean | undefined = undefined;
let mockVatLoading = false;

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x1111111111111111111111111111111111111111',
    isConnected: true,
  }),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    setRole: mockSetRole,
  }),
}));

vi.mock('@/hooks/useEmployerRegistry', () => ({
  useEmployerRegistration: () => ({
    registerEmployer: mockRegisterEmployer,
    status: 'not_registered',
    error: null,
    isRegistering: false,
    transactionHash: undefined,
  }),
  useEmployerInfo: () => ({
    employer: undefined,
  }),
  useIsVatAvailable: () => ({
    isAvailable: mockVatAvailable,
    isLoading: mockVatLoading,
  }),
}));

// Keep VAT checks deterministic in tests.
vi.mock('@/lib/utils', () => ({
  debounce: <T extends (...args: any[]) => any>(fn: T) => fn,
}));

describe('EmployerRegister VAT validation messaging', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSetRole.mockReset();
    mockRegisterEmployer.mockReset();
    mockVatAvailable = undefined;
    mockVatLoading = false;
  });

  it('shows explicit uniqueness/admin message when VAT is already registered', () => {
    mockVatAvailable = false;

    render(<EmployerRegister />);

    fireEvent.change(screen.getByLabelText(/VAT Number/i), {
      target: { value: 'GB123456789' },
    });

    expect(
      screen.getByText(/This VAT number is already registered/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/VAT numbers are unique/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Please contact admin at/i)
    ).toBeInTheDocument();
  });

  it('blocks submit and shows validation guidance when VAT is taken', () => {
    mockVatAvailable = false;

    render(<EmployerRegister />);

    fireEvent.change(screen.getByLabelText(/Company Name/i), {
      target: { value: 'Acme Corporation' },
    });
    fireEvent.change(screen.getByLabelText(/VAT Number/i), {
      target: { value: 'GB123456789' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register as Employer' }));

    expect(mockRegisterEmployer).not.toHaveBeenCalled();
    expect(
      screen.getByText(/This VAT number is already registered/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Please contact the admin at/i)
    ).toBeInTheDocument();
  });

  it('submits registration when VAT is available', () => {
    mockVatAvailable = true;

    render(<EmployerRegister />);

    fireEvent.change(screen.getByLabelText(/Company Name/i), {
      target: { value: 'Acme Corporation' },
    });
    fireEvent.change(screen.getByLabelText(/VAT Number/i), {
      target: { value: 'GB123456789' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register as Employer' }));

    expect(mockRegisterEmployer).toHaveBeenCalledTimes(1);
    expect(mockRegisterEmployer).toHaveBeenCalledWith('Acme Corporation', 'GB123456789');
  });
});
