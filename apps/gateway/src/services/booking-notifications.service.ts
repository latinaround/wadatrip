import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '@wadatrip/db';
import { sendTransactionalEmail } from './email.service';

type Sender = typeof sendTransactionalEmail;

function audit(notification: any, result: string, reason?: string) {
  console.info(JSON.stringify({
    operation: 'booking_notification',
    booking_id: notification.booking_id,
    notification_id: notification.id,
    kind: notification.kind,
    audience: notification.audience,
    result,
    ...(reason ? { reason } : {}),
  }));
}

function paymentSucceeded(booking: any) {
  if (booking.amount_cents === 0) return booking.payment_status === 'paid';
  return ['paid', 'succeeded'].includes(String(booking.payment?.status || booking.payment_status || '').toLowerCase());
}

function notificationStillValid(booking: any, kind: string) {
  if (kind === 'confirmed') {
    return ['confirmed', 'completed'].includes(String(booking.status).toLowerCase())
      && booking.inventory_state === 'held'
      && paymentSucceeded(booking);
  }
  return kind === 'cancelled' && String(booking.status).toLowerCase() === 'cancelled';
}

function departureLabel(booking: any) {
  const departure = booking.booking_terms?.departure_at || booking.date;
  const timezone = booking.booking_terms?.timezone;
  const parsed = new Date(departure);
  if (!Number.isFinite(+parsed)) return String(departure || 'See booking details');
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium', timeStyle: booking.booking_terms?.departure_at ? 'short' : undefined,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(parsed) + (timezone ? ` (${timezone})` : '');
  } catch {
    return parsed.toISOString();
  }
}

function moneyLabel(booking: any) {
  const cents = booking.amount_cents;
  const currency = String(booking.currency || 'usd').toUpperCase();
  if (!Number.isSafeInteger(cents) || cents < 0) return 'See booking details';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function operatorEmail(booking: any) {
  const owner = booking.provider?.owner;
  return owner?.status === 'active' ? owner.email : '';
}

function cancellationPaymentLine(booking: any) {
  if (booking.amount_cents === 0) return 'Payment: no payment was required for this booking.';
  const payment = String(booking.payment?.status || booking.payment_status || '').toLowerCase();
  if (payment === 'refunded') return `Refund completed: ${moneyLabel(booking)}. The original payment method may take time to display it.`;
  if (booking.cancellation_refund_due === false) return 'Refund: no automatic refund is due under the accepted cancellation policy.';
  return 'Payment and refund status: review the booking in your Wadatrip account.';
}

function emailFor(notification: any, booking: any) {
  const title = booking.listing?.title || 'your experience';
  const accountUrl = 'https://www.wadatrip.com/account';
  const operatorUrl = 'https://www.wadatrip.com/operator/tours/new';
  const travelerName = booking.user?.name || 'Name not provided';
  const hostName = booking.provider?.name || 'your host';
  const common = `Tour: ${title}\nDate: ${departureLabel(booking)}\nTravelers: ${booking.num_people}\nBooking reference: ${booking.id}`;

  if (notification.kind === 'confirmed' && notification.audience === 'traveler') {
    return {
      to: booking.user?.status === 'active' ? booking.user.email : '',
      subject: `Wadatrip booking confirmed: ${title}`,
      text: `Your booking with ${hostName} is confirmed.\n\n${common}\nTotal: ${moneyLabel(booking)}\nMeeting point: ${booking.booking_terms?.meeting_point || booking.listing?.meeting_point || 'See your booking details'}\n\nView your trip: ${accountUrl}`,
    };
  }
  if (notification.kind === 'confirmed' && notification.audience === 'operator') {
    return {
      to: operatorEmail(booking),
      subject: `Wadatrip: new confirmed booking for ${title}`,
      text: `A booking is confirmed and its capacity remains reserved.\n\n${common}\nTraveler: ${travelerName}\nTotal: ${moneyLabel(booking)}\n\nOpen your operator dashboard: ${operatorUrl}`,
    };
  }
  if (notification.kind === 'cancelled' && notification.audience === 'traveler') {
    return {
      to: booking.user?.status === 'active' ? booking.user.email : '',
      subject: `Wadatrip booking cancelled: ${title}`,
      text: `Your booking has been cancelled.\n\n${common}\n${cancellationPaymentLine(booking)}\n\nView your booking: ${accountUrl}`,
    };
  }
  return {
    to: operatorEmail(booking),
    subject: `Wadatrip: booking cancelled for ${title}`,
    text: `A booking has been cancelled.\n\n${common}\nTraveler: ${travelerName}\n${cancellationPaymentLine(booking)}\n\nReview the final booking and payment state: ${operatorUrl}`,
  };
}

export async function sendBookingNotifications(prisma: any, send: Sender = sendTransactionalEmail) {
  const now = new Date();
  await prisma.booking_notifications.updateMany({ where: {
    status: 'pending', attempts: { gte: 5 }, OR: [{ lease_until: null }, { lease_until: { lte: now } }],
  }, data: { status: 'failed', last_error: 'attempts_exhausted', lease_until: null, claim_id: null } });

  const rows = await prisma.booking_notifications.findMany({ where: {
    status: 'pending', attempts: { lt: 5 }, next_attempt_at: { lte: now },
    OR: [{ lease_until: null }, { lease_until: { lte: now } }],
  }, orderBy: { created_at: 'asc' }, take: 10 });

  for (const row of rows) {
    const claim = randomUUID();
    const claimed = await prisma.booking_notifications.updateMany({ where: {
      id: row.id, status: 'pending', attempts: { lt: 5 }, next_attempt_at: { lte: now },
      OR: [{ lease_until: null }, { lease_until: { lte: now } }],
    }, data: { claim_id: claim, lease_until: new Date(+now + 120000), attempts: { increment: 1 } } });
    if (claimed.count !== 1) continue;

    const finish = (data: any) => prisma.booking_notifications.updateMany({
      where: { id: row.id, claim_id: claim }, data: { lease_until: null, claim_id: null, ...data },
    });
    let reason = 'notification_dependency_failure';
    try {
      const booking = await prisma.bookings.findUnique({ where: { id: row.booking_id }, include: {
        user: true, listing: true, payment: true, provider: { include: { owner: true } },
      } });
      if (!booking || !notificationStillValid(booking, row.kind)) {
        await finish({ status: 'skipped' }); audit(row, 'skipped'); continue;
      }
      const email = emailFor(row, booking);
      if (!email.to) reason = 'recipient_not_configured';
      else {
        const result = await send({ ...email, from: process.env.EMAIL_FROM || '',
          logScope: 'booking.notify', idempotencyKey: `booking-notification-${row.id}` });
        if (result.sent) {
          await finish({ status: 'sent', sent_at: new Date(), last_error: null });
          audit(row, 'sent'); continue;
        }
        reason = result.reason || 'email_failed';
      }
    } catch { /* Persist a safe category; never log message bodies, recipients or provider payloads. */ }
    const attempts = row.attempts + 1;
    await finish({ status: attempts >= 5 ? 'failed' : 'pending', last_error: reason,
      next_attempt_at: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** attempts)) });
    audit(row, attempts >= 5 ? 'failed' : 'retryable', reason);
  }
}

@Injectable()
export class BookingNotificationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  onModuleInit() {
    if (process.env.ENABLE_BOOKING_NOTIFICATIONS !== 'true') return;
    const tick = async () => {
      if (this.running) return;
      this.running = true;
      try { await sendBookingNotifications(getPrisma()); }
      catch { console.error(JSON.stringify({ operation: 'booking_notification_poll', result: 'retryable', reason: 'database_unavailable' })); }
      finally { this.running = false; }
    };
    this.timer = setInterval(tick, 60000); this.timer.unref(); void tick();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
