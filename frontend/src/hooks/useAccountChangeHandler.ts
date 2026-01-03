// src/hooks/useAccountChangeHandler.ts
import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Hook to handle wallet account changes
 * 
 * When a user switches accounts in their wallet (e.g., MetaMask),
 * this hook detects the change and:
 * 1. Clears the auth store (cached institution data, roles, etc.)
 * 2. Clears React Query cache
 * 3. Clears localStorage
 * 4. Redirects to home page
 * 5. Reloads to ensure completely fresh state
 * 
 * This prevents stale cached data from being displayed when switching
 * between different accounts (e.g., switching from admin to university).
 */
export function useAccountChangeHandler() {
  const { address, isConnected, connector } = useAccount();
  const navigate = useNavigate();
  const { reset: resetAuthStore } = useAuthStore();
  const previousAddressRef = useRef<string | undefined>(undefined);
  const isInitialMountRef = useRef(true);

  // Log connection state changes for debugging
  useEffect(() => {
    console.log('🔌 Connection state:', {
      isConnected,
      address,
      connector: connector?.name,
      previousAddress: previousAddressRef.current,
    });
  }, [isConnected, address, connector]);

  useEffect(() => {
    // Skip on initial mount - we don't want to reload on first load
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousAddressRef.current = address;
      return;
    }

    // If address changes (not just disconnect)
    if (
      isConnected &&
      address &&
      previousAddressRef.current &&
      previousAddressRef.current !== address
    ) {
      console.log('🔄 Account changed detected:', {
        from: previousAddressRef.current,
        to: address,
        connector: connector?.name,
      });

      // Clear auth store
      resetAuthStore();

      // Clear React Query cache
      if (window.queryClient) {
        window.queryClient.clear();
        console.log('🧹 React Query cache cleared');
      }

      // Clear localStorage items that might be cached
      const authStorageKey = 'zkcredentials-auth';
      localStorage.removeItem(authStorageKey);
      console.log('🧹 localStorage cleared');

      console.log('🔄 Redirecting to home page and reloading...');

      // Navigate to home page
      navigate('/', { replace: true });

      // Reload the page to ensure completely fresh state
      // Small delay to allow navigation to complete
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }

    // Update previous address
    previousAddressRef.current = address;
  }, [address, isConnected, connector, resetAuthStore, navigate]);

  // Handle disconnection
  useEffect(() => {
    if (!isConnected && previousAddressRef.current) {
      console.log('👋 Wallet disconnected');
      
      // Clear localStorage FIRST to prevent state restoration
      const authStorageKey = 'zkcredentials-auth';
      localStorage.removeItem(authStorageKey);
      console.log('🧹 localStorage cleared on disconnect');
      
      // Clear auth store (after localStorage to prevent re-persist)
      resetAuthStore();
      
      // Clear React Query cache
      if (window.queryClient) {
        window.queryClient.clear();
        console.log('🧹 React Query cache cleared on disconnect');
      }
      
      previousAddressRef.current = undefined;
      
      // Redirect to home page on disconnect
      navigate('/', { replace: true });
    }
  }, [isConnected, resetAuthStore, navigate]);
}

