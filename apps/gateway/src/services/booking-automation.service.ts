import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { financialAudit } from '@wadatrip/common/payment-lifecycle';
import { reconcileBookingPayment } from './booking-payment.service';
import { runAutomaticRefund } from './booking-refund.service';

@Injectable()
export class BookingAutomationService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;
  onModuleInit() {
    if (process.env.ENABLE_PAYMENT_AUTOMATION !== 'true') return;
    const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
    if (!key) throw new Error('Payment automation requires a configured processor');
    const stripe = new (require('stripe'))(key, { apiVersion: '2024-06-20', timeout: 20000, maxNetworkRetries: 1 });
    const tick = async () => {
      if (this.running || this.stopped) return;
      this.running = true;
      try { await processAutomationBatch(getPrisma(), stripe); }
      catch { financialAudit({ operation: 'automation_poll', result: 'retryable', error_category: 'automation_dependency_failure' }); }
      finally { this.running = false; }
    };
    this.timer = setInterval(tick, 30000); this.timer.unref(); void tick();
  }
  onModuleDestroy() { this.stopped = true; if (this.timer) clearInterval(this.timer); }
}

export async function processAutomationBatch(prisma: any, stripe: any) {
  const now = new Date();
  const rows = await prisma.paymentRecord.findMany({ where: {
    booking: { cancellation_requested_at: { not: null } },
    AND: [
      { OR: [{ status: 'pending', resolution: null }, { resolution: 'refund_required', refund_status: null }, { refund_status: { in: ['requested', 'processing', 'pending'] } }] },
      { OR: [{ refund_lease_until: null }, { refund_lease_until: { lte: now } }] },
      { OR: [{ refund_next_attempt_at: null }, { refund_next_attempt_at: { lte: now } }] },
    ],
  }, orderBy: { updated_at: 'asc' }, take: 25 });
  for (const row of rows) {
    try {
      const booking = await prisma.bookings.findUnique({ where: { id: row.booking_id } });
      if (booking?.status === 'cancellation_pending') await reconcileBookingPayment(prisma, stripe, row.booking_id);
      await runAutomaticRefund(prisma, stripe, row.booking_id);
    } catch { financialAudit({ operation: 'automation_booking', booking_id: row.booking_id, payment_record_id: row.id,
      result: 'retryable', error_category: 'automation_dependency_failure' }); }
  }
}
