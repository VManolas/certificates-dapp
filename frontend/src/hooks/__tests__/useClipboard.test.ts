// src/hooks/__tests__/useClipboard.test.ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard, useClipboard } from '@/hooks/useClipboard';

// ─── Clipboard mock ───────────────────────────────────────────────────────────

function mockClipboard(resolves: boolean) {
  const writeText = resolves
    ? vi.fn().mockResolvedValue(undefined)
    : vi.fn().mockRejectedValue(new Error('Permission denied'));
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  });
  return writeText;
}

describe('useClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  it('starts with null copiedText, null copiedField, and isCopied=false', () => {
    mockClipboard(true);
    const { result } = renderHook(() => useClipboard());
    expect(result.current.copiedText).toBeNull();
    expect(result.current.copiedField).toBeNull();
    expect(result.current.isCopied).toBe(false);
  });

  // ─── copy (success) ───────────────────────────────────────────────────────

  it('copy returns true and updates state on success', async () => {
    mockClipboard(true);
    const { result } = renderHook(() => useClipboard());

    let success: boolean;
    await act(async () => {
      success = await result.current.copy('hello');
    });

    expect(success!).toBe(true);
    expect(result.current.isCopied).toBe(true);
    expect(result.current.copiedText).toBe('hello');
  });

  it('stores the optional field identifier', async () => {
    mockClipboard(true);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('value', 'myField');
    });

    expect(result.current.copiedField).toBe('myField');
  });

  it('copiedField is null when no field is provided', async () => {
    mockClipboard(true);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('value');
    });

    expect(result.current.copiedField).toBeNull();
  });

  it('invokes the onSuccess callback with the text and field', async () => {
    mockClipboard(true);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useClipboard({ onSuccess }));

    await act(async () => {
      await result.current.copy('text', 'field');
    });

    expect(onSuccess).toHaveBeenCalledWith('text', 'field');
  });

  it('auto-resets state after the default 2000ms delay', async () => {
    mockClipboard(true);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.isCopied).toBe(true);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.isCopied).toBe(false);
    expect(result.current.copiedText).toBeNull();
  });

  it('respects a custom resetDelay', async () => {
    mockClipboard(true);
    const { result } = renderHook(() => useClipboard({ resetDelay: 500 }));

    await act(async () => {
      await result.current.copy('hello');
    });

    act(() => { vi.advanceTimersByTime(499); });
    expect(result.current.isCopied).toBe(true);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.isCopied).toBe(false);
  });

  // ─── copy (failure) ───────────────────────────────────────────────────────

  it('copy returns false on clipboard failure', async () => {
    mockClipboard(false);
    const { result } = renderHook(() => useClipboard());

    let success: boolean;
    await act(async () => {
      success = await result.current.copy('hello');
    });

    expect(success!).toBe(false);
    expect(result.current.isCopied).toBe(false);
  });

  it('invokes the onError callback on failure', async () => {
    mockClipboard(false);
    const onError = vi.fn();
    const { result } = renderHook(() => useClipboard({ onError }));

    await act(async () => {
      await result.current.copy('hello', 'field');
    });

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      'hello',
      'field',
    );
  });

  // ─── reset ────────────────────────────────────────────────────────────────

  it('reset clears all state immediately', async () => {
    mockClipboard(true);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('hello', 'f');
    });
    expect(result.current.isCopied).toBe(true);

    act(() => { result.current.reset(); });
    expect(result.current.isCopied).toBe(false);
    expect(result.current.copiedText).toBeNull();
    expect(result.current.copiedField).toBeNull();
  });

  it('reset cancels the auto-reset timer', async () => {
    mockClipboard(true);
    const clearSpy = vi.spyOn(window, 'clearTimeout');
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('hello');
    });
    act(() => { result.current.reset(); });

    expect(clearSpy).toHaveBeenCalled();
  });

  // ─── isFieldCopied ────────────────────────────────────────────────────────

  it('isFieldCopied returns true only for the currently copied field', async () => {
    mockClipboard(true);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('val', 'target');
    });

    expect(result.current.isFieldCopied('target')).toBe(true);
    expect(result.current.isFieldCopied('other')).toBe(false);
  });

  it('isFieldCopied returns false before any copy', () => {
    mockClipboard(true);
    const { result } = renderHook(() => useClipboard());
    expect(result.current.isFieldCopied('any')).toBe(false);
  });

  // ─── unmount cleanup ──────────────────────────────────────────────────────

  it('clears the timer on unmount to prevent state-update-after-unmount', async () => {
    mockClipboard(true);
    const clearSpy = vi.spyOn(window, 'clearTimeout');
    const { result, unmount } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('hello');
    });
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});

// ─── copyToClipboard standalone ───────────────────────────────────────────────

describe('copyToClipboard', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns true on success', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    expect(await copyToClipboard('text')).toBe(true);
  });

  it('returns false and logs on failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      writable: true,
      configurable: true,
    });
    expect(await copyToClipboard('text')).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});
