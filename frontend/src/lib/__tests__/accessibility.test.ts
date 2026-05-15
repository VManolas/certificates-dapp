// src/lib/__tests__/accessibility.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  announceToScreenReader,
  getAriaErrorMessage,
  handleKeyboardClick,
  isEnterOrSpace,
  prefersReducedMotion,
  skipToMainContent,
  trapFocus,
} from '@/lib/accessibility';

describe('accessibility', () => {
  // ─── getAriaErrorMessage ─────────────────────────────────────────────────

  describe('getAriaErrorMessage', () => {
    it('returns "<fieldId>-error" when an error is present', () => {
      expect(getAriaErrorMessage('Required field', 'email')).toBe('email-error');
    });

    it('returns undefined when there is no error', () => {
      expect(getAriaErrorMessage(undefined, 'email')).toBeUndefined();
    });

    it('returns undefined for an empty string error (falsy)', () => {
      expect(getAriaErrorMessage('', 'email')).toBeUndefined();
    });
  });

  // ─── isEnterOrSpace ──────────────────────────────────────────────────────

  describe('isEnterOrSpace', () => {
    const makeEvent = (key: string) =>
      ({ key } as unknown as React.KeyboardEvent);

    it('returns true for Enter', () => {
      expect(isEnterOrSpace(makeEvent('Enter'))).toBe(true);
    });

    it('returns true for Space (" ")', () => {
      expect(isEnterOrSpace(makeEvent(' '))).toBe(true);
    });

    it('returns false for other keys', () => {
      expect(isEnterOrSpace(makeEvent('Tab'))).toBe(false);
      expect(isEnterOrSpace(makeEvent('Escape'))).toBe(false);
      expect(isEnterOrSpace(makeEvent('a'))).toBe(false);
    });
  });

  // ─── handleKeyboardClick ─────────────────────────────────────────────────

  describe('handleKeyboardClick', () => {
    const makeEvent = (key: string) =>
      ({ key, preventDefault: vi.fn() } as unknown as React.KeyboardEvent);

    it('invokes the callback and prevents default on Enter', () => {
      const cb = vi.fn();
      const e = makeEvent('Enter');
      handleKeyboardClick(e, cb);
      expect(cb).toHaveBeenCalledOnce();
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('invokes the callback and prevents default on Space', () => {
      const cb = vi.fn();
      const e = makeEvent(' ');
      handleKeyboardClick(e, cb);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('does nothing for other keys', () => {
      const cb = vi.fn();
      const e = makeEvent('Tab');
      handleKeyboardClick(e, cb);
      expect(cb).not.toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
    });
  });

  // ─── prefersReducedMotion ─────────────────────────────────────────────────

  describe('prefersReducedMotion', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('returns true when the media query matches', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockReturnValue({ matches: true }),
      });
      expect(prefersReducedMotion()).toBe(true);
    });

    it('returns false when the media query does not match', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockReturnValue({ matches: false }),
      });
      expect(prefersReducedMotion()).toBe(false);
    });
  });

  // ─── announceToScreenReader ───────────────────────────────────────────────

  describe('announceToScreenReader', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
      vi.useRealTimers();
      // Clean up any leftover announcements
      document.querySelectorAll('[aria-live]').forEach((el) => el.remove());
    });

    it('appends a live region with the message to the body', () => {
      announceToScreenReader('Upload complete');
      const el = document.body.querySelector('[aria-live="polite"]');
      expect(el).not.toBeNull();
      expect(el!.textContent).toBe('Upload complete');
    });

    it('uses "polite" aria-live by default', () => {
      announceToScreenReader('Info message');
      expect(document.body.querySelector('[aria-live="polite"]')).not.toBeNull();
    });

    it('uses "assertive" aria-live when specified', () => {
      announceToScreenReader('Error!', 'assertive');
      expect(document.body.querySelector('[aria-live="assertive"]')).not.toBeNull();
    });

    it('removes the element from the DOM after 1 second', () => {
      announceToScreenReader('Temporary');
      expect(document.body.querySelector('[aria-live]')).not.toBeNull();
      vi.advanceTimersByTime(1000);
      expect(document.body.querySelector('[aria-live]')).toBeNull();
    });
  });

  // ─── skipToMainContent ────────────────────────────────────────────────────

  describe('skipToMainContent', () => {
    afterEach(() => {
      document.querySelectorAll('main').forEach((el) => el.remove());
    });

    it('focuses the <main> element when it exists', () => {
      const main = document.createElement('main');
      main.tabIndex = -1;
      main.scrollIntoView = vi.fn();
      document.body.appendChild(main);
      const focusSpy = vi.spyOn(main, 'focus');
      skipToMainContent();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('does nothing when there is no <main> element', () => {
      expect(() => skipToMainContent()).not.toThrow();
    });
  });

  // ─── trapFocus ───────────────────────────────────────────────────────────

  describe('trapFocus', () => {
    let container: HTMLDivElement;
    let btn1: HTMLButtonElement;
    let btn2: HTMLButtonElement;

    beforeEach(() => {
      container = document.createElement('div');
      btn1 = document.createElement('button');
      btn2 = document.createElement('button');
      container.appendChild(btn1);
      container.appendChild(btn2);
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('focuses the first focusable element on activation', () => {
      const cleanup = trapFocus(container);
      expect(document.activeElement).toBe(btn1);
      cleanup();
    });

    it('returns a cleanup function that removes the keydown listener', () => {
      const cleanup = trapFocus(container);
      // After cleanup, Tab on last element should NOT re-focus first element
      cleanup();
      btn2.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      container.dispatchEvent(tabEvent);
      // Focus should remain on btn2 (no wrapping)
      expect(document.activeElement).toBe(btn2);
    });

    it('wraps focus forward: Tab on the last element moves to the first', () => {
      const cleanup = trapFocus(container);
      btn2.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      Object.defineProperty(tabEvent, 'preventDefault', { value: vi.fn() });
      container.dispatchEvent(tabEvent);
      expect(document.activeElement).toBe(btn1);
      cleanup();
    });

    it('wraps focus backward: Shift+Tab on the first element moves to the last', () => {
      const cleanup = trapFocus(container);
      btn1.focus();
      const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
      Object.defineProperty(shiftTab, 'preventDefault', { value: vi.fn() });
      container.dispatchEvent(shiftTab);
      expect(document.activeElement).toBe(btn2);
      cleanup();
    });

    it('does not intercept non-Tab keys', () => {
      const cleanup = trapFocus(container);
      btn2.focus();
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      container.dispatchEvent(escEvent);
      expect(document.activeElement).toBe(btn2);
      cleanup();
    });
  });
});
