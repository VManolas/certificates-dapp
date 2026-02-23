// src/components/VerificationReportPDF.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { getChainName } from '@/lib/blockExplorer';

interface VerificationReportPDFProps {
  certificateId: string;
  documentHash: string;
  studentWallet?: string; // Optional - controlled by privacy settings
  studentInitials?: string; // Optional - controlled by privacy settings
  institutionAddress: string;
  issueDate: Date;
  isValid: boolean;
  isRevoked: boolean;
  chainId: number;
  verificationUrl: string;
  universityName?: string;
  programName?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#1f2937',
  },
  header: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#4f46e5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: 140,
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  value: {
    flex: 1,
    fontSize: 10,
    color: '#1f2937',
  },
  urlBlock: {
    marginBottom: 8,
  },
  urlLine: {
    fontSize: 9,
    color: '#1f2937',
    fontFamily: 'Courier',
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 10,
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#10b981',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeRevoked: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  footer: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  disclaimer: {
    fontSize: 9,
    color: '#9ca3af',
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  timestamp: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 10,
  },
  privacyNotice: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  privacyText: {
    fontSize: 9,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 1.4,
  },
});

export function VerificationReportPDF({
  certificateId,
  documentHash,
  studentWallet,
  studentInitials,
  institutionAddress,
  issueDate,
  isValid,
  isRevoked,
  chainId,
  verificationUrl,
  universityName,
  programName,
}: VerificationReportPDFProps) {
  const now = new Date();
  const chainName = getChainName(chainId);
  const normalizedVerificationUrl = verificationUrl.replace('/veri-fy?', '/verify?');
  const [verificationBaseUrl, verificationQuery = ''] = normalizedVerificationUrl.split('?');
  const verificationQueryWithPrefix = verificationQuery ? `?${verificationQuery}` : '';
  const verificationQueryChunks = verificationQueryWithPrefix
    ? verificationQueryWithPrefix.match(/.{1,56}/g) || [verificationQueryWithPrefix]
    : [];
  
  // Only show student section if at least one piece of student info is provided
  const hasStudentInfo = Boolean(studentWallet) || Boolean(studentInitials);
  
  console.log('📄 PDF Generation - Privacy Check:', {
    studentWallet,
    studentInitials,
    hasStudentInfo,
    includeWalletInPDF: Boolean(studentWallet),
    includeInitialsInPDF: Boolean(studentInitials),
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>zkCredentials</Text>
          <Text style={styles.subtitle}>Certificate Verification Report</Text>
        </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, isRevoked ? styles.statusBadgeRevoked : {}]}>
          <Text style={styles.statusText}>
            {isRevoked ? '✗ REVOKED' : isValid ? '✓ VERIFIED' : '✗ INVALID'}
          </Text>
        </View>

        {/* Certificate Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CERTIFICATE INFORMATION</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>Certificate ID:</Text>
            <Text style={styles.value}>#{certificateId}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>
              {isRevoked ? 'Revoked' : isValid ? 'Valid and Active' : 'Invalid'}
            </Text>
          </View>

          {programName && (
            <View style={styles.row}>
              <Text style={styles.label}>Program:</Text>
              <Text style={styles.value}>{programName}</Text>
            </View>
          )}

          {universityName && (
            <View style={styles.row}>
              <Text style={styles.label}>University:</Text>
              <Text style={styles.value}>{universityName}</Text>
            </View>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>Issue Date:</Text>
            <Text style={styles.value}>
              {issueDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Document Hash:</Text>
            <Text style={styles.value}>{documentHash}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Issuing Institution:</Text>
            <Text style={styles.value}>{institutionAddress}</Text>
          </View>
        </View>

        {/* Student Information (Privacy Controlled) - Only shown if student shared info */}
        {hasStudentInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>STUDENT INFORMATION</Text>
            
            {studentInitials && (
              <View style={styles.row}>
                <Text style={styles.label}>Student Initials:</Text>
                <Text style={styles.value}>{studentInitials}</Text>
              </View>
            )}

            {studentWallet && (
              <View style={styles.row}>
                <Text style={styles.label}>Student Wallet:</Text>
                <Text style={styles.value}>{studentWallet}</Text>
              </View>
            )}

            <View style={styles.privacyNotice}>
              <Text style={styles.privacyText}>
                Note: This information was shared by the student with privacy controls.
              </Text>
            </View>
          </View>
        )}

        {/* Blockchain Proof */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BLOCKCHAIN PROOF</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>Network:</Text>
            <Text style={styles.value}>{chainName} (Chain ID: {chainId})</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Contract:</Text>
            <Text style={styles.value}>CertificateRegistry</Text>
          </View>

          <View style={styles.urlBlock}>
            <Text style={styles.label}>Verify Online:</Text>
            <Text style={styles.urlLine}>{verificationBaseUrl}</Text>
            {verificationQueryChunks.map((chunk, index) => (
              <Text key={`verification-url-chunk-${index}`} style={styles.urlLine}>
                {chunk}
              </Text>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.timestamp}>
            Report generated on {now.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })} at {now.toLocaleTimeString('en-US')}
          </Text>

          <Text style={styles.disclaimer}>
            This document is a verification report confirming the authenticity of a blockchain-stored
            educational credential. It is not the certificate itself. The credential data is permanently
            stored on the {chainName} blockchain and can be independently verified at any time using
            the document hash provided above.
          </Text>

          {!hasStudentInfo && (
            <View style={styles.privacyNotice}>
              <Text style={styles.privacyText}>
                Privacy Notice: Student personal information (wallet address, initials) was not included 
                in this report based on the selected privacy settings.
              </Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
