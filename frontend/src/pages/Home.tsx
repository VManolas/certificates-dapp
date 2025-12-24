// src/pages/Home.tsx
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuthStore } from '@/store/authStore';

export function Home() {
  const { isConnected } = useAccount();
  const { role } = useAuthStore();

  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-950/50 via-surface-950 to-accent-950/30" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
            <span className="text-sm text-primary-300">Powered by zkSync Era</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="gradient-text">Verify Educational</span>
            <br />
            <span className="text-white">Credentials On-Chain</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-surface-300 mb-10 max-w-2xl mx-auto">
            Tamper-proof certificate verification using zero-knowledge proofs. 
            Issue, verify, and manage academic credentials with blockchain security.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isConnected && role !== 'admin' ? (
              <Link to="/verify" className="btn-primary text-lg px-8 py-4">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Verify Certificate
              </Link>
            ) : !isConnected ? (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button onClick={openConnectModal} className="btn-primary text-lg px-8 py-4">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Connect Wallet
                  </button>
                )}
              </ConnectButton.Custom>
            ) : null}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="card glow">
            <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Tamper-Proof</h3>
            <p className="text-surface-400">
              Certificates are stored as cryptographic hashes on zkSync Era, making them impossible to forge or alter.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="card glow-accent">
            <div className="w-12 h-12 rounded-xl bg-accent-500/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Instant Verification</h3>
            <p className="text-surface-400">
              Verify any certificate in seconds by uploading the PDF. No accounts or sign-ups required.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="card">
            <div className="w-12 h-12 rounded-xl bg-surface-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Privacy-First</h3>
            <p className="text-surface-400">
              Only the document hash is stored on-chain. The actual certificate content remains private.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-white mb-12">How It Works</h2>
        
        <div className="grid md:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'Upload PDF', desc: 'University uploads certificate PDF' },
            { step: '02', title: 'Generate Hash', desc: 'SHA-256 hash is computed client-side' },
            { step: '03', title: 'Store On-Chain', desc: 'Hash is recorded on zkSync Era' },
            { step: '04', title: 'Verify Anytime', desc: 'Anyone can verify by re-hashing' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="text-5xl font-bold text-surface-700 mb-4">{item.step}</div>
              <h4 className="text-lg font-semibold text-white mb-2">{item.title}</h4>
              <p className="text-surface-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative container mx-auto px-4 py-16">
        <div className="card bg-gradient-to-r from-primary-900/50 to-accent-900/50 border-primary-500/20 text-center py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-surface-300 mb-8 max-w-xl mx-auto">
            Whether you're an educational institution, student, or employer, 
            zkCredentials makes credential verification simple and trustworthy.
          </p>
          {isConnected && role !== 'admin' ? (
            <Link to="/verify" className="btn-primary text-lg px-8 py-4 inline-flex">
              Start Verifying
            </Link>
          ) : !isConnected ? (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button onClick={openConnectModal} className="btn-primary text-lg px-8 py-4 inline-flex">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Connect Wallet to Get Started
                </button>
              )}
            </ConnectButton.Custom>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default Home;

