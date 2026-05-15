// frontend/src/components/__tests__/ErrorBoundary.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary, FeatureErrorFallback } from '../ErrorBoundary';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Component that throws an error
function BuggyComponent({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error from buggy component');
  }
  return <div>Working component</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console errors in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <BuggyComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Working component')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should catch and display error', () => {
      render(
        <ErrorBoundary>
          <BuggyComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error from buggy component')).toBeInTheDocument();
    });

    it('should call onError callback when error occurs', () => {
      const onError = vi.fn();
      
      render(
        <ErrorBoundary onError={onError}>
          <BuggyComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
    });

    it('should render custom fallback when provided', () => {
      const customFallback = <div>Custom Error UI</div>;
      
      render(
        <ErrorBoundary fallback={customFallback}>
          <BuggyComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    });
  });

  describe('Recovery Options', () => {
    it('should have Try Again button', () => {
      render(
        <ErrorBoundary>
          <BuggyComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should have Reload Page button', () => {
      render(
        <ErrorBoundary>
          <BuggyComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });

    it('keeps fallback visible if underlying error persists after Try Again', () => {
      render(
        <ErrorBoundary>
          <BuggyComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error UI should be shown
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Click Try Again
      fireEvent.click(screen.getByText('Try Again'));

      // Component still throws, so fallback remains visible
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Development Mode', () => {
    it('should show component stack in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <BuggyComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Stack')).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Reset Keys', () => {
    it('should reset error when resetKeys change', () => {
      const { rerender } = render(
        <ErrorBoundary resetKeys={['key1']}>
          <BuggyComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error should be shown
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Change reset keys
      rerender(
        <ErrorBoundary resetKeys={['key2']}>
          <BuggyComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      // Component should recover
      expect(screen.getByText('Working component')).toBeInTheDocument();
    });
  });
});

describe('FeatureErrorFallback', () => {
  it('should render with default props', () => {
    render(<FeatureErrorFallback />);

    expect(screen.getByText('Feature Error')).toBeInTheDocument();
    expect(screen.getByText('This feature encountered an error')).toBeInTheDocument();
  });

  it('should render with custom props', () => {
    render(
      <FeatureErrorFallback 
        title="Custom Error"
        message="Custom error message"
      />
    );

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should show retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    
    render(<FeatureErrorFallback onRetry={onRetry} />);

    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it('should not show retry button when onRetry is not provided', () => {
    render(<FeatureErrorFallback />);

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });
});
