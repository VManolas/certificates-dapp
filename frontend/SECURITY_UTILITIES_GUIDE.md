# Security Utilities Quick Reference

## Input Sanitization (`@/lib/sanitization`)

### Functions

#### `sanitizeString(input: string, maxLength?: number): string`
Removes dangerous characters and enforces length limits.
```typescript
const safe = sanitizeString(userInput, 500);
// Removes: null bytes, control characters
// Trims whitespace, enforces max length
```

#### `sanitizeAddress(address: string): 0x${string} | null`
Validates and sanitizes Ethereum addresses.
```typescript
const addr = sanitizeAddress('0x1234...');
if (!addr) {
  // Invalid address
}
```

#### `sanitizeMetadataUri(uri: string): string | null`
Validates URIs and prevents injection attacks.
```typescript
const uri = sanitizeMetadataUri('ipfs://...');
// Allows: ipfs://, https://, data:application/json
// Blocks: javascript:, data:text/html
```

#### `sanitizeCertificateMetadata(metadata: Record<string, unknown>): Record<string, string>`
Sanitizes certificate metadata object.
```typescript
const safe = sanitizeCertificateMetadata(userMetadata);
// Validates allowed keys, sanitizes values
```

#### `validateBigInt(value: bigint, min?: bigint, max?: bigint): boolean`
Ensures bigint values are within safe bounds.
```typescript
if (!validateBigInt(certId, 0n, 2n ** 256n - 1n)) {
  // Out of bounds
}
```

#### `validatePdfFile(file: File, maxSize?: number): { valid: boolean; error?: string }`
Validates PDF uploads with detailed error messages.
```typescript
const validation = validatePdfFile(file);
if (!validation.valid) {
  console.error(validation.error);
}
```

### RateLimiter Class

```typescript
import { globalRateLimiter } from '@/lib/sanitization';

// Check if action is allowed
if (!globalRateLimiter.isAllowed('certificate-issue')) {
  const remaining = globalRateLimiter.getRemainingAttempts('certificate-issue');
  alert(`Rate limit exceeded. Remaining: ${remaining}`);
  return;
}

// Reset rate limit for a key
globalRateLimiter.reset('certificate-issue');
```

**Configuration:**
- Default: 5 attempts per 60 seconds
- Window: 60000ms (1 minute)
- Per-key tracking

---

## Error Handling (`@/lib/errorHandling`)

### Error Types

```typescript
enum ErrorType {
  NETWORK,      // Network/fetch errors
  VALIDATION,   // Input validation errors
  CONTRACT,     // Smart contract errors
  PERMISSION,   // User rejected transactions
  TIMEOUT,      // Request timeouts
  UNKNOWN       // Other errors
}
```

### Functions

#### `parseError(error: unknown): ErrorResponse`
Extracts user-friendly error messages.
```typescript
try {
  await operation();
} catch (error) {
  const parsed = parseError(error);
  console.log(parsed.message);     // User-friendly message
  console.log(parsed.type);        // ErrorType enum
  console.log(parsed.retryable);   // Should retry?
  console.log(parsed.details);     // Technical details
}
```

**ErrorResponse:**
```typescript
interface ErrorResponse {
  type: ErrorType;
  message: string;      // User-friendly
  details?: string;     // Technical details
  recoverable: boolean; // Can user fix?
  retryable: boolean;   // Should auto-retry?
}
```

#### `withRetry<T>(operation: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T>`
Retries async operations with exponential backoff.
```typescript
const result = await withRetry(
  () => generatePDFHash(file),
  { 
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
    shouldRetry: (error) => error.retryable
  }
);
// Retry delays: 1s, 2s, 4s
```

**Default Config:**
```typescript
{
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  shouldRetry: (error) => error.retryable
}
```

#### `withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T>`
Wraps operation with timeout.
```typescript
const result = await withTimeout(
  longRunningOperation(),
  30000 // 30 seconds
);
```

#### `safeAsync<T>(operation: () => Promise<T>): Promise<{ data?: T; error?: ErrorResponse }>`
Safe wrapper that never throws.
```typescript
const { data, error } = await safeAsync(() => riskyOperation());
if (error) {
  console.error(error.message);
} else {
  console.log(data);
}
```

#### `debounce<T>(fn: T, delayMs: number): (...args) => void`
Debounces function calls.
```typescript
const debouncedSearch = debounce(searchFunction, 300);
// Only executes after 300ms of no calls
```

#### `throttle<T>(fn: T, limitMs: number): (...args) => void`
Throttles function calls.
```typescript
const throttledScroll = throttle(scrollHandler, 100);
// Executes at most once per 100ms
```

---

## Usage Examples

### Certificate Issuance with Full Protection

```typescript
import { sanitizeAddress, validatePdfFile, globalRateLimiter } from '@/lib/sanitization';
import { parseError, withRetry } from '@/lib/errorHandling';
import { logger } from '@/lib/logger';

async function issueCertificate(file: File, walletAddress: string) {
  // 1. Validate PDF
  const validation = validatePdfFile(file);
  if (!validation.valid) {
    logger.warn('PDF validation failed', { error: validation.error });
    throw new Error(validation.error);
  }

  // 2. Sanitize address
  const address = sanitizeAddress(walletAddress);
  if (!address) {
    logger.warn('Invalid wallet address', { walletAddress });
    throw new Error('Invalid Ethereum address');
  }

  // 3. Check rate limit
  if (!globalRateLimiter.isAllowed('certificate-issue')) {
    const remaining = globalRateLimiter.getRemainingAttempts('certificate-issue');
    logger.warn('Rate limit exceeded', { remaining });
    throw new Error(`Rate limit exceeded. Try again in ${60 - Math.floor(remaining)} seconds`);
  }

  // 4. Process with retry logic
  try {
    const hash = await withRetry(
      () => generatePDFHash(file),
      { maxAttempts: 2, delayMs: 1000 }
    );

    logger.userAction('Certificate issued', { hash, address });
    return hash;
  } catch (error) {
    const parsed = parseError(error);
    logger.error('Certificate issuance failed', error, {
      type: parsed.type,
      retryable: parsed.retryable
    });
    throw new Error(parsed.message);
  }
}
```

### Certificate Verification with Error Handling

```typescript
import { validatePdfFile, globalRateLimiter } from '@/lib/sanitization';
import { parseError, withRetry, withTimeout } from '@/lib/errorHandling';
import { logger } from '@/lib/logger';

async function verifyCertificate(file: File) {
  // 1. Validate PDF
  const validation = validatePdfFile(file, 15 * 1024 * 1024); // 15MB
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  // 2. Rate limiting
  if (!globalRateLimiter.isAllowed('certificate-verify')) {
    return { valid: false, error: 'Too many verification attempts' };
  }

  // 3. Generate hash with retry and timeout
  try {
    const hash = await withTimeout(
      withRetry(
        () => generatePDFHash(file),
        { maxAttempts: 2 }
      ),
      30000 // 30 second timeout
    );

    // 4. Verify on blockchain
    const result = await verifyCertificateOnChain(hash);
    logger.userAction('Certificate verified', { hash, valid: result.isValid });
    
    return { valid: result.isValid, certificateId: result.certificateId };
  } catch (error) {
    const parsed = parseError(error);
    logger.error('Certificate verification failed', error);
    return { valid: false, error: parsed.message };
  }
}
```

### Form Input Sanitization

```typescript
import { sanitizeString, sanitizeCertificateMetadata } from '@/lib/sanitization';

function handleFormSubmit(formData: FormData) {
  const metadata = {
    studentName: sanitizeString(formData.get('name'), 100),
    degree: sanitizeString(formData.get('degree'), 200),
    fieldOfStudy: sanitizeString(formData.get('field'), 200),
    graduationDate: sanitizeString(formData.get('date'), 50),
    gpa: sanitizeString(formData.get('gpa'), 10),
    additionalInfo: sanitizeString(formData.get('info'), 1000),
  };

  const sanitized = sanitizeCertificateMetadata(metadata);
  // All fields validated and sanitized
}
```

### Network Request with Retry

```typescript
import { withRetry, parseError } from '@/lib/errorHandling';
import { logger } from '@/lib/logger';

async function fetchInstitutionData(address: string) {
  try {
    const data = await withRetry(
      async () => {
        const response = await fetch(`/api/institutions/${address}`);
        if (!response.ok) throw new Error('Network request failed');
        return response.json();
      },
      {
        maxAttempts: 3,
        delayMs: 1000,
        shouldRetry: (error) => error.type === 'NETWORK'
      }
    );
    return data;
  } catch (error) {
    const parsed = parseError(error);
    logger.error('Failed to fetch institution data', error);
    throw new Error(parsed.message);
  }
}
```

---

## Testing Checklist

### Rate Limiting
- [ ] Attempt 6 rapid certificate issuances → 6th should fail
- [ ] Wait 60 seconds → rate limit should reset
- [ ] Attempt 6 rapid verifications → 6th should fail

### PDF Validation
- [ ] Upload .txt file → should reject
- [ ] Upload 15MB PDF → should reject (>10MB)
- [ ] Upload 0-byte file → should reject
- [ ] Upload valid 5MB PDF → should accept

### Address Validation
- [ ] Enter "invalid" → should reject
- [ ] Enter "  0x1234...  " → should trim and accept
- [ ] Enter "0xZZZZ..." → should reject (invalid hex)
- [ ] Enter "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" → should accept

### Error Handling
- [ ] Disconnect network → trigger action → should show network error
- [ ] Reject wallet transaction → should show "Transaction rejected"
- [ ] Invalid contract call → should show contract error
- [ ] Timeout operation → should show timeout error

### Retry Logic
- [ ] Network failure → should auto-retry up to 3 times
- [ ] Contract revert → should NOT retry
- [ ] Timeout → should retry
- [ ] User rejection → should NOT retry

---

## Common Patterns

### Safe Operation Wrapper
```typescript
const { data, error } = await safeAsync(async () => {
  const validated = validateInput(input);
  const sanitized = sanitizeInput(validated);
  return await processInput(sanitized);
});

if (error) {
  showError(error.message);
} else {
  showSuccess(data);
}
```

### Rate-Limited Button
```typescript
function handleClick() {
  if (!globalRateLimiter.isAllowed('my-action')) {
    const remaining = globalRateLimiter.getRemainingAttempts('my-action');
    toast.error(`Please wait. ${remaining} attempts remaining.`);
    return;
  }
  
  performAction();
}
```

### Validated Form Submission
```typescript
async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  
  // Validate all inputs
  const address = sanitizeAddress(walletInput);
  if (!address) {
    setError('Invalid wallet address');
    return;
  }
  
  const validation = validatePdfFile(fileInput);
  if (!validation.valid) {
    setError(validation.error);
    return;
  }
  
  // Check rate limit
  if (!globalRateLimiter.isAllowed('submit')) {
    setError('Too many submissions');
    return;
  }
  
  // Submit with retry
  try {
    await withRetry(() => submitForm({ address, file: fileInput }));
    setSuccess('Submitted successfully');
  } catch (error) {
    const parsed = parseError(error);
    setError(parsed.message);
  }
}
```

---

## Configuration

### Adjust Rate Limits
```typescript
import { RateLimiter } from '@/lib/sanitization';

// Create custom rate limiter
const strictLimiter = new RateLimiter(3, 300000); // 3 per 5 minutes

if (!strictLimiter.isAllowed('sensitive-action')) {
  // Blocked
}
```

### Customize Retry Behavior
```typescript
const result = await withRetry(
  operation,
  {
    maxAttempts: 5,           // Try up to 5 times
    delayMs: 2000,            // Start with 2 second delay
    backoffMultiplier: 1.5,   // 2s, 3s, 4.5s, 6.75s
    shouldRetry: (error) => {
      // Custom retry logic
      return error.type === 'NETWORK' && error.recoverable;
    }
  }
);
```

### Adjust Validation Limits
```typescript
// Custom PDF size limit (20MB)
const validation = validatePdfFile(file, 20 * 1024 * 1024);

// Custom string length
const safe = sanitizeString(input, 1000);
```
