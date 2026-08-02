// frontend/src/hooks/useZKSessionRevalidation.ts
import { useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { getBrowserProvider } from '@/lib/web3Provider';
import { useAuthStore } from '@/store/authStore';
import ZKAuthRegistryABI from '@/contracts/abis/ZKAuthRegistry.json';
import { logger } from '@/lib/logger';

const ZK_AUTH_REGISTRY_ADDRESS = import.meta.env.VITE_ZK_AUTH_REGISTRY_ADDRESS as `0x${string}` | undefined;

/**
 * Revalidates a persisted ZK session against the on-chain contract on app load.
 *
 * If the stored sessionId is expired or inactive on-chain, clears all ZK auth
 * state so that RouteGuard and UI components reflect reality instead of relying
 * on a stale localStorage flag.
 *
 * Runs once per mount when conditions are met, then stays quiet.
 */
export function useZKSessionRevalidation() {
  const {
    zkAuth,
    authMethod,
    setZKAuthenticated,
    setZKSessionId,
    setZKAuthEnabled,
  } = useAuthStore();

  const hasRevalidated = useRef(false);

  useEffect(() => {
    if (hasRevalidated.current) return;

    const shouldRevalidate =
      authMethod === 'zk' &&
      zkAuth.isZKAuthenticated &&
      zkAuth.zkSessionId &&
      ZK_AUTH_REGISTRY_ADDRESS;

    if (!shouldRevalidate) return;

    hasRevalidated.current = true;

    (async () => {
      try {
        if (!window.ethereum) {
          logger.warn('No wallet provider available for ZK session revalidation');
          return;
        }

        const provider = getBrowserProvider();
        const registry = new ethers.Contract(
          ZK_AUTH_REGISTRY_ADDRESS!,
          ZKAuthRegistryABI.abi,
          provider
        );

        const [isValid] = await registry.validateSession(zkAuth.zkSessionId);

        if (!isValid) {
          logger.info(
            'Persisted ZK session is no longer valid on-chain — clearing auth state',
            { sessionId: zkAuth.zkSessionId }
          );
          setZKAuthenticated(false);
          setZKSessionId(null);
          setZKAuthEnabled(false);
        } else {
          logger.debug('Persisted ZK session validated on-chain', {
            sessionId: zkAuth.zkSessionId,
          });
        }
      } catch (err) {
        logger.warn(
          'Failed to revalidate ZK session on-chain — clearing auth state as precaution',
          { error: err }
        );
        setZKAuthenticated(false);
        setZKSessionId(null);
        setZKAuthEnabled(false);
      }
    })();
  }, [
    authMethod,
    zkAuth.isZKAuthenticated,
    zkAuth.zkSessionId,
    setZKAuthenticated,
    setZKSessionId,
    setZKAuthEnabled,
  ]);
}
