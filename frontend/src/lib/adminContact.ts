const DEFAULT_ADMIN_CONTACT_EMAIL = 'admin@zkcredentials.local';

export const ADMIN_CONTACT_EMAIL =
  (import.meta.env.VITE_ADMIN_CONTACT_EMAIL as string | undefined)?.trim() || DEFAULT_ADMIN_CONTACT_EMAIL;

export function withAdminContact(message: string): string {
  return `${message} Please contact the admin at: ${ADMIN_CONTACT_EMAIL}`;
}
