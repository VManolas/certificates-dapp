// src/components/VerificationReportPDF.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { getChainName } from '@/lib/blockExplorer';

interface VerificationReportPDFProps {
  certificateId: string;
  documentHash: string;
  studentWallet: string;
  institutionAddress: string;
  issueDate: Date;
  isValid: boolean;
  isRevoked: boolean;
  chainId: number;
  verificationUrl: string;
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
});

export function VerificationReportPDF({
  certificateId,
  documentHash,
  studentWallet,
  institutionAddress,
  issueDate,
  isValid,
  isRevoked,
  chainId,
  verificationUrl,
}: VerificationReportPDFProps) {
  const now = new Date();
  const chainName = getChainName(chainId);

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
            <Text style={styles.label}>Student Wallet:</Text>
            <Text style={styles.value}>{studentWallet}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Issuing Institution:</Text>
            <Text style={styles.value}>{institutionAddress}</Text>
          </View>
        </View>

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

          <View style={styles.row}>
            <Text style={styles.label}>Verify Online:</Text>
            <Text style={styles.value}>{verificationUrl}</Text>
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
        </View>
      </Page>
    </Document>
  );
}
