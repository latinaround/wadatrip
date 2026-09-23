import { financialState } from './financial-state';
import { ConflictException } from '@nestjs/common';

export function inventoryState(booking: any): 'held' | 'released' {
  if (booking.inventory_state === 'released' || booking.inventory_state === 'held') return booking.inventory_state;
  // Historical unknown/review states retain inventory. Never infer release from financial review.
  return ['cancelled', 'rejected'].includes(booking.status) ? 'released' : 'held';
}
export type BusinessEvent = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partial_refund'
  | 'cancellation_requested' | 'reconciliation_resolved' | 'financial_mismatch' | 'association_mismatch';

export function bookingTransition(booking: any, payment: any, event: BusinessEvent, capacityValid = false) {
  let status = booking.status, financial = financialState(payment?.status || booking.payment_status);
  if (event === 'reconciliation_resolved' && financial !== 'succeeded') {
    throw new ConflictException('Financial review cannot manufacture payment success');
  }
  let resolution = payment?.resolution || null, reason = payment?.resolution_reason || null;
  let inventory: 'KEEP' | 'HOLD' | 'RELEASE' = 'KEEP';
  const cancelled = ['cancelled', 'rejected', 'cancellation_pending'].includes(status) || reason === 'cancellation_requested';
  if (event === 'association_mismatch' || event === 'financial_mismatch') {
    status = 'reconciliation_required'; resolution = 'reconciliation_required'; reason = event;
  } else if (event === 'cancellation_requested') {
    if (status === 'cancelled' && inventoryState(booking) === 'released') return { status, financial, resolution, reason, inventory, notification: false };
    reason = 'cancellation_requested';
    if (financial === 'refunded' || (financial === 'failed' && payment?.flow)) { status = 'cancelled'; inventory = 'RELEASE'; resolution = null; }
    else if (financial === 'succeeded') {
      status = booking.cancellation_refund_due === false ? 'cancelled' : 'reconciliation_required';
      resolution = booking.cancellation_refund_due === false ? null : 'refund_required'; inventory = 'RELEASE';
    }
    else { status = 'cancellation_pending'; /* KEEP: no implicit reacquisition for historical cancelled rows. */ }
  } else if (event === 'refunded') {
    financial = 'refunded';
    if (reason === 'association_mismatch') { status = 'reconciliation_required'; }
    else { status = 'cancelled'; resolution = null; reason = null; inventory = 'RELEASE'; }
  } else if ((event === 'succeeded' || event === 'partial_refund' || event === 'reconciliation_resolved') && financial !== 'refunded') {
    financial = 'succeeded';
    if (cancelled) {
      status = booking.cancellation_refund_due === false ? 'cancelled' : 'reconciliation_required';
      resolution = booking.cancellation_refund_due === false ? null : 'refund_required';
      reason = 'cancellation_requested'; inventory = 'RELEASE';
    }
    else if (['association_mismatch', 'financial_mismatch', 'historical_ambiguity'].includes(reason)) { status = 'reconciliation_required'; }
    else if (!capacityValid || inventoryState(booking) !== 'held') {
      status = 'reconciliation_required'; resolution = 'refund_required'; reason = 'capacity_unavailable';
    } else {
      status = status === 'completed' ? 'completed' : 'confirmed';
      resolution = event === 'partial_refund' ? 'reconciliation_required' : null;
      reason = event === 'partial_refund' ? 'partial_refund' : null;
      if (payment?.resolution_reason === 'partial_refund' && event === 'succeeded') { resolution = payment.resolution; reason = 'partial_refund'; }
    }
  } else if (event === 'failed' && !['succeeded', 'refunded'].includes(financial)) {
    financial = 'failed';
    if (reason === 'association_mismatch') status = 'reconciliation_required';
    else { status = 'cancelled'; resolution = null; reason = null; inventory = 'RELEASE'; }
  }
  return { status, financial, resolution, reason, inventory,
    notification: (status === 'confirmed' && financial === 'succeeded' && booking.status !== 'confirmed')
      || (status === 'cancelled' && booking.status !== 'cancelled') };
}
