import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UnifiedAuthFlow } from '@/components/UnifiedAuthFlow';

type MockUnifiedAuthState = {
  isAuthenticated: boolean;
  authMethod: 'web3' | 'zk' | null;
  role: 'university' | 'student' | 'employer' | 'admin' | null;
  isLoading: boolean;
  authContextResolving: boolean;
  selectAuthMethod: ReturnType<typeof vi.fn>;
  web3Auth: {
    primaryRole: 'university' | 'student' | 'employer' | 'admin' | null;
    availableRoles: Array<'university' | 'student' | 'employer' | 'admin'>;
    isUniversity: boolean;
    canRegisterAsEmployer: boolean;
  };
  zkAuth: {
    hasCredentials: boolean;
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
  };
};

let mockIsConnected = false;
let mockUnifiedAuth: MockUnifiedAuthState;
const mockSetAuthMethod = vi.fn();
const mockSetPreSelectedRole = vi.fn();
const mockSetShowAuthMethodSelector = vi.fn();
const mockNavigate = vi.fn();

vi.mock('wagmi', () => ({
  useAccount: () => ({
    isConnected: mockIsConnected,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useUnifiedAuth', () => ({
  useUnifiedAuth: () => mockUnifiedAuth,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    setAuthMethod: mockSetAuthMethod,
    setPreSelectedRole: mockSetPreSelectedRole,
    setShowAuthMethodSelector: mockSetShowAuthMethodSelector,
  }),
}));

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <button type="button">Connect Wallet</button>,
}));

vi.mock('@/lib/adminContact', () => ({
  ADMIN_CONTACT_EMAIL: 'admin@example.com',
}));

describe('UnifiedAuthFlow Web3 completion guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSetAuthMethod.mockReset();
    mockSetPreSelectedRole.mockReset();
    mockSetShowAuthMethodSelector.mockReset();
    mockNavigate.mockReset();

    mockIsConnected = false;
    mockUnifiedAuth = {
      isAuthenticated: false,
      authMethod: null,
      role: null,
      isLoading: false,
      authContextResolving: false,
      selectAuthMethod: vi.fn(),
      web3Auth: {
        primaryRole: null,
        availableRoles: [],
        isUniversity: false,
        canRegisterAsEmployer: false,
      },
      zkAuth: {
        hasCredentials: false,
        register: vi.fn(),
        login: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not complete while Web3 auth is unresolved, then completes exactly once when resolved', () => {
    const onComplete = vi.fn();

    const { rerender } = render(
      <UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} />
    );

    fireEvent.click(screen.getByText('Standard Wallet Login'));
    expect(mockUnifiedAuth.selectAuthMethod).toHaveBeenCalledWith('web3', true);

    // Unresolved Web3 state: wallet connected alone must NOT complete flow.
    mockIsConnected = true;
    mockUnifiedAuth.authMethod = 'web3';
    mockUnifiedAuth.isAuthenticated = false;
    mockUnifiedAuth.role = null;
    rerender(<UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).not.toHaveBeenCalled();

    // Resolved Web3 state: authenticated + role set should complete once.
    mockUnifiedAuth.isAuthenticated = true;
    mockUnifiedAuth.role = 'university';
    rerender(<UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);

    // Re-rendering with same resolved state must not trigger duplicate completion.
    rerender(<UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows admin-contact warning for unregistered university wallet', () => {
    const { rerender } = render(
      <UnifiedAuthFlow preSelectedRole="university" />
    );

    fireEvent.click(screen.getByText('Standard Wallet Login'));

    mockIsConnected = true;
    mockUnifiedAuth.authMethod = 'web3';
    mockUnifiedAuth.isAuthenticated = false;
    mockUnifiedAuth.role = null;
    mockUnifiedAuth.isLoading = false;
    mockUnifiedAuth.authContextResolving = false;
    mockUnifiedAuth.web3Auth = {
      primaryRole: null,
      availableRoles: [],
      isUniversity: false,
      canRegisterAsEmployer: false,
    };

    rerender(<UnifiedAuthFlow preSelectedRole="university" />);

    expect(
      screen.getByText('This wallet is not registered as a university by an admin.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Contact admin: admin@example.com')
    ).toBeInTheDocument();
  });

  it('replaces cancel with proceed-as-employer action for unregistered university wallet', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByText('Standard Wallet Login'));

    mockIsConnected = true;
    mockUnifiedAuth.authMethod = 'web3';
    mockUnifiedAuth.isAuthenticated = false;
    mockUnifiedAuth.role = null;
    mockUnifiedAuth.isLoading = false;
    mockUnifiedAuth.authContextResolving = false;
    mockUnifiedAuth.web3Auth = {
      primaryRole: null,
      availableRoles: [],
      isUniversity: false,
      canRegisterAsEmployer: false,
    };

    rerender(<UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Proceed with Employer Role'));

    expect(mockSetAuthMethod).toHaveBeenCalledWith(null);
    expect(mockSetPreSelectedRole).toHaveBeenCalledWith('employer');
    expect(mockSetShowAuthMethodSelector).toHaveBeenCalledWith(false);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText('Step 2: Choose Your Login Method')).toBeInTheDocument();
  });

  it('continues in-flow when proceeding as employer and selecting private login', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByText('Standard Wallet Login'));

    mockIsConnected = true;
    mockUnifiedAuth.authMethod = 'web3';
    mockUnifiedAuth.isAuthenticated = false;
    mockUnifiedAuth.role = null;
    mockUnifiedAuth.isLoading = false;
    mockUnifiedAuth.authContextResolving = false;
    mockUnifiedAuth.web3Auth = {
      primaryRole: null,
      availableRoles: [],
      isUniversity: false,
      canRegisterAsEmployer: false,
    };

    rerender(<UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Proceed with Employer Role'));
    expect(screen.getByText('Step 2: Choose Your Login Method')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Private Login (ZK Proof)'));

    expect(mockUnifiedAuth.selectAuthMethod).toHaveBeenCalledWith('zk', true);
    expect(screen.getByText('Step 3: Connect Wallet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('continues in-flow when proceeding as employer and selecting standard wallet login', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByText('Standard Wallet Login'));

    mockIsConnected = true;
    mockUnifiedAuth.authMethod = 'web3';
    mockUnifiedAuth.isAuthenticated = false;
    mockUnifiedAuth.role = null;
    mockUnifiedAuth.isLoading = false;
    mockUnifiedAuth.authContextResolving = false;
    mockUnifiedAuth.web3Auth = {
      primaryRole: null,
      availableRoles: [],
      isUniversity: false,
      canRegisterAsEmployer: false,
    };

    rerender(<UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Proceed with Employer Role'));
    expect(screen.getByText('Step 2: Choose Your Login Method')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Standard Wallet Login'));

    expect(mockUnifiedAuth.selectAuthMethod).toHaveBeenCalledWith('web3', true);
    expect(screen.getByText('Step 3: Connect Wallet')).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).not.toHaveBeenCalled();

    // Complete only after Web3 auth resolves for employer role.
    mockUnifiedAuth.isAuthenticated = true;
    mockUnifiedAuth.role = 'employer';
    mockUnifiedAuth.web3Auth = {
      primaryRole: 'employer',
      availableRoles: ['employer'],
      isUniversity: false,
      canRegisterAsEmployer: false,
    };
    rerender(<UnifiedAuthFlow preSelectedRole="university" onComplete={onComplete} onCancel={onCancel} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('offers employer registration and navigates when employer web3 role is missing', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <UnifiedAuthFlow preSelectedRole="employer" onCancel={onCancel} />
    );

    fireEvent.click(screen.getByText('Standard Wallet Login'));

    mockIsConnected = true;
    mockUnifiedAuth.authMethod = 'web3';
    mockUnifiedAuth.isAuthenticated = false;
    mockUnifiedAuth.role = null;
    mockUnifiedAuth.isLoading = false;
    mockUnifiedAuth.authContextResolving = false;
    mockUnifiedAuth.web3Auth = {
      primaryRole: null,
      availableRoles: [],
      isUniversity: false,
      canRegisterAsEmployer: true,
    };

    rerender(<UnifiedAuthFlow preSelectedRole="employer" onCancel={onCancel} />);

    expect(
      screen.getByText('This wallet is not registered as an employer yet.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Register as Employer'));

    expect(mockSetPreSelectedRole).toHaveBeenCalledWith('employer');
    expect(mockSetShowAuthMethodSelector).toHaveBeenCalledWith(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/employer/register');
  });

  it('still offers employer registration when no roles are detected and eligibility flag is false', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <UnifiedAuthFlow preSelectedRole="employer" onCancel={onCancel} />
    );

    fireEvent.click(screen.getByText('Standard Wallet Login'));

    mockIsConnected = true;
    mockUnifiedAuth.authMethod = null;
    mockUnifiedAuth.isAuthenticated = false;
    mockUnifiedAuth.role = null;
    mockUnifiedAuth.isLoading = false;
    mockUnifiedAuth.authContextResolving = false;
    mockUnifiedAuth.web3Auth = {
      primaryRole: null,
      availableRoles: [],
      isUniversity: false,
      canRegisterAsEmployer: false,
    };

    rerender(<UnifiedAuthFlow preSelectedRole="employer" onCancel={onCancel} />);

    expect(
      screen.getByText('This wallet is not registered as an employer yet.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Register as Employer'));

    expect(mockSetPreSelectedRole).toHaveBeenCalledWith('employer');
    expect(mockSetShowAuthMethodSelector).toHaveBeenCalledWith(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/employer/register');
  });

  it('does not show completion success when detected web3 role mismatches selected role', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <UnifiedAuthFlow preSelectedRole="student" onComplete={onComplete} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByText('Standard Wallet Login'));

    mockIsConnected = true;
    mockUnifiedAuth.authMethod = 'web3';
    mockUnifiedAuth.isAuthenticated = true;
    mockUnifiedAuth.role = 'employer';
    mockUnifiedAuth.isLoading = false;
    mockUnifiedAuth.authContextResolving = false;
    mockUnifiedAuth.web3Auth = {
      primaryRole: 'employer',
      availableRoles: ['employer'],
      isUniversity: false,
      canRegisterAsEmployer: false,
    };

    rerender(<UnifiedAuthFlow preSelectedRole="student" onComplete={onComplete} onCancel={onCancel} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === 'This wallet is registered as employer, not student.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Continue as Employer Role'));
    expect(mockSetPreSelectedRole).toHaveBeenCalledWith('employer');
    expect(mockSetAuthMethod).toHaveBeenCalledWith(null);
    expect(screen.getByText('Step 2: Choose Your Login Method')).toBeInTheDocument();
  });

  it('shows private-login role mismatch guidance and keeps flow incomplete', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <UnifiedAuthFlow preSelectedRole="student" onComplete={onComplete} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByText('Private Login (ZK Proof)'));

    mockIsConnected = true;
    mockUnifiedAuth.authMethod = 'zk';
    mockUnifiedAuth.isAuthenticated = true;
    mockUnifiedAuth.role = 'employer';
    mockUnifiedAuth.isLoading = false;
    mockUnifiedAuth.authContextResolving = false;
    mockUnifiedAuth.web3Auth = {
      primaryRole: 'employer',
      availableRoles: ['employer'],
      isUniversity: false,
      canRegisterAsEmployer: false,
    };

    rerender(<UnifiedAuthFlow preSelectedRole="student" onComplete={onComplete} onCancel={onCancel} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === 'This wallet is registered as employer, not student.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Continue as Employer Role'));
    expect(mockSetPreSelectedRole).toHaveBeenCalledWith('employer');
    expect(mockSetAuthMethod).toHaveBeenCalledWith(null);
    expect(screen.getByText('Step 2: Choose Your Login Method')).toBeInTheDocument();
  });

  it('shows inverse private-login role mismatch guidance (employer selected, student wallet)', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <UnifiedAuthFlow preSelectedRole="employer" onComplete={onComplete} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByText('Private Login (ZK Proof)'));

    mockIsConnected = true;
    mockUnifiedAuth.authMethod = 'zk';
    mockUnifiedAuth.isAuthenticated = true;
    mockUnifiedAuth.role = 'student';
    mockUnifiedAuth.isLoading = false;
    mockUnifiedAuth.authContextResolving = false;
    mockUnifiedAuth.web3Auth = {
      primaryRole: 'student',
      availableRoles: ['student'],
      isUniversity: false,
      canRegisterAsEmployer: false,
    };

    rerender(<UnifiedAuthFlow preSelectedRole="employer" onComplete={onComplete} onCancel={onCancel} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === 'This wallet is registered as student, not employer.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Continue as Student Role'));
    expect(mockSetPreSelectedRole).toHaveBeenCalledWith('student');
    expect(mockSetAuthMethod).toHaveBeenCalledWith(null);
    expect(screen.getByText('Step 2: Choose Your Login Method')).toBeInTheDocument();
  });
});
