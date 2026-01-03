// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { wasmPlugin } from './vite-plugins/wasm-plugin';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    wasmPlugin(), // Add WASM plugin FIRST
    nodePolyfills({
      // To add only specific polyfills, add them here
      // If no option is provided, all polyfills are included
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Whether to polyfill specific globals.
      protocolImports: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'zkSync ZKP Certificate Manager',
        short_name: 'zkCredentials',
        description: 'Decentralized certificate management system powered by zkSync',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,wasm}'], // Added wasm
        // Increase the maximum file size to handle large WASM and vendor chunks
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024, // 100 MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      // Optimize bundle for faster startup
      target: 'esnext',
    },
    // Pre-bundle essential dependencies + CommonJS packages that need conversion
    include: [
      'react',
      'react-dom',
      'react-dom/client', // Explicitly include client for faster hydration
      'react-router-dom',
      'zustand',
      // CommonJS packages that need pre-bundling for ESM compatibility
      'eventemitter3',
      'events',
      // Core blockchain libraries
      'wagmi',
      'viem',
      '@rainbow-me/rainbowkit',
      // Poseidon lite - pre-bundle for faster startup
      'poseidon-lite/poseidon1',
      'poseidon-lite/poseidon3',
    ],
    // Exclude heavy libraries that should load on-demand
    exclude: [
      // ZK and WASM libraries - load when needed
      '@noir-lang/noir_js',
      '@noir-lang/backend_barretenberg',
      'circomlibjs',
    ],
    // Force dependency re-bundling optimization
    force: false, // Only set to true if you're debugging dep issues
    // Hold dependencies in memory between HMR updates
    holdUntilCrawlEnd: true,
  },
  // Configure asset handling for WASM files
  assetsInclude: ['**/*.wasm'],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress warnings about PURE annotations in ox library
        if (
          warning.code === 'INVALID_ANNOTATION' && 
          warning.message.includes('/*#__PURE__*/')
        ) {
          return;
        }
        // Suppress eval warnings from vm-browserify (polyfill, safe in browser context)
        if (
          warning.code === 'EVAL' && 
          warning.id?.includes('vm-browserify')
        ) {
          return;
        }
        // Show all other warnings
        warn(warning);
      },
      output: {
        manualChunks: (id) => {
          // Create more granular chunks to reduce memory pressure
          if (id.includes('node_modules')) {
            // Split large Web3 dependencies more aggressively
            if (id.includes('@reown') || id.includes('@walletconnect')) {
              return 'web3-reown';
            }
            if (id.includes('ox/') || id.includes('ox/_esm/')) {
              return 'web3-ox';
            }
            if (id.includes('wagmi')) {
              return 'web3-wagmi';
            }
            if (id.includes('viem')) {
              return 'web3-viem';
            }
            if (id.includes('@rainbow-me/rainbowkit')) {
              return 'web3-rainbowkit';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'react-query';
            }
            // PDF handling
            if (id.includes('pdfjs-dist') || id.includes('@react-pdf/renderer')) {
              return 'pdf-lib';
            }
            // ZK/Crypto libraries
            if (id.includes('circomlibjs') || id.includes('poseidon') || id.includes('crypto-js')) {
              return 'crypto-lib';
            }
            // Noir libraries
            if (id.includes('@noir-lang')) {
              return 'noir-lib';
            }
            // React core
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('react-router-dom')) {
              return 'react-router';
            }
            // Form handling
            if (id.includes('react-hook-form') || id.includes('@hookform')) {
              return 'forms';
            }
            // UI utilities
            if (id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'ui-utils';
            }
            // All other node_modules
            return 'vendor';
          }
        },
      },
    },
    target: 'esnext',
    minify: 'esbuild', // Use esbuild instead of terser - much faster and less memory intensive
    chunkSizeWarningLimit: 1000,
    // Ensure WASM files are copied as-is
    copyPublicDir: true,
    // Reduce memory usage during build
    sourcemap: false, // Disable source maps for production to save memory
    reportCompressedSize: false, // Skip gzip size reporting to save memory
  },
  // Configure dev server to serve WASM with correct MIME type
  server: {
    headers: {
      // CORS headers for WASM and security
      // Note: COEP requires COOP, but Coinbase Wallet needs COOP to NOT be 'same-origin'
      // We'll keep COEP for WASM support but relax COOP for wallet compatibility
      'Cross-Origin-Embedder-Policy': 'credentialless', // Less strict than 'require-corp', allows Coinbase Wallet
      // Don't set COOP to 'same-origin' - this breaks Coinbase Smart Wallet popups
      // 'Cross-Origin-Opener-Policy': 'same-origin', // REMOVED for Coinbase compatibility
    },
    fs: {
      // Allow serving files from node_modules
      allow: ['..'],
    },
    // Optimize dev server performance
    hmr: {
      overlay: true,
    },
    // Pre-warm frequently used files for faster initial load
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/pages/Home.tsx',
        './src/components/Layout.tsx',
        './src/lib/wagmi.ts',
      ],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: true,
  },
});

