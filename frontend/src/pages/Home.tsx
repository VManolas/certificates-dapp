// src/pages/Home.tsx
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuthStore } from '@/store/authStore';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { AuthMethodSelector } from '@/components/AuthMethodSelector';
import { ZKAuthUpgrade } from '@/components/zkauth/ZKAuthUpgrade';

export function Home() {
  const { isConnected } = useAccount();
  const { role: storeRole } = useAuthStore();
  
  // Use unified auth for both ZK and Web3 login
  const unifiedAuth = useUnifiedAuth();

  // Debug logging
  console.log('Home - isConnected:', isConnected);
  console.log('Home - unifiedAuth:', unifiedAuth);

  // Show role from unified auth (could be ZK or Web3)
  const role = unifiedAuth.isAuthenticated ? unifiedAuth.role : storeRole;
  const userRoles = unifiedAuth.web3Auth;

  return (
    <div className="relative overflow-hidden">
      {/* Auth Method Selector Modal */}
      <AuthMethodSelector
        isOpen={unifiedAuth.showAuthMethodSelector}
        onClose={() => {
          // User can close without selecting, will be shown again on next connect
        }}
        onSelectMethod={unifiedAuth.selectAuthMethod}
        required={!unifiedAuth.authMethod} // Required if no method selected yet
      />

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
          <p className="text-lg md:text-xl text-surface-300 mb-4 max-w-2xl mx-auto">
            Tamper-proof certificate verification using zero-knowledge proofs. 
            Issue, verify, and manage academic credentials with blockchain security.
          </p>

          {/* User-Specific Role Description */}
          {isConnected && role && role !== 'admin' && (
            <p className="text-base md:text-lg font-medium mb-10 max-w-2xl mx-auto">
              {role === 'university' && userRoles.isUniversity && (
                <span className="text-accent-400">
                  You are an <span className="font-bold">Educational Institution</span> — issue and manage academic certificates for your students on the blockchain.
                </span>
              )}
              {role === 'student' && userRoles.isStudent && (
                <span className="text-blue-400">
                  You are a <span className="font-bold">Student</span> — view and manage your academic certificates issued by verified institutions.
                </span>
              )}
              {role === 'employer' && userRoles.isEmployer && (
                <span className="text-green-400">
                  You are an <span className="font-bold">Employer</span> — verify the authenticity of candidate credentials instantly and securely.
                </span>
              )}
            </p>
          )}

          {(!isConnected || role === 'admin') && (
            <div className="mb-10"></div>
          )}

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

      {/* User-Specific Welcome Section */}
      {isConnected && role && (
        <section className="relative container mx-auto px-4 pb-16">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* ZK Auth Upgrade Card - Only show for Web3 users */}
            {unifiedAuth.authMethod === 'web3' && <ZKAuthUpgrade variant="card" />}
            
            {/* ZK Auth Status Card - Show for ZK users */}
            {unifiedAuth.authMethod === 'zk' && (
              <div className="card bg-gradient-to-r from-primary-900/50 to-primary-700/30 border-primary-500/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white">Private Login Active</h4>
                      <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                        ✓ Authenticated
                      </span>
                    </div>
                    <p className="text-sm text-surface-300">
                      Your wallet address is hidden. You're using privacy-preserving authentication.
                    </p>
                  </div>
                  <button
                    onClick={() => unifiedAuth.switchAuthMethod('web3')}
                    className="btn-secondary text-sm"
                  >
                    Switch to Standard
                  </button>
                </div>
              </div>
            )}
            
            {/* Role-specific welcome card */}
            <div className="card bg-gradient-to-r from-primary-900/50 to-accent-900/50 border-primary-500/20 text-center py-8">
              {role === 'admin' && userRoles.isAdmin && (
                <>
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-primary-500/10 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Administrator</h3>
                    <p className="text-surface-300">
                      You can manage educational institutions, enabling or suspending their access to this credential verification system.
                    </p>
                  </div>
                  <Link to="/admin/dashboard" className="btn-primary inline-flex items-center gap-2 mt-4">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Admin
                  </Link>
                </>
              )}

              {role === 'university' && userRoles.isUniversity && (
                <>
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-accent-500/10 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Educational Institution</h3>
                    <p className="text-surface-300">
                      You can issue and manage academic certificates for your students on the blockchain.
                    </p>
                  </div>
                  <Link to="/university/dashboard" className="btn-primary inline-flex items-center gap-2 mt-4">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Dashboard
                  </Link>
                </>
              )}

              {role === 'student' && userRoles.isStudent && (
                <>
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Student</h3>
                    <p className="text-surface-300">
                      You can view and manage your academic certificates issued by verified institutions.
                    </p>
                  </div>
                  <Link to="/student/certificates" className="btn-primary inline-flex items-center gap-2 mt-4">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    My Certificates
                  </Link>
                </>
              )}

              {role === 'employer' && userRoles.isEmployer && (
                <>
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Employer</h3>
                    <p className="text-surface-300">
                      You can verify the authenticity of candidate credentials instantly and securely.
                    </p>
                  </div>
                  <Link to="/verify" className="btn-primary inline-flex items-center gap-2 mt-4">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Verify Credentials
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      )}

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

