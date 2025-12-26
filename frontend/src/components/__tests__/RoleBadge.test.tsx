// frontend/src/components/__tests__/RoleBadge.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RoleBadge } from '../RoleBadge';

describe('RoleBadge', () => {
  it('renders nothing when role is null', () => {
    const { container } = render(<RoleBadge role={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correct icon and label for each role', () => {
    const roles = ['admin', 'university', 'student', 'employer'] as const;
    const expectedLabels = ['Admin', 'University', 'Student', 'Employer'];
    const expectedIcons = ['🛡️', '🎓', '📜', '🔍'];

    roles.forEach((role, index) => {
      const { unmount } = render(<RoleBadge role={role} />);
      expect(screen.getByText(expectedLabels[index])).toBeInTheDocument();
      expect(screen.getByText(expectedIcons[index])).toBeInTheDocument();
      unmount();
    });
  });

  it('handles click when onClick is provided', () => {
    const handleClick = vi.fn();
    render(<RoleBadge role="admin" onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows dropdown arrow when clickable', () => {
    render(<RoleBadge role="admin" onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<RoleBadge role="admin" size="sm" />);
    expect(screen.getByRole('button')).toHaveClass('text-xs');

    rerender(<RoleBadge role="admin" size="lg" />);
    expect(screen.getByRole('button')).toHaveClass('text-base');
  });

  it('applies disabled styles when disabled prop is true', () => {
    render(<RoleBadge role="admin" disabled={true} />);
    const button = screen.getByRole('button');
    
    expect(button).toHaveClass('opacity-50');
    expect(button).toHaveClass('cursor-not-allowed');
    expect(button).toBeDisabled();
  });

  it('applies grayscale to icon when disabled', () => {
    render(<RoleBadge role="admin" disabled={true} showIcon={true} />);
    const iconSpan = screen.getByText('🛡️');
    expect(iconSpan).toHaveClass('grayscale');
  });

  it('does not show dropdown arrow when disabled', () => {
    render(<RoleBadge role="admin" onClick={() => {}} disabled={true} />);
    const button = screen.getByRole('button');
    expect(button.querySelector('svg')).not.toBeInTheDocument();
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<RoleBadge role="admin" onClick={handleClick} disabled={true} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('hides icon when showIcon is false', () => {
    render(<RoleBadge role="admin" showIcon={false} />);
    expect(screen.queryByText('🛡️')).not.toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('applies enabled styles when not disabled', () => {
    render(<RoleBadge role="admin" disabled={false} />);
    const button = screen.getByRole('button');
    
    expect(button).not.toHaveClass('opacity-50');
    expect(button).not.toHaveClass('cursor-not-allowed');
    expect(button).toHaveClass('bg-red-500/10');
  });
});




