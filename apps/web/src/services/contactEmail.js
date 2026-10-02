// Public business mailbox. Preparing a draft is not proof of email delivery.
export const SUPPORT_EMAIL = 'kiara@wadatrip.com';

export function buildContactEmail(subject, fields) {
  const body = Object.entries(fields)
    .filter(([, value]) => String(value || '').trim())
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join('\n\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
