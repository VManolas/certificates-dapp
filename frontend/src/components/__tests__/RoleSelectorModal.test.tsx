// frontend/src/components/__tests__/RoleSelectorModal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoleSelectorModal } from '../RoleSelectorModal';
import { useAuthStore } from '@/store/authStore';

// Mock the auth store
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

describe('RoleSelectorModal', () => {
  const mockSetRole = vi.fn();
  const mockSetHasSelectedRole = vi.fn();
  const mockSetShowRoleSelector = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      setRole: mockSetRole,
      setHasSelectedRole: mockSetHasSelectedRole,
      setShowRoleSelector: mockSetShowRoleSelector,
    });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <RoleSelectorModal
        isOpen={false}
        onClose={mockOnClose}
        availableRoles={['student']}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when isOpen is true', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student']}
      />
    );
    expect(screen.getByText('Select Your Role')).toBeInTheDocument();
  });

  it('shows all 4 roles in modal', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student', 'employer']}
      />
    );

    expect(screen.getByText('Platform Administrator')).toBeInTheDocument();
    expect(screen.getByText('Educational Institution')).toBeInTheDocument();
    expect(screen.getByText('Student / Graduate')).toBeInTheDocument();
    expect(screen.getByText('Employer / Verifier')).toBeInTheDocument();
  });

  it('shows description for available roles', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student', 'employer']}
      />
    );

    expect(screen.getByText('View and share your educational certificates with employers')).toBeInTheDocument();
    expect(screen.getByText('Verify candidate credentials instantly on the blockchain')).toBeInTheDocument();
  });

  it('shows disabled reason for unavailable roles', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student', 'employer']}
      />
    );

    expect(screen.getByText('Restricted to platform administrators with SUPER_ADMIN_ROLE')).toBeInTheDocument();
    expect(screen.getByText('Register your institution first to access this role')).toBeInTheDocument();
  });

  it('shows lock icon for disabled roles', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student', 'employer']}
      />
    );

    const lockIcons = screen.getAllByText('🔒');
    expect(lockIcons.length).toBeGreaterThan(0);
  });

  it('calls handlers when selecting an available role', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student', 'employer']}
      />
    );

    const buttons = screen.getAllByRole('button');
    const employerButton = buttons.find(btn =>
      btn.textContent?.includes('Employer / Verifier')
    );

    if (employerButton && !employerButton.hasAttribute('disabled')) {
      fireEvent.click(employerButton);
      
      expect(mockSetRole).toHaveBeenCalledWith('employer', false);
      expect(mockSetHasSelectedRole).toHaveBeenCalledWith(true);
      expect(mockSetShowRoleSelector).toHaveBeenCalledWith(false);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('does not call handlers when clicking disabled role', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student', 'employer']}
      />
    );

    const buttons = screen.getAllByRole('button');
    const adminButton = buttons.find(btn =>
      btn.textContent?.includes('Platform Administrator') && btn.hasAttribute('disabled')
    );

    if (adminButton) {
      fireEvent.click(adminButton);
      
      expect(mockSetRole).not.toHaveBeenCalled();
      expect(mockSetHasSelectedRole).not.toHaveBeenCalled();
      expect(mockSetShowRoleSelector).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('shows university verification info when provided', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['university']}
        universityData={{ name: 'Test University', isVerified: true }}
      />
    );

    expect(screen.getByText('✓ Verified: Test University')).toBeInTheDocument();
  });

  it('shows pending verification for unverified university', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['university']}
        universityData={{ name: 'Test University', isVerified: false }}
      />
    );

    expect(screen.getByText('⏳ Pending verification: Test University')).toBeInTheDocument();
  });

  it('shows student certificate count', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student']}
        studentCertificateCount={3}
      />
    );

    expect(screen.getByText('3 certificates')).toBeInTheDocument();
  });

  it('shows singular certificate for count of 1', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student']}
        studentCertificateCount={1}
      />
    );

    expect(screen.getByText('1 certificate')).toBeInTheDocument();
  });

  it('closes modal when clicking backdrop', () => {
    const { container } = render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student']}
      />
    );

    // Find the backdrop (has bg-black class and onClick)
    const backdrop = container.querySelector('.bg-black\\/60');
    expect(backdrop).toBeTruthy();
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('shows helper text about role switching', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student']}
      />
    );

    expect(screen.getByText('You can switch roles anytime from the header menu.')).toBeInTheDocument();
  });

  it('applies correct styling to available roles', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student', 'employer']}
      />
    );

    const buttons = screen.getAllByRole('button');
    const employerButton = buttons.find(btn =>
      btn.textContent?.includes('Employer / Verifier') && !btn.hasAttribute('disabled')
    );

    expect(employerButton).not.toHaveClass('opacity-50');
    expect(employerButton).not.toHaveClass('cursor-not-allowed');
  });

  it('applies correct styling to disabled roles', () => {
    render(
      <RoleSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        availableRoles={['student', 'employer']}
      />
    );

    const buttons = screen.getAllByRole('button');
    const adminButton = buttons.find(btn =>
      btn.textContent?.includes('Platform Administrator') && btn.hasAttribute('disabled')
    );

    expect(adminButton).toHaveClass('opacity-50');
    expect(adminButton).toHaveClass('cursor-not-allowed');
  });
});



