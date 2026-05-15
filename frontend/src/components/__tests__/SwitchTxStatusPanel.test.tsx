import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  SwitchTxStatusPanel,
  getSwitchToStandardButtonLabel,
  isSwitchInFlight,
} from '@/components/SwitchTxStatusPanel';

describe('SwitchTxStatusPanel', () => {
  it('renders nothing for idle phase', () => {
    const { container } = render(
      <SwitchTxStatusPanel phase="idle" skippedOnchainTx={false} error={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders wallet confirmation copy', () => {
    render(
      <SwitchTxStatusPanel
        phase="awaiting_wallet_confirmation"
        skippedOnchainTx={false}
        error={null}
      />
    );
    expect(screen.getByText('Waiting to submit transaction')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Approve the MetaMask transaction to end your private session and switch to standard login.'
      )
    ).toBeInTheDocument();
  });

  it('renders confirmed copy for skipped on-chain logout', () => {
    render(
      <SwitchTxStatusPanel phase="confirmed" skippedOnchainTx={true} error={null} />
    );
    expect(screen.getByText('Transaction confirmed')).toBeInTheDocument();
    expect(
      screen.getByText('No active private session found on-chain. Switched locally to standard login.')
    ).toBeInTheDocument();
  });
});

describe('SwitchTxStatusPanel helpers', () => {
  it('returns expected button labels', () => {
    expect(getSwitchToStandardButtonLabel('awaiting_wallet_confirmation')).toBe(
      'Waiting for wallet confirmation...'
    );
    expect(getSwitchToStandardButtonLabel('pending_onchain')).toBe(
      'Transaction pending...'
    );
    expect(getSwitchToStandardButtonLabel('confirmed')).toBe('Switch to Standard');
  });

  it('detects in-flight phases correctly', () => {
    expect(isSwitchInFlight('awaiting_wallet_confirmation')).toBe(true);
    expect(isSwitchInFlight('pending_onchain')).toBe(true);
    expect(isSwitchInFlight('confirmed')).toBe(false);
    expect(isSwitchInFlight('failed')).toBe(false);
  });
});
