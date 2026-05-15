// frontend/vitest.setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Keep test output deterministic and compact.
// Opt out by setting VITEST_VERBOSE_LOGS=true.
if (process.env.VITEST_VERBOSE_LOGS !== 'true') {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}
