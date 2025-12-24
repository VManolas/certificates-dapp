// frontend/src/workers/pdfHashWorker.ts
import CryptoJS from 'crypto-js';

export interface HashWorkerMessage {
  type: 'hash';
  arrayBuffer: ArrayBuffer;
  fileName: string;
  fileSize: number;
}

export interface HashWorkerResponse {
  hash: `0x${string}`;
  fileName: string;
  fileSize: number;
}

// Listen for messages from main thread
self.onmessage = async (e: MessageEvent<HashWorkerMessage>) => {
  const { type, arrayBuffer, fileName, fileSize } = e.data;

  if (type === 'hash') {
    try {
      // Hash the raw binary data
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as unknown as number[]);
      const hash = CryptoJS.SHA256(wordArray).toString();

      const response: HashWorkerResponse = {
        hash: `0x${hash}`,
        fileName,
        fileSize,
      };

      // Send result back to main thread
      self.postMessage({ success: true, data: response });
    } catch (error) {
      self.postMessage({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Hash generation failed' 
      });
    }
  }
};
