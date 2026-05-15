import type { ZKAuthProgressEvent } from '@/hooks/useZKAuth';

export type SwitchTxPhase =
  | 'idle'
  | 'awaiting_wallet_confirmation'
  | 'pending_onchain'
  | 'confirmed'
  | 'failed';

export interface SwitchTxProgressState {
  phase: SwitchTxPhase;
  skippedOnchainTx: boolean;
}

export function getSwitchTxProgressFromEvent(
  event: ZKAuthProgressEvent
): SwitchTxProgressState | null {
  if (event === 'logout_no_active_session') {
    return { phase: 'confirmed', skippedOnchainTx: true };
  }

  if (event === 'logout_transaction_required') {
    return { phase: 'awaiting_wallet_confirmation', skippedOnchainTx: false };
  }

  if (event === 'logout_transaction_submitted') {
    return { phase: 'pending_onchain', skippedOnchainTx: false };
  }

  if (event === 'logout_transaction_confirmed') {
    return { phase: 'confirmed', skippedOnchainTx: false };
  }

  return null;
}
