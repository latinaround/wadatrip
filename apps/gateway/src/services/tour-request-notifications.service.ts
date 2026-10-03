import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getPrisma } from '@wadatrip/db';
import { sendTransactionalEmail } from './email.service';

type Sender = typeof sendTransactionalEmail;

// No email address, name, free text, token or raw provider response enters logs.
function audit(notification: any, result: string, reason?: string) {
  console.info(JSON.stringify({ operation: 'tour_request_notification', request_id: notification.request_id,
    notification_id: notification.id, audience: notification.audience, result, ...(reason ? { reason } : {}) }));
}

export async function sendRequestNotifications(prisma: any, send: Sender = sendTransactionalEmail) {
  const now = new Date();
  // A crash during the final attempt must not leave a permanently pending row.
  await prisma.tour_request_notifications.updateMany({ where: {
    status: 'pending', attempts: { gte: 5 }, OR: [{ lease_until: null }, { lease_until: { lte: now } }],
  }, data: { status: 'failed', last_error: 'attempts_exhausted', lease_until: null, claim_id: null } });
  const rows = await prisma.tour_request_notifications.findMany({ where: {
    status: 'pending', attempts: { lt: 5 }, next_attempt_at: { lte: now },
    OR: [{ lease_until: null }, { lease_until: { lte: now } }],
  }, orderBy: { created_at: 'asc' }, take: 10 });
  for (const row of rows) {
    const claim = randomUUID();
    const claimed = await prisma.tour_request_notifications.updateMany({ where: {
      id: row.id, status: 'pending', attempts: { lt: 5 }, next_attempt_at: { lte: now },
      OR: [{ lease_until: null }, { lease_until: { lte: now } }],
    }, data: { claim_id: claim, lease_until: new Date(+now + 120000), attempts: { increment: 1 } } });
    if (claimed.count !== 1) continue;
    const finish = (data: any) => prisma.tour_request_notifications.updateMany({
      where: { id: row.id, claim_id: claim }, data: { lease_until: null, claim_id: null, ...data },
    });
    let reason = 'notification_dependency_failure';
    try {
      const request = await prisma.tour_date_requests.findUnique({ where: { id: row.request_id }, include: {
        user: true, listing: { include: { provider: { include: { owner: true } } } },
      } });
      if (!request || request.status === 'cancelled' || (row.audience === 'operator' && request.status !== 'requested')) {
        await finish({ status: 'skipped' }); audit(row, 'skipped'); continue;
      }
      const owner = request.listing.provider.owner;
      const recipient = row.audience === 'traveler' ? (request.user.status === 'active' ? request.user.email : '')
        : owner?.status === 'active' ? owner.email : process.env.TOUR_REQUESTS_EMAIL;
      if (!recipient) reason = 'recipient_not_configured';
      else {
        const date = request.requested_date.toISOString().slice(0, 10);
        const response = request.response_date?.toISOString().slice(0, 10);
        const text = row.audience === 'operator'
          ? `A traveler requested ${date} for ${request.num_people} people on ${request.listing.title}.\nRequest: ${request.id}\nOpen Wadatrip > List your tour > Date requests to respond.\nThis is an inquiry, not a booking. No spots are reserved and no payment was taken.`
          : request.status === 'available'
            ? `The host offered ${response} for ${request.listing.title}. Open the tour on Wadatrip to review the current price, availability and terms before booking.\nNo spots are reserved and no payment was taken. Availability can change.`
            : `The host cannot offer the requested date for ${request.listing.title}. No booking was created and no payment was taken.`;
        // The outbox is committed before this external call. No long DB transaction.
        const result = await send({ to: recipient, from: process.env.EMAIL_FROM || '',
          subject: row.audience === 'operator' ? 'Wadatrip: new date request' : 'Wadatrip: update on your date request',
          text, logScope: 'tour_requests.notify', idempotencyKey: `tour-request-${row.id}` });
        if (result.sent) { await finish({ status: 'sent', sent_at: new Date(), last_error: null }); audit(row, 'sent'); continue; }
        reason = result.reason || 'email_failed';
      }
    } catch { /* Record a safe category, never a raw exception or payload. */ }
    const attempts = row.attempts + 1;
    await finish({ status: attempts >= 5 ? 'failed' : 'pending', last_error: reason,
      next_attempt_at: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** attempts)) });
    audit(row, attempts >= 5 ? 'failed' : 'retryable', reason);
  }
}

@Injectable()
export class TourRequestNotificationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  onModuleInit() {
    if (process.env.ENABLE_TOUR_DATE_REQUESTS !== 'true') return;
    const tick = async () => {
      if (this.running) return;
      this.running = true;
      try { await sendRequestNotifications(getPrisma()); }
      catch { console.error(JSON.stringify({ operation: 'tour_request_notification_poll', result: 'retryable', reason: 'database_unavailable' })); }
      finally { this.running = false; }
    };
    this.timer = setInterval(tick, 60000); this.timer.unref(); void tick();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
