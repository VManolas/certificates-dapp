// src/pages/admin/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { INSTITUTION_REGISTRY_ADDRESS } from '@/lib/wagmi';
import InstitutionRegistryABI from '@/contracts/abis/InstitutionRegistry.json';
import { truncateHash } from '@/lib/pdfHash';
import { ButtonWithLoading } from '@/components/LoadingSpinner';
import type { Institution } from '@/types';

interface InstitutionStats {
  totalRegistered: bigint;
  totalVerified: bigint;
  totalActive: bigint;
  totalSuspended: bigint;
}

export function AdminDashboard() {
  const { isConnected } = useAccount();
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Read institution stats from contract
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useReadContract({
    address: INSTITUTION_REGISTRY_ADDRESS!,
    abi: InstitutionRegistryABI.abi,
    functionName: 'getInstitutionStats',
    query: {
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
      staleTime: 0, // Always consider data stale
    },
  });

  // Read all institution addresses
  const { data: allInstitutionAddresses, isLoading: addressesLoading, refetch: refetchInstitutions } = useReadContract({
    address: INSTITUTION_REGISTRY_ADDRESS!,
    abi: InstitutionRegistryABI.abi,
    functionName: 'getAllInstitutions',
    query: {
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
      staleTime: 0, // Always consider data stale
    },
  });

  // Debug logging
  useEffect(() => {
    console.log('Stats data:', stats);
    console.log('All institutions:', allInstitutionAddresses);
  }, [stats, allInstitutionAddresses]);

  const institutionAddresses = (allInstitutionAddresses as `0x${string}`[]) || [];
  
  const filteredInstitutions = institutionAddresses.filter((address) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return address.toLowerCase().includes(term);
    }
    return true;
  });
  
  const isLoading = statsLoading || addressesLoading;
  
  const refetch = () => {
    refetchStats();
    refetchInstitutions();
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h1>
        <p className="text-surface-400">
          Please connect your admin wallet to access the dashboard.
        </p>
      </div>
    );
  }

  // Parse stats - handle both array and object formats
  const statsData = stats as InstitutionStats | readonly [bigint, bigint, bigint, bigint] | undefined;
  
  let totalRegistered = 0n;
  let totalVerified = 0n;
  let totalActive = 0n;
  let totalSuspended = 0n;

  if (statsData) {
    if (Array.isArray(statsData)) {
      // Handle array format
      [totalRegistered, totalVerified, totalActive, totalSuspended] = statsData;
    } else {
      // Handle object format
      totalRegistered = statsData.totalRegistered || 0n;
      totalVerified = statsData.totalVerified || 0n;
      totalActive = statsData.totalActive || 0n;
      totalSuspended = statsData.totalSuspended || 0n;
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-surface-400">
            Manage institutions and oversee the credential verification system
          </p>
        </div>
        <Link
          to="/admin/universities"
          className="btn-primary inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New University
        </Link>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-surface-400 mb-1">Total Institutions</div>
          <div className="text-3xl font-bold text-white">
            {statsLoading ? '...' : totalRegistered.toString()}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-surface-400 mb-1">Active</div>
          <div className="text-3xl font-bold text-accent-400">
            {statsLoading ? '...' : totalActive.toString()}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-surface-400 mb-1">Suspended</div>
          <div className="text-3xl font-bold text-red-400">
            {statsLoading ? '...' : totalSuspended.toString()}
          </div>
        </div>
      </div>

      {/* Institutions List */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-semibold text-white">Institutions</h2>
          
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search by address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-surface-800 border border-surface-700 rounded-lg text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <svg className="w-8 h-8 mx-auto mb-4 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-surface-400">Loading institutions...</p>
          </div>
        ) : filteredInstitutions.length === 0 ? (
          <div className="text-center py-8 text-surface-400">
            <p>
              {searchTerm 
                ? 'No institutions match your search criteria' 
                : 'No institutions registered yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInstitutions.map((address) => (
              <InstitutionRow
                key={address}
                address={address}
                isSelected={selectedInstitution === address}
                onSelect={() => setSelectedInstitution(
                  selectedInstitution === address ? null : address
                )}
                onActionComplete={() => refetch()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InstitutionRow({
  address,
  isSelected,
  onSelect,
  onActionComplete,
}: {
  address: `0x${string}`;
  isSelected: boolean;
  onSelect: () => void;
  onActionComplete: () => void;
}) {
  const queryClient = useQueryClient();
  
  // Fetch institution details
  const { data: institutionData, isLoading: dataLoading, refetch: refetchInstitution } = useReadContract({
    address: INSTITUTION_REGISTRY_ADDRESS!,
    abi: InstitutionRegistryABI.abi,
    functionName: 'getInstitution',
    args: [address],
    query: {
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
      staleTime: 0, // Always consider data stale
    },
  });

  const institution = institutionData as Institution | undefined;

  // Approve institution
  const { data: approveHash, writeContract: approve, isPending: isApproving } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Deactivate institution
  const { data: deactivateHash, writeContract: deactivate, isPending: isDeactivating } = useWriteContract();
  const { isLoading: isDeactivateConfirming, isSuccess: isDeactivateSuccess } = useWaitForTransactionReceipt({
    hash: deactivateHash,
  });

  // Reactivate institution
  const { data: reactivateHash, writeContract: reactivate, isPending: isReactivating } = useWriteContract();
  const { isLoading: isReactivateConfirming, isSuccess: isReactivateSuccess } = useWaitForTransactionReceipt({
    hash: reactivateHash,
  });

  // Refetch on success
  useEffect(() => {
    if (isApproveSuccess || isDeactivateSuccess || isReactivateSuccess) {
      // Invalidate all contract read queries to force refetch
      queryClient.invalidateQueries({ queryKey: ['readContract'] });
      
      // Refetch this specific institution's data
      refetchInstitution();
      
      // Notify parent to refetch stats
      onActionComplete();
    }
  }, [isApproveSuccess, isDeactivateSuccess, isReactivateSuccess, queryClient, refetchInstitution, onActionComplete]);

  const handleApprove = () => {
    approve({
      address: INSTITUTION_REGISTRY_ADDRESS!,
      abi: InstitutionRegistryABI.abi,
      functionName: 'approveInstitution',
      args: [address],
    });
  };

  const handleDeactivate = () => {
    deactivate({
      address: INSTITUTION_REGISTRY_ADDRESS!,
      abi: InstitutionRegistryABI.abi,
      functionName: 'suspendInstitution', // Fixed: was 'deactivateInstitution'
      args: [address],
    });
  };

  const handleReactivate = () => {
    reactivate({
      address: INSTITUTION_REGISTRY_ADDRESS!,
      abi: InstitutionRegistryABI.abi,
      functionName: 'reactivateInstitution',
      args: [address],
    });
  };

  const isLoading = isApproving || isApproveConfirming || isDeactivating || isDeactivateConfirming || isReactivating || isReactivateConfirming;

  if (dataLoading) {
    return (
      <div className="p-4 border border-surface-700 rounded-xl animate-pulse">
        <div className="h-4 bg-surface-700 rounded w-1/4" />
      </div>
    );
  }

  if (!institution) {
    return null;
  }

  return (
    <div className="border border-surface-700 rounded-xl overflow-hidden">
      <div className="p-4">
        <div
          className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onSelect}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
              <span className="text-primary-400 font-bold">
                {institution.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-white">{institution.name}</h3>
              <p className="text-sm text-surface-400">{institution.emailDomain}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!institution.isVerified ? (
              <span className="badge badge-info">Pending</span>
            ) : institution.isActive ? (
              <span className="badge badge-success">Active</span>
            ) : (
              <span className="badge badge-warning">Suspended</span>
            )}
            <svg
              className={`w-5 h-5 text-surface-400 transition-transform ${
                isSelected ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="p-4 border-t border-surface-700 bg-surface-800/30">
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <span className="text-surface-400">Wallet</span>
              <p className="text-white font-mono">{truncateHash(address, 8, 6)}</p>
            </div>
            <div>
              <span className="text-surface-400">Certificates Issued</span>
              <p className="text-white">{institution.totalCertificatesIssued.toString()}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {!institution.isVerified && (
              <ButtonWithLoading
                onClick={handleApprove}
                disabled={isLoading}
                isLoading={isApproving || isApproveConfirming}
                className="btn-primary flex-1 py-2 text-sm"
              >
                Approve Institution
              </ButtonWithLoading>
            )}
            {institution.isVerified && institution.isActive && (
              <ButtonWithLoading
                onClick={handleDeactivate}
                disabled={isLoading}
                isLoading={isDeactivating || isDeactivateConfirming}
                className="btn-secondary flex-1 py-2 text-sm border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              >
                Deactivate Institution
              </ButtonWithLoading>
            )}
            {institution.isVerified && !institution.isActive && (
              <ButtonWithLoading
                onClick={handleReactivate}
                disabled={isLoading}
                isLoading={isReactivating || isReactivateConfirming}
                className="btn-primary flex-1 py-2 text-sm"
              >
                Reactivate Institution
              </ButtonWithLoading>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
