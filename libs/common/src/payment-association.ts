import { ConflictException } from '@nestjs/common';

// Check both legacy booking references and the ledger. Database unique indexes
// arbitrate concurrent writes; this also detects ambiguous pre-migration history.
export async function assertPaymentOwnership(db: any, bookingId: string, refs: { intentId?: string; sessionId?: string }) {
  for (const id of [refs.intentId, refs.sessionId]) {
    if (id !== undefined && (typeof id !== 'string' || !id.trim())) throw new ConflictException('Empty external payment reference');
  }
  const pairs = [[refs.intentId, 'payment_intent_id'], [refs.sessionId, 'checkout_session_id']].filter(([id]) => id !== undefined);
  if (!pairs.length) return;
  for (const [table, prefix, owner] of [['paymentRecord', 'stripe_', 'booking_id'], ['bookings', '', 'id']]) {
    const rows = await db[table].findMany({ where: { OR: pairs.map(([id, key]) => ({ [prefix + key]: id })) },
      select: { [owner]: true, ...Object.fromEntries(pairs.map(([, key]) => [prefix + key, true])) } });
    if (rows.some((row: any) => row[owner] !== bookingId && pairs.some(([id, key]) => row[prefix + key] === id))) {
      throw new ConflictException('External payment reference has ambiguous ownership');
    }
  }
}
