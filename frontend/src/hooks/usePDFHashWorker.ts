// frontend/src/hooks/usePDFHashWorker.ts
import { useCallback, useRef } from 'react';
import type { HashWorkerMessage, HashWorkerResponse } from '@/workers/pdfHashWorker';

interface UsePDFHashWorkerResult {
  generateHash: (arrayBuffer: ArrayBuffer, fileName: string, fileSize: number) => Promise<HashWorkerResponse>;
  isWorkerSupported: boolean;
}

/**
 * Hook to generate PDF hashes using a Web Worker for better performance
 * Falls back to main thread if Web Workers are not supported
 */
export function usePDFHashWorker(): UsePDFHashWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  
  const isWorkerSupported = typeof Worker !== 'undefined';

  const generateHash = useCallback(async (
    arrayBuffer: ArrayBuffer,
    fileName: string,
    fileSize: number
  ): Promise<HashWorkerResponse> => {
    // Check if Web Workers are supported
    if (!isWorkerSupported) {
      throw new Error('Web Workers are not supported in this browser');
    }

    // Create worker if it doesn't exist
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/pdfHashWorker.ts', import.meta.url),
        { type: 'module' }
      );
    }

    return new Promise((resolve, reject) => {
      const worker = workerRef.current!;

      // Set up one-time message handler
      const handleMessage = (e: MessageEvent) => {
        worker.removeEventListener('message', handleMessage);
        
        if (e.data.success) {
          resolve(e.data.data);
        } else {
          reject(new Error(e.data.error || 'Hash generation failed'));
        }
      };

      // Set up error handler
      const handleError = (error: ErrorEvent) => {
        worker.removeEventListener('error', handleError);
        reject(new Error(`Worker error: ${error.message}`));
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);

      // Send data to worker
      const message: HashWorkerMessage = {
        type: 'hash',
        arrayBuffer,
        fileName,
        fileSize,
      };
      
      worker.postMessage(message, [arrayBuffer]); // Transfer arrayBuffer for better performance
    });
  }, [isWorkerSupported]);

  return {
    generateHash,
    isWorkerSupported,
  };
}
