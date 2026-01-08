// frontend/src/test-utils/test-wrapper.tsx
/**
 * Test Utilities
 * ==============
 * 
 * Provides wrapper components and utilities for testing components
 * that require React Router or other context providers.
 */

import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

interface TestWrapperProps {
  children: ReactNode;
  initialEntries?: string[];
}

/**
 * Wraps components with necessary providers for testing
 * Currently provides:
 * - MemoryRouter for components using useNavigate, useLocation, etc.
 */
export function TestWrapper({ children, initialEntries = ['/'] }: TestWrapperProps) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      {children}
    </MemoryRouter>
  );
}

/**
 * Helper to render components with Router context
 * Usage in tests:
 * 
 * import { renderWithRouter } from '@/test-utils/test-wrapper';
 * 
 * renderWithRouter(<MyComponent />);
 */
export function renderWithRouter(ui: ReactNode, initialEntries: string[] = ['/']) {
  return {
    element: (
      <TestWrapper initialEntries={initialEntries}>
        {ui}
      </TestWrapper>
    )
  };
}
