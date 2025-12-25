// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

import { config } from './lib/wagmi';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initPerformanceMonitoring, observeLongTasks } from './lib/performance';
import App from './App';
import './index.css';

// Initialize performance monitoring
if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_PERF_MONITORING === 'true') {
  initPerformanceMonitoring();
  observeLongTasks();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache contract reads for 10 minutes (immutable blockchain data)
      staleTime: 1000 * 60 * 10,
      // Cache for 30 minutes before garbage collection
      gcTime: 1000 * 60 * 30,
      // Retry failed queries once
      retry: 1,
      // Don't refetch on window focus for contract data
      refetchOnWindowFocus: false,
      // Keep previous data while fetching new data
      placeholderData: (previousData: unknown) => previousData,
    },
  },
});

// Expose queryClient to window for account change handler
declare global {
  interface Window {
    queryClient: QueryClient;
  }
}
window.queryClient = queryClient;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: '#6366f1',
              accentColorForeground: 'white',
              borderRadius: 'medium',
            })}
          >
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

