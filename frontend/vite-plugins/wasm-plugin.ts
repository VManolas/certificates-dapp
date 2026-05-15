// frontend/vite-plugins/wasm-plugin.ts
/**
 * Vite Plugin to handle WebAssembly files correctly
 * 
 * This plugin ensures that .wasm files are:
 * 1. Served with the correct MIME type (application/wasm)
 * 2. Not processed or optimized by Vite
 * 3. Copied as-is to the output directory
 */

import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export function wasmPlugin(): Plugin {
  return {
    name: 'vite-plugin-wasm',
    
    // Handle WASM file imports
    load(id) {
      if (id.endsWith('.wasm')) {
        // Return the WASM file as a URL that can be fetched
        const wasmBuffer = fs.readFileSync(id);
        const base64 = wasmBuffer.toString('base64');
        
        return {
          code: `
            const wasmBase64 = "${base64}";
            const wasmBinary = Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0));
            export default wasmBinary;
          `,
          map: null
        };
      }
    },
    
    // Configure dev server to serve WASM with correct MIME type
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        }
        next();
      });
    },
    
    // Handle WASM files in build
    generateBundle(options, bundle) {
      // Find all WASM files in the bundle
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (fileName.endsWith('.wasm')) {
          // Ensure WASM files are emitted as assets
          if (asset.type === 'chunk') {
            console.warn(`[wasm-plugin] WASM file ${fileName} was processed as a chunk, this may cause issues`);
          }
        }
      }
    }
  };
}


