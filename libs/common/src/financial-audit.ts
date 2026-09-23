const FIELDS = [
  'booking_id', 'payment_record_id', 'processor', 'payment_intent_id', 'checkout_session_id', 'refund_id',
  'event_id', 'idempotency_key', 'operation', 'previous_booking_state', 'new_booking_state',
  'previous_payment_state', 'new_payment_state', 'inventory_action', 'expected_amount_cents',
  'expected_currency', 'observed_amount_cents', 'observed_currency', 'result', 'error_category',
] as const;

// Deliberately excludes raw errors, request/processor objects, metadata, users and secrets.
export function financialAudit(input: Record<string, unknown>) {
  const record: Record<string, unknown> = { event: 'wadatrip.financial', timestamp: new Date().toISOString() };
  for (const key of FIELDS) {
    const value = input[key];
    record[key] = value == null ? null : typeof value === 'number'
      ? (Number.isSafeInteger(value) && value >= 0 ? value : null)
      : typeof value === 'string' && /^[a-zA-Z0-9_:./-]{1,240}$/.test(value) && !value.includes('_secret_') ? value : '[redacted]';
  }
  // A logging sink failure must not turn an already committed payment into an API failure.
  try { console.info(JSON.stringify(record)); } catch { /* DB event remains the durable audit. */ }
}
