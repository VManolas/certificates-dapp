// src/hooks/useVerificationHistory.ts
import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

export interface VerificationHistoryEntry {
  id: string;
  timestamp: number;
  certificateId?: bigint;
  walletAddress?: string;
  documentHash?: string;
  isValid: boolean;
  isRevoked: boolean;
  verificationType: 'pdf' | 'wallet' | 'link';
  institutionAddress?: string;
  studentAddress?: string;
}

interface UseVerificationHistoryReturn {
  history: VerificationHistoryEntry[];
  addEntry: (entry: Omit<VerificationHistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  exportToCSV: () => void;
  getStats: () => {
    total: number;
    valid: number;
    invalid: number;
    revoked: number;
  };
}

const STORAGE_KEY = 'zkcredentials-verification-history';
const MAX_ENTRIES = 100;

/**
 * Hook to manage employer verification history in localStorage
 * 
 * Stores the last 100 verification attempts with details:
 * - Timestamp
 * - Certificate ID (if applicable)
 * - Wallet address (if wallet verification)
 * - Document hash (if PDF verification)
 * - Verification result (valid/invalid/revoked)
 * - Verification type (pdf/wallet/link)
 * 
 * @example
 * ```tsx
 * const { history, addEntry, clearHistory, getStats } = useVerificationHistory();
 * 
 * // Add a verification
 * addEntry({
 *   verificationType: 'pdf',
 *   isValid: true,
 *   isRevoked: false,
 *   certificateId: 123n,
 *   documentHash: '0x...',
 * });
 * 
 * // Get statistics
 * const { total, valid, invalid } = getStats();
 * ```
 */
export function useVerificationHistory(): UseVerificationHistoryReturn {
  const [history, setHistory] = useState<VerificationHistoryEntry[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Array<Omit<VerificationHistoryEntry, 'certificateId'> & { certificateId?: string }>;
        // Convert bigint strings back to bigint
        const entries = parsed.map((entry) => ({
          ...entry,
          certificateId: entry.certificateId ? BigInt(entry.certificateId) : undefined,
        }));
        setHistory(entries);
      }
    } catch (error) {
      logger.error('Failed to load verification history', error);
      setHistory([]);
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveHistory = useCallback((entries: VerificationHistoryEntry[]) => {
    try {
      // Convert bigint to string for JSON serialization
      const serializable = entries.map((entry) => ({
        ...entry,
        certificateId: entry.certificateId?.toString(),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.error('Failed to save verification history:', error);
    }
  }, []);

  // Add a new verification entry
  const addEntry = useCallback(
    (entry: Omit<VerificationHistoryEntry, 'id' | 'timestamp'>) => {
      const newEntry: VerificationHistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        // Add to beginning, keep only last MAX_ENTRIES
        const updated = [newEntry, ...prev].slice(0, MAX_ENTRIES);
        saveHistory(updated);
        return updated;
      });
    },
    [saveHistory]
  );

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Export history to CSV
  const exportToCSV = useCallback(() => {
    if (history.length === 0) {
      alert('No verification history to export');
      return;
    }

    // CSV header
    const headers = [
      'Date',
      'Time',
      'Type',
      'Status',
      'Certificate ID',
      'Wallet Address',
      'Document Hash',
      'Institution Address',
      'Student Address',
    ];

    // Format each entry as CSV row
    const rows = history.map((entry) => {
      const date = new Date(entry.timestamp);
      const status = entry.isRevoked ? 'Revoked' : entry.isValid ? 'Valid' : 'Invalid';
      
      return [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        entry.verificationType.toUpperCase(),
        status,
        entry.certificateId?.toString() || '',
        entry.walletAddress || '',
        entry.documentHash || '',
        entry.institutionAddress || '',
        entry.studentAddress || '',
      ].map((cell) => `"${cell}"`).join(',');
    });

    // Combine header and rows
    const csv = [headers.join(','), ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `verification-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [history]);

  // Get statistics
  const getStats = useCallback(() => {
    const total = history.length;
    const valid = history.filter((e) => e.isValid && !e.isRevoked).length;
    const invalid = history.filter((e) => !e.isValid).length;
    const revoked = history.filter((e) => e.isRevoked).length;

    return { total, valid, invalid, revoked };
  }, [history]);

  return {
    history,
    addEntry,
    clearHistory,
    exportToCSV,
    getStats,
  };
}
