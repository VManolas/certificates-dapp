// src/lib/__tests__/adminContact.test.ts
import { describe, expect, it } from 'vitest';
import { ADMIN_CONTACT_EMAIL, withAdminContact } from '@/lib/adminContact';

describe('adminContact', () => {
  describe('ADMIN_CONTACT_EMAIL', () => {
    it('is a non-empty string', () => {
      expect(typeof ADMIN_CONTACT_EMAIL).toBe('string');
      expect(ADMIN_CONTACT_EMAIL.length).toBeGreaterThan(0);
    });

    it('falls back to the default local address when VITE_ADMIN_CONTACT_EMAIL is not set', () => {
      // In the test environment no VITE_ var is configured
      expect(ADMIN_CONTACT_EMAIL).toBe('admin@zkcredentials.local');
    });
  });

  describe('withAdminContact', () => {
    it('appends the admin contact email to the message', () => {
      const result = withAdminContact('Your institution is suspended.');
      expect(result).toContain('Your institution is suspended.');
      expect(result).toContain(ADMIN_CONTACT_EMAIL);
    });

    it('includes "Please contact the admin" wording', () => {
      expect(withAdminContact('Error occurred.')).toMatch(/please contact the admin/i);
    });

    it('does not drop empty messages', () => {
      const result = withAdminContact('');
      expect(result).toContain(ADMIN_CONTACT_EMAIL);
    });
  });
});
