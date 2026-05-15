import type { SwitchTxPhase } from '@/lib/authSwitchStatus';

interface SwitchTxStatusPanelProps {
  phase: SwitchTxPhase;
  skippedOnchainTx: boolean;
  error: string | null;
}

export function SwitchTxStatusPanel({ phase, skippedOnchainTx, error }: SwitchTxStatusPanelProps) {
  if (
    phase !== 'awaiting_wallet_confirmation' &&
    phase !== 'pending_onchain' &&
    phase !== 'confirmed' &&
    phase !== 'failed'
  ) {
    return null;
  }

  const toneClass =
    phase === 'awaiting_wallet_confirmation'
      ? 'border-yellow-500/30 bg-yellow-500/10'
      : phase === 'pending_onchain'
      ? 'border-blue-500/30 bg-blue-500/10'
      : phase === 'confirmed'
      ? 'border-green-500/30 bg-green-500/10'
      : 'border-red-500/30 bg-red-500/10';

  const titleClass =
    phase === 'awaiting_wallet_confirmation'
      ? 'text-yellow-300'
      : phase === 'pending_onchain'
      ? 'text-blue-300'
      : phase === 'confirmed'
      ? 'text-green-300'
      : 'text-red-300';

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className={`text-sm font-medium ${titleClass}`}>
        {phase === 'awaiting_wallet_confirmation' && 'Waiting to submit transaction'}
        {phase === 'pending_onchain' && 'Transaction pending'}
        {phase === 'confirmed' && 'Transaction confirmed'}
        {phase === 'failed' && 'Transaction failed'}
      </p>
      <p className="text-xs text-surface-300 mt-1">
        {phase === 'awaiting_wallet_confirmation' &&
          'Approve the MetaMask transaction to end your private session and switch to standard login.'}
        {phase === 'pending_onchain' &&
          'Your transaction was submitted. Waiting for blockchain confirmation.'}
        {phase === 'confirmed' && skippedOnchainTx &&
          'No active private session found on-chain. Switched locally to standard login.'}
        {phase === 'confirmed' && !skippedOnchainTx &&
          'Session closure confirmed. Switching to standard login...'}
        {phase === 'failed' && (error || 'Unable to switch authentication method.')}
      </p>
    </div>
  );
}

export function getSwitchToStandardButtonLabel(phase: SwitchTxPhase): string {
  if (phase === 'awaiting_wallet_confirmation') {
    return 'Waiting for wallet confirmation...';
  }
  if (phase === 'pending_onchain') {
    return 'Transaction pending...';
  }
  return 'Switch to Standard';
}

export function isSwitchInFlight(phase: SwitchTxPhase): boolean {
  return phase === 'awaiting_wallet_confirmation' || phase === 'pending_onchain';
}
