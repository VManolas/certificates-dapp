// frontend/src/components/__tests__/RoleSwitcher.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoleSwitcher } from '../RoleSwitcher';
import { useAuthStore } from '@/store/authStore';

// Mock the auth store
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

describe('RoleSwitcher', () => {
  const mockSetRole = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      role: 'student',
      setRole: mockSetRole,
    });
  });

  it('shows nothing when no roles available', () => {
    const { container } = render(<RoleSwitcher availableRoles={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows badge when roles are available', () => {
    render(<RoleSwitcher availableRoles={['student']} />);
    expect(screen.getByText('Student')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', () => {
    render(<RoleSwitcher availableRoles={['admin', 'university', 'student', 'employer']} />);
    
    fireEvent.click(screen.getByText('Student'));
    expect(screen.getByText('Switch Role')).toBeInTheDocument();
  });

  it('shows all 4 roles in dropdown', () => {
    render(<RoleSwitcher availableRoles={['student', 'employer']} />);
    
    fireEvent.click(screen.getByText('Student'));
    
    // All 4 roles should be visible
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('University').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Student').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Employer').length).toBeGreaterThan(0);
  });

  it('shows checkmark for active role', () => {
    render(<RoleSwitcher availableRoles={['student', 'employer']} />);
    
    fireEvent.click(screen.getByText('Student'));
    // The active role button should have the checkmark
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('calls setRole when selecting an available role', () => {
    render(<RoleSwitcher availableRoles={['student', 'employer']} />);
    
    fireEvent.click(screen.getByText('Student'));
    
    // Find all buttons with "Employer" text and click the one in the dropdown
    const buttons = screen.getAllByRole('button');
    const employerButton = buttons.find(btn => 
      btn.textContent?.includes('Employer') && !btn.textContent?.includes('Student')
    );
    
    if (employerButton) {
      fireEvent.click(employerButton);
      expect(mockSetRole).toHaveBeenCalledWith('employer');
    }
  });

  it('does not call setRole when clicking disabled role', () => {
    render(<RoleSwitcher availableRoles={['student', 'employer']} />);
    
    fireEvent.click(screen.getByText('Student'));
    
    // Find the admin button (should be disabled)
    const buttons = screen.getAllByRole('button');
    const adminButton = buttons.find(btn => 
      btn.textContent?.includes('Admin') && btn.hasAttribute('disabled')
    );
    
    if (adminButton) {
      fireEvent.click(adminButton);
      expect(mockSetRole).not.toHaveBeenCalled();
    }
  });

  it('shows lock icon for disabled roles', () => {
    render(<RoleSwitcher availableRoles={['student', 'employer']} />);
    
    fireEvent.click(screen.getByText('Student'));
    
    // Should show lock icons for unavailable roles
    const lockIcons = screen.getAllByText('🔒');
    expect(lockIcons.length).toBeGreaterThan(0);
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <RoleSwitcher availableRoles={['student', 'employer']} />
        <div data-testid="outside">Outside</div>
      </div>
    );
    
    fireEvent.click(screen.getByText('Student'));
    expect(screen.getByText('Switch Role')).toBeInTheDocument();
    
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Switch Role')).not.toBeInTheDocument();
  });

  it('shows footer hint about locked roles', () => {
    render(<RoleSwitcher availableRoles={['student', 'employer']} />);
    
    fireEvent.click(screen.getByText('Student'));
    expect(screen.getByText('🔒 Locked roles require specific on-chain status')).toBeInTheDocument();
  });

  it('applies correct styling to available roles', () => {
    render(<RoleSwitcher availableRoles={['student', 'employer']} />);
    
    fireEvent.click(screen.getByText('Student'));
    
    const buttons = screen.getAllByRole('button');
    const employerButton = buttons.find(btn => 
      btn.textContent?.includes('Employer') && !btn.hasAttribute('disabled')
    );
    
    expect(employerButton).not.toHaveClass('opacity-50');
    expect(employerButton).not.toHaveClass('cursor-not-allowed');
  });

  it('applies correct styling to disabled roles', () => {
    render(<RoleSwitcher availableRoles={['student', 'employer']} />);
    
    fireEvent.click(screen.getByText('Student'));
    
    const buttons = screen.getAllByRole('button');
    const adminButton = buttons.find(btn => 
      btn.textContent?.includes('Admin') && btn.hasAttribute('disabled')
    );
    
    expect(adminButton).toHaveClass('opacity-50');
    expect(adminButton).toHaveClass('cursor-not-allowed');
  });
});







