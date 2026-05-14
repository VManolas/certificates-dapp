// src/lib/__tests__/utils.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  copyToClipboard,
  debounce,
  formatAddress,
  formatNumber,
  sleep,
} from '@/lib/utils';

describe('utils', () => {
  // ─── formatAddress ────────────────────────────────────────────────────────

  describe('formatAddress', () => {
    const ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

    it('truncates a full address using the default 4-char slice', () => {
      const result = formatAddress(ADDR);
      expect(result).toBe('0xf39F...2266');
    });

    it('uses a custom chars value', () => {
      const result = formatAddress(ADDR, 6);
      expect(result).toBe('0xf39Fd6...b92266');
    });

    it('returns empty string for an empty input', () => {
      expect(formatAddress('')).toBe('');
    });

    it('returns the address as-is when it is too short to truncate', () => {
      const short = '0x1234';
      expect(formatAddress(short, 4)).toBe(short);
    });

    it('contains the leading "0x" prefix in the result', () => {
      expect(formatAddress(ADDR).startsWith('0x')).toBe(true);
    });
  });

  // ─── formatNumber ────────────────────────────────────────────────────────

  describe('formatNumber', () => {
    it('formats a plain number', () => {
      const result = formatNumber(1000);
      // toLocaleString output is locale-dependent; just check it is a string
      expect(typeof result).toBe('string');
      expect(result).not.toBe('');
    });

    it('formats a bigint', () => {
      const result = formatNumber(1000000n);
      expect(typeof result).toBe('string');
      expect(result).not.toBe('');
    });

    it('formats zero', () => {
      expect(formatNumber(0)).toBe('0');
    });
  });

  // ─── debounce ─────────────────────────────────────────────────────────────

  describe('debounce', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('does not call the function before the delay elapses', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);
      debounced();
      expect(fn).not.toHaveBeenCalled();
    });

    it('calls the function once after the delay', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);
      debounced();
      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledOnce();
    });

    it('resets the timer on each call and only fires once', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);
      debounced('a');
      debounced('b');
      debounced('c');
      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith('c');
    });

    it('calls the function again after another delay', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced('first');
      vi.advanceTimersByTime(100);
      debounced('second');
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('second');
    });
  });

  // ─── sleep ────────────────────────────────────────────────────────────────

  describe('sleep', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('resolves after the specified duration', async () => {
      let resolved = false;
      sleep(500).then(() => { resolved = true; });
      expect(resolved).toBe(false);
      vi.advanceTimersByTime(500);
      await Promise.resolve(); // flush microtask queue
      expect(resolved).toBe(true);
    });

    it('does not resolve before the duration', async () => {
      let resolved = false;
      sleep(500).then(() => { resolved = true; });
      vi.advanceTimersByTime(499);
      await Promise.resolve();
      expect(resolved).toBe(false);
    });
  });

  // ─── copyToClipboard ──────────────────────────────────────────────────────

  describe('copyToClipboard', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn() },
      });
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it('returns true on success', async () => {
      (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      expect(await copyToClipboard('hello')).toBe(true);
    });

    it('returns false and logs on failure', async () => {
      (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('denied'));
      expect(await copyToClipboard('hello')).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
