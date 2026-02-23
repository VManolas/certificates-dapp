import { describe, expect, it } from 'vitest';
import {
  getSwitchTxProgressFromEvent,
  type SwitchTxPhase,
} from '@/lib/authSwitchStatus';

describe('authSwitchStatus', () => {
  it('maps logout_no_active_session to confirmed with skipped on-chain tx', () => {
    expect(getSwitchTxProgressFromEvent('logout_no_active_session')).toEqual({
      phase: 'confirmed',
      skippedOnchainTx: true,
    });
  });

  it('maps logout tx lifecycle events to expected phases', () => {
    const cases: Array<{ event: Parameters<typeof getSwitchTxProgressFromEvent>[0]; phase: SwitchTxPhase }> = [
      { event: 'logout_transaction_required', phase: 'awaiting_wallet_confirmation' },
      { event: 'logout_transaction_submitted', phase: 'pending_onchain' },
      { event: 'logout_transaction_confirmed', phase: 'confirmed' },
    ];

    for (const { event, phase } of cases) {
      expect(getSwitchTxProgressFromEvent(event)).toEqual({
        phase,
        skippedOnchainTx: false,
      });
    }
  });

  it('returns null for unrelated events', () => {
    expect(getSwitchTxProgressFromEvent('login_transaction_required')).toBeNull();
    expect(getSwitchTxProgressFromEvent('register_transaction_submitted')).toBeNull();
  });
});
