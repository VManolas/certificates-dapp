import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RouteGuard } from '@/components/RouteGuard';

const mockNavigate = vi.fn();

let mockAccountState = { isConnected: false };
let mockUnifiedAuthState = {
  isAuthenticated: false,
  role: null as 'admin' | 'university' | 'student' | 'employer' | null,
  authMethod: null as 'web3' | 'zk' | null,
  isLoading: false,
};

vi.mock('wagmi', () => ({
  useAccount: () => mockAccountState,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useUnifiedAuth', () => ({
  useUnifiedAuth: () => mockUnifiedAuthState,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountState = { isConnected: false };
    mockUnifiedAuthState = {
      isAuthenticated: false,
      role: null,
      authMethod: null,
      isLoading: false,
    };
  });

  it('renders loading state while auth is resolving', () => {
    mockUnifiedAuthState.isLoading = true;

    render(
      <RouteGuard requiredRole="employer">
        <div>Protected content</div>
      </RouteGuard>
    );

    expect(screen.getByText('Verifying credentials...')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects to home when wallet is disconnected', async () => {
    render(
      <RouteGuard requiredRole="employer">
        <div>Protected content</div>
      </RouteGuard>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated connected users', async () => {
    mockAccountState = { isConnected: true };

    render(
      <RouteGuard requiredRole="employer">
        <div>Protected content</div>
      </RouteGuard>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('redirects to access denied when role is not authorized', async () => {
    mockAccountState = { isConnected: true };
    mockUnifiedAuthState = {
      isAuthenticated: true,
      role: 'student',
      authMethod: 'zk',
      isLoading: false,
    };

    render(
      <RouteGuard requiredRole="employer">
        <div>Protected content</div>
      </RouteGuard>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/access-denied', {
        replace: true,
        state: { from: window.location.pathname },
      });
    });
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders children for authorized Web3 users', () => {
    mockAccountState = { isConnected: true };
    mockUnifiedAuthState = {
      isAuthenticated: true,
      role: 'employer',
      authMethod: 'web3',
      isLoading: false,
    };

    render(
      <RouteGuard requiredRole="employer">
        <div>Protected content</div>
      </RouteGuard>
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders children for authorized ZK users', () => {
    mockAccountState = { isConnected: true };
    mockUnifiedAuthState = {
      isAuthenticated: true,
      role: 'student',
      authMethod: 'zk',
      isLoading: false,
    };

    render(
      <RouteGuard requiredRole="student">
        <div>Protected content</div>
      </RouteGuard>
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
