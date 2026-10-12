import { randomUUID } from 'node:crypto';

export type BookingNotificationKind = 'confirmed' | 'cancelled';

export async function enqueueBookingNotifications(
  tx: any,
  bookingId: string,
  kind: BookingNotificationKind,
  sourceEventId?: string,
) {
  return tx.booking_notifications.createMany({
    data: ['traveler', 'operator'].map((audience) => ({
      id: randomUUID(),
      booking_id: bookingId,
      kind,
      audience,
      ...(sourceEventId ? { source_event_id: sourceEventId } : {}),
    })),
    skipDuplicates: true,
  });
}
