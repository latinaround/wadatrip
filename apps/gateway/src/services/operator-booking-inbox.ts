import { NotFoundException } from '@nestjs/common';
import { Actor, requireVerified } from '@wadatrip/common/security';

const groups: Record<string, any> = {
  reservations: { OR: [
    { payment: { is: { processor_mode: 'live' } } },
    { amount_cents: 0, payment: { is: null } },
  ] },
  sandbox: { payment: { is: { processor_mode: 'test' } } },
  unverified: { OR: [
    { payment: { is: null }, OR: [{ amount_cents: null }, { amount_cents: { not: 0 } }] },
    { payment: { is: { OR: [{ processor_mode: null }, { processor_mode: { notIn: ['live', 'test'] } }] } } },
  ] },
};

export async function operatorBookingInbox(prisma: any, actor: Actor) {
  // An admin or traveler does not inherit another operator's inbox.
  const provider = await prisma.providers.findFirst({ where: { user_id: actor.id }, select: { id: true } });
  if (!provider) return { is_operator: false, groups: {} };
  requireVerified(actor);
  const result: Record<string, any> = {};
  await prisma.$transaction(async (tx: any) => {
    for (const [group, scope] of Object.entries(groups)) {
      const where = { status: 'confirmed', provider: { user_id: actor.id },
        operator_reviews: { none: { user_id: actor.id } }, AND: [scope] };
      const total = await tx.bookings.count({ where });
      const items = await tx.bookings.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 20,
        select: { id: true, date: true, created_at: true, num_people: true, amount_cents: true,
          currency: true, booking_terms: true, listing: { select: { title: true } } } });
      result[group] = { total, items: items.map((b: any) => ({
        id: b.id, title: b.listing?.title || 'Tour booking', date: b.date, created_at: b.created_at,
        travelers: b.num_people, amount_cents: b.amount_cents, currency: b.currency,
        departure_at: b.booking_terms?.departure_at || null, timezone: b.booking_terms?.timezone || null,
      })) };
    }
  }, { isolationLevel: 'RepeatableRead' });
  return { is_operator: true, groups: result };
}

export async function reviewOperatorBooking(prisma: any, actor: Actor, id: string) {
  requireVerified(actor);
  return prisma.$transaction(async (tx: any) => {
    const booking = await tx.bookings.findFirst({ where: { id, status: 'confirmed', provider: { user_id: actor.id } }, select: { id: true } });
    if (!booking) throw new NotFoundException('confirmed operator booking not found');
    // ON CONFLICT DO NOTHING is safe for simultaneous reviews from two devices.
    await tx.operator_booking_reviews.createMany({ data: [{ booking_id: id, user_id: actor.id }], skipDuplicates: true });
    const review = await tx.operator_booking_reviews.findUniqueOrThrow({
      where: { booking_id_user_id: { booking_id: id, user_id: actor.id } }, select: { reviewed_at: true },
    });
    return { booking_id: id, reviewed_at: review.reviewed_at };
  });
}
