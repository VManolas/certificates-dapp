import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSha256ToString = vi.fn();
const mockWordArrayCreate = vi.fn();

vi.mock('crypto-js', () => ({
  default: {
    lib: {
      WordArray: {
        create: (...args: unknown[]) => mockWordArrayCreate(...args),
      },
    },
    SHA256: () => ({
      toString: (...args: unknown[]) => mockSha256ToString(...args),
    }),
  },
}));

describe('pdfHashWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockWordArrayCreate.mockImplementation((buffer: ArrayBuffer) => buffer);
    mockSha256ToString.mockReturnValue('abcd'.repeat(16));

    vi.stubGlobal('self', {
      postMessage: vi.fn(),
      onmessage: null,
    });
  });

  it('registers a message handler that hashes PDFs and posts the result', async () => {
    await import('@/workers/pdfHashWorker');

    expect(self.onmessage).toBeTypeOf('function');

    const arrayBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
    await self.onmessage?.({
      data: {
        type: 'hash',
        arrayBuffer,
        fileName: 'transcript.pdf',
        fileSize: 4,
      },
    } as MessageEvent);

    expect(mockWordArrayCreate).toHaveBeenCalledWith(arrayBuffer);
    expect(self.postMessage).toHaveBeenCalledWith({
      success: true,
      data: {
        hash: `0x${'abcd'.repeat(16)}`,
        fileName: 'transcript.pdf',
        fileSize: 4,
      },
    });
  });

  it('posts a normalized error when hashing fails', async () => {
    mockWordArrayCreate.mockImplementation(() => {
      throw new Error('boom');
    });

    await import('@/workers/pdfHashWorker');

    await self.onmessage?.({
      data: {
        type: 'hash',
        arrayBuffer: new Uint8Array([1]).buffer,
        fileName: 'broken.pdf',
        fileSize: 1,
      },
    } as MessageEvent);

    expect(self.postMessage).toHaveBeenCalledWith({
      success: false,
      error: 'boom',
    });
  });

  it('ignores unsupported message types', async () => {
    await import('@/workers/pdfHashWorker');

    await self.onmessage?.({
      data: {
        type: 'noop',
        arrayBuffer: new ArrayBuffer(0),
        fileName: 'ignored.pdf',
        fileSize: 0,
      },
    } as MessageEvent);

    expect(self.postMessage).not.toHaveBeenCalled();
  });
});
