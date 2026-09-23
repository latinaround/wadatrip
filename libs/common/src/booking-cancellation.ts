import { ConflictException, NotFoundException } from '@nestjs/common';
import { withPaymentBooking } from './payment-lifecycle';
import { bookingTransition, inventoryState } from './booking-transition';
import { cancellationDecision } from './booking-policy';
import { hasFinancialRisk } from './financial-state';
import { refreshCapacity } from './booking-capacity';
import { financialAudit } from './financial-audit';

export async function cancelPolicyBooking(prisma: any, id: string, actor: any) {
  const result = await withPaymentBooking(prisma, id, async (tx, booking) => {
    const traveler = actor.id === booking.user_id;
    const operator = actor.admin || (actor.verified && actor.id === booking.provider?.user_id);
    if (!traveler && !operator) throw new NotFoundException('booking not found');
    if (booking.cancellation_requested_at) return booking; // First decision/time is immutable across retries.
    if (booking.status === 'completed') throw new ConflictException('Completed bookings require support review');
    const decision = cancellationDecision(booking, traveler ? 'traveler' : 'operator');
    const payment = await tx.paymentRecord.findUnique({ where: { booking_id: id } });
    const next = { ...booking, ...decision };
    const transition = hasFinancialRisk(booking, payment) ? bookingTransition(next, payment, 'cancellation_requested')
      : { status: 'cancelled', financial: booking.payment_status, resolution: null, reason: null, inventory: 'RELEASE' };
    if (payment) await tx.paymentRecord.update({ where: { id: payment.id }, data: {
      status: transition.financial, resolution: transition.resolution, resolution_reason: transition.reason,
    } });
    const updated = await tx.bookings.update({ where: { id }, data: { ...decision, status: transition.status,
      ...(payment ? { payment_status: transition.financial === 'succeeded' ? 'paid' : transition.financial === 'pending' ? 'unpaid' : transition.financial } : {}),
      inventory_state: transition.inventory === 'RELEASE' ? 'released' : inventoryState(booking) } });
    await refreshCapacity(tx, booking);
    return updated;
  });
  financialAudit({ operation: 'policy_cancellation', booking_id: id, new_booking_state: result.status,
    inventory_action: result.inventory_state === 'released' ? 'RELEASE' : 'KEEP', result: 'committed' });
  return result;
}
