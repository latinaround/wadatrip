import { BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Actor, requireVerified } from '@wadatrip/common/security';
import { lockedListing, available } from '@wadatrip/common/booking-capacity';
import { bookingTerms } from '@wadatrip/common/booking-policy';
import { calculateBookingPrice } from '@wadatrip/common/booking-price';

export const requestSelect = {
  id: true, listing_id: true, requested_date: true, num_people: true, status: true,
  response_date: true, responded_at: true, created_at: true,
  listing: { select: { title: true } },
} as const;

function futureDate(raw: unknown) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequestException('Choose a valid date');
  const day = new Date(`${raw}T00:00:00.000Z`);
  if (!Number.isFinite(+day) || day.toISOString().slice(0, 10) !== raw || raw < new Date().toISOString().slice(0, 10)) {
    throw new BadRequestException('Choose a valid date that is not in the past');
  }
  return day;
}

function assertPublic(listing: any) {
  if (!listing || !['published', 'approved'].includes(listing.status)) throw new NotFoundException('Tour not found');
}

export function requestScope(actor: Actor, scope: string) {
  if (scope !== 'operator') return { user_id: actor.id };
  requireVerified(actor);
  return actor.admin ? {} : { listing: { provider: { user_id: actor.id } } };
}

export async function createDateRequest(prisma: any, actor: Actor, body: any) {
  if (!actor.verified) throw new ForbiddenException('Verify your email with a sign-in code before requesting a date');
  const day = futureDate(body?.date);
  const people = body?.num_people;
  // Inquiry abuse bound, not inventory capacity or a promise of spots.
  if (!Number.isInteger(people) || people < 1 || people > 100) throw new BadRequestException('Request between 1 and 100 travelers');
  if (typeof body?.listing_id !== 'string' || !body.listing_id) throw new BadRequestException('Choose a tour');
  return prisma.$transaction(async (tx: any) => {
    // Serialize inquiries without blocking the KEY SHARE lock used by booking FKs.
    // FOR UPDATE here would deadlock a booking already holding the listing row.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id} FOR NO KEY UPDATE`;
    const listing = await lockedListing(tx, body.listing_id);
    assertPublic(listing);
    const existing = await tx.tour_date_requests.findUnique({ where: { traveler_listing_date_request: {
      user_id: actor.id, listing_id: listing.id, requested_date: day,
    } }, select: requestSelect });
    if (existing) {
      if (existing.num_people !== people || existing.status === 'cancelled') throw new ConflictException('A request already exists for this tour and date');
      return existing;
    }
    const count = await tx.tour_date_requests.count({ where: { user_id: actor.id, status: 'requested' } });
    if (count >= 20) throw new ConflictException('You have 20 pending requests. Close an existing request before sending another');
    return tx.tour_date_requests.create({ data: {
      user_id: actor.id, listing_id: listing.id, requested_date: day, num_people: people,
      notifications: { create: { audience: 'operator' } },
    }, select: requestSelect });
  }, { isolationLevel: 'ReadCommitted' });
}

export async function respondToDateRequest(prisma: any, actor: Actor, id: string, body: any) {
  requireVerified(actor);
  if (!['available', 'declined'].includes(body?.status)) throw new BadRequestException('Choose available or declined');
  return prisma.$transaction(async (tx: any) => {
    const initial = await tx.tour_date_requests.findUnique({ where: { id } });
    if (!initial) throw new NotFoundException('Request not found');
    const listing = await lockedListing(tx, initial.listing_id);
    const provider = await tx.providers.findUnique({ where: { id: listing.provider_id } });
    if (!actor.admin && provider?.user_id !== actor.id) throw new NotFoundException('Request not found');
    const request = await tx.tour_date_requests.findUnique({ where: { id } });
    const day = body.status === 'available' ? futureDate(body.date) : null;
    // A retry of the same terminal response is safe; a contradictory response is not.
    if (request.status !== 'requested') {
      if (request.status === body.status && String(request.response_date?.toISOString().slice(0, 10) || '') === String(body.status === 'available' ? body.date : '')) {
        return tx.tour_date_requests.findUnique({ where: { id }, select: requestSelect });
      }
      throw new ConflictException('This request has already been answered or closed');
    }
    if (day) {
      assertPublic(listing);
      calculateBookingPrice(listing, request.num_people);
      await available(tx, listing, day, request.num_people);
      if (bookingTerms(listing, body.date)?.bookings_open === false) throw new ConflictException('Reservations are closed for this departure');
    }
    // Deliberately no booking, payment or inventory writes. Availability can change.
    return tx.tour_date_requests.update({ where: { id }, data: {
      status: body.status, response_date: day, responded_at: new Date(),
      notifications: { create: { audience: 'traveler' } },
    }, select: requestSelect });
  }, { isolationLevel: 'ReadCommitted' });
}

export async function cancelDateRequest(prisma: any, actor: Actor, id: string) {
  return prisma.$transaction(async (tx: any) => {
    const initial = await tx.tour_date_requests.findUnique({ where: { id } });
    if (!initial || initial.user_id !== actor.id) throw new NotFoundException('Request not found');
    await lockedListing(tx, initial.listing_id);
    const request = await tx.tour_date_requests.findUnique({ where: { id } });
    if (request.status === 'cancelled') return tx.tour_date_requests.findUnique({ where: { id }, select: requestSelect });
    if (!['requested', 'available'].includes(request.status)) throw new ConflictException('This request is already closed');
    return tx.tour_date_requests.update({ where: { id }, data: { status: 'cancelled' }, select: requestSelect });
  }, { isolationLevel: 'ReadCommitted' });
}
