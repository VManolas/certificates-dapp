// src/lib/qrCode.ts
import type { QRCodePayload, PrivacySettings, Certificate } from '@/types/certificate';

/**
 * Generate a privacy-controlled QR code payload for certificate sharing
 * 
 * Format: V1:{base64(json)}
 * 
 * @param certificate - The certificate to share
 * @param universityName - Name of the issuing university
 * @param privacySettings - Privacy settings controlling what to include
 * @returns Encoded QR code string
 */
export function generateQRCodePayload(
  certificate: Partial<Certificate>,
  universityName: string,
  privacySettings: PrivacySettings
): string {
  console.log('🔍 generateQRCodePayload called with:', { certificate, universityName, privacySettings });
  
  // Parse metadataURI to extract program name
  let programName = 'Unknown Program';
  if (certificate.metadataURI) {
    try {
      const metadata = JSON.parse(certificate.metadataURI);
      programName = metadata.program || certificate.metadataURI;
      console.log('✅ Parsed program from metadata:', programName);
    } catch {
      // If parsing fails, use metadataURI as-is (might be a plain string)
      programName = certificate.metadataURI;
      console.log('ℹ️ Using metadataURI as program name:', programName);
    }
  }
  
  // Build payload with always-included fields
  const payload: QRCodePayload = {
    program: programName,
    university: universityName,
    graduationYear: certificate.graduationYear || new Date().getFullYear(),
    status: certificate.isRevoked ? 'Revoked' : 'Verified',
    version: '1.0',
    generatedAt: Date.now(),
  };

  // Add optional fields based on privacy settings
  if (privacySettings.includeWallet && certificate.studentWallet) {
    payload.studentWallet = certificate.studentWallet;
    console.log('✅ Including wallet:', certificate.studentWallet);
  }

  if (privacySettings.includeInitials && privacySettings.initials) {
    payload.studentInitials = privacySettings.initials;
    console.log('✅ Including initials:', privacySettings.initials);
  }

  console.log('📦 Final payload:', payload);

  // Encode as V1:{base64(json)}
  const jsonString = JSON.stringify(payload);
  const base64Encoded = btoa(jsonString);
  const encoded = `V1:${base64Encoded}`;
  
  console.log('🎫 Encoded QR code data (length:', encoded.length, '):', encoded.substring(0, 50) + '...');
  
  return encoded;
}

/**
 * Decode a QR code payload
 * 
 * @param encoded - Encoded QR code string (V1:{base64})
 * @returns Decoded payload
 */
export function decodeQRCodePayload(encoded: string): QRCodePayload {
  // Check for V1 format
  if (!encoded.startsWith('V1:')) {
    throw new Error('Unsupported QR code version');
  }

  try {
    const base64Part = encoded.substring(3); // Remove 'V1:' prefix
    const jsonString = atob(base64Part);
    const payload = JSON.parse(jsonString) as QRCodePayload;
    
    // Validate required fields
    if (!payload.program || !payload.university || !payload.graduationYear || !payload.status) {
      throw new Error('Invalid QR code payload: missing required fields');
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid QR code')) {
      throw error;
    }
    throw new Error('Failed to decode QR code: invalid format');
  }
}

/**
 * Validate QR code payload structure
 */
export function isValidQRCodePayload(payload: unknown): payload is QRCodePayload {
  if (typeof payload !== 'object' || payload === null) return false;
  
  const p = payload as Partial<QRCodePayload>;
  
  return (
    typeof p.program === 'string' &&
    typeof p.university === 'string' &&
    typeof p.graduationYear === 'number' &&
    (p.status === 'Verified' || p.status === 'Revoked') &&
    typeof p.version === 'string' &&
    typeof p.generatedAt === 'number'
  );
}

/**
 * Get QR code size based on payload complexity
 */
export function getQRCodeSize(payload: QRCodePayload): number {
  const encoded = `V1:${btoa(JSON.stringify(payload))}`;
  const length = encoded.length;
  
  // Adjust size based on content length
  if (length > 200) return 256;
  if (length > 150) return 224;
  return 200; // Default size
}
