// Accessibility utilities and helpers

/**
 * Focus management utilities for keyboard navigation
 */

// Trap focus within a modal or dialog
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleTabKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable?.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable?.focus();
        e.preventDefault();
      }
    }
  }

  element.addEventListener('keydown', handleTabKey);
  firstFocusable?.focus();

  return () => {
    element.removeEventListener('keydown', handleTabKey);
  };
}

// Announce message to screen readers
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Get accessible label for form validation
export function getAriaErrorMessage(error: string | undefined, fieldId: string): string | undefined {
  return error ? `${fieldId}-error` : undefined;
}

// Keyboard event helpers
export function isEnterOrSpace(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' || e.key === ' ';
}

export function handleKeyboardClick(
  e: React.KeyboardEvent,
  callback: () => void
): void {
  if (isEnterOrSpace(e)) {
    e.preventDefault();
    callback();
  }
}

// Check if reduced motion is preferred
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Skip to main content link
export function skipToMainContent(): void {
  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.focus();
    mainContent.scrollIntoView();
  }
}
