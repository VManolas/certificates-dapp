// src/components/BlockExplorerLink.tsx
import { getTxExplorerUrl, getAddressExplorerUrl, hasBlockExplorer } from '@/lib/blockExplorer';
import { useChainId } from 'wagmi';

interface BlockExplorerLinkProps {
  hash: string;
  type: 'tx' | 'address';
  children?: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

export function BlockExplorerLink({
  hash,
  type,
  children,
  className = '',
  showIcon = true,
}: BlockExplorerLinkProps) {
  const chainId = useChainId();
  
  if (!hasBlockExplorer(chainId)) {
    return null;
  }

  const url = type === 'tx' 
    ? getTxExplorerUrl(hash, chainId)
    : getAddressExplorerUrl(hash, chainId);

  if (!url) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-primary-400 hover:text-primary-300 transition-colors ${className}`}
    >
      {children || (type === 'tx' ? 'View Transaction' : 'View Address')}
      {showIcon && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      )}
    </a>
  );
}
