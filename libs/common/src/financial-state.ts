import { ConflictException } from '@nestjs/common';

export function financialState(value: unknown): 'pending' | 'succeeded' | 'failed' | 'refunded' {
  const state = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (state === 'paid' || state === 'succeeded') return 'succeeded';
  if (state === 'refunded') return 'refunded';
  if (state === 'failed') return 'failed';
  if (['', 'pending', 'unpaid', 'processing'].includes(state)) return 'pending';
  throw new ConflictException('Unknown historical payment state requires investigation');
}

export function hasFinancialRisk(booking: any, payment: any): boolean {
  return !!payment || booking.checkout_session_id != null || booking.payment_intent_id != null
    || ['payment_pending', 'cancellation_pending'].includes(booking.status)
    || !Number.isSafeInteger(booking.amount_cents) || booking.amount_cents < 0
    || (booking.amount_cents !== 0 && ['paid', 'succeeded', 'refunded'].includes(booking.payment_status))
    || (booking.amount_cents > 0 && ['confirmed', 'completed'].includes(booking.status));
}
