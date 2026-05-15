// src/lib/__tests__/utils.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, sleep } from '@/lib/utils';

describe('utils', () => {
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
});
