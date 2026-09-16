import { BadRequestException, ConflictException } from '@nestjs/common';
import { calculateBookingPrice } from './booking-price';
import { financialState, hasFinancialRisk } from './financial-state';
import { bookingTransition, inventoryState } from './booking-transition';
import { financialAudit } from './financial-audit';

const CONSUMING = ['pending', 'confirmed', 'completed'];
const RELEASED = ['cancelled', 'rejected'];
const DAY_MS = 86400000;

function dayOf(raw: any): Date {
  if (raw instanceof Date && !Number.isFinite(+raw)) throw new BadRequestException('Invalid booking date');
  const text = raw instanceof Date ? raw.toISOString() : raw;
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$)/.test(text)) {
    throw new BadRequestException('Invalid booking date');
  }
  const calendarDay = new Date(`${text.slice(0, 10)}T00:00:00.000Z`);
  const instant = new Date(text);
  if (!Number.isFinite(+instant) || !Number.isFinite(+calendarDay) || calendarDay.toISOString().slice(0, 10) !== text.slice(0, 10)) {
    throw new BadRequestException('Invalid booking date');
  }
  return new Date(`${instant.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function futureDay(raw: any) {
  const day = dayOf(raw);
  const today = dayOf(new Date());
  if (day < today) throw new BadRequestException('Booking date is in the past');
  return day;
}

export async function lockedListing(tx: any, id: string) {
  // Every booking creation/status change locks the same row before reading occupancy.
  const rows = await tx.$queryRaw`SELECT id FROM listings WHERE id = ${id} FOR UPDATE`;
  if (!rows.length) throw new BadRequestException('listing not found');
  return tx.listings.findUnique({ where: { id } });
}

async function slotForDay(tx: any, listingId: string, day: Date) {
  const end = new Date(+day + DAY_MS);
  const slots = await tx.$queryRaw`SELECT id, date, spots_total FROM listing_availability
    WHERE listing_id = ${listingId} AND date >= ${day} AND date < ${end} FOR UPDATE`;
  if (slots.length !== 1) throw new ConflictException('Date unavailable: one confirmed availability entry is required for this day');
  const slot = slots[0];
  if (!Number.isInteger(slot.spots_total) || slot.spots_total < 0) throw new ConflictException('Date unavailable: invalid capacity');
  return slot;
}

export async function occupied(tx: any, listingId: string, day: Date, excludeId?: string) {
  const result = await tx.bookings.aggregate({
    where: { listing_id: listingId, date: { gte: day, lt: new Date(+day + DAY_MS) },
      // Unknown historical statuses conservatively retain their seats.
      OR: [{ inventory_state: 'held' }, { inventory_state: null, status: { notIn: RELEASED } }],
      ...(excludeId ? { id: { not: excludeId } } : {}) },
    _sum: { num_people: true },
    _min: { num_people: true },
  });
  const used = result._sum.num_people ?? 0;
  if (!Number.isSafeInteger(used) || used < 0 || (result._min?.num_people != null && result._min.num_people < 1)) throw new ConflictException('Date unavailable: invalid existing occupancy');
  return used;
}

export async function available(tx: any, listing: any, date: any, people: number, excludeId?: string, settling = false) {
  if (!listing || (!settling && !['published', 'approved'].includes(listing.status))) throw new ConflictException('Listing is not bookable');
  if (!Number.isSafeInteger(people) || people < 1) throw new BadRequestException('Invalid traveler count');
  const day = settling ? dayOf(date) : futureDay(date);
  if (!settling && ((listing.start_date && day < dayOf(listing.start_date)) || (listing.end_date && day > dayOf(listing.end_date)))) {
    throw new ConflictException('Date unavailable: outside the listing dates');
  }
  const slot = await slotForDay(tx, listing.id, day);
  const used = await occupied(tx, listing.id, day, excludeId);
  if (people > slot.spots_total - used) throw new ConflictException('Not enough spots for this traveler count');
  return { day, slot, remaining: slot.spots_total - used - people };
}

export async function createCapacityBooking(prisma: any, actor: { id: string }, body: any) {
  if (!body?.listing_id) throw new BadRequestException('listing_id is required');
  return prisma.$transaction(async (tx: any) => {
    const listing = await lockedListing(tx, String(body.listing_id));
    const price = calculateBookingPrice(listing, body.num_people);
    const allocation = await available(tx, listing, body.date, price.num_people);
    const tripId = body.trip_id ? String(body.trip_id) : null;
    if (tripId) {
      const trip = await tx.trips.findUnique({ where: { id: tripId } });
      if (!trip || trip.user_id !== actor.id) throw new BadRequestException('trip does not belong to traveler');
    }
    const created = await tx.bookings.create({ data: {
      listing_id: listing.id, provider_id: listing.provider_id, user_id: actor.id,
      ...(tripId ? { trip_id: tripId } : {}), date: allocation.day, ...price,
      status: price.amount_cents === 0 ? 'confirmed' : 'pending',
      payment_status: price.amount_cents === 0 ? 'paid' : 'unpaid',
      inventory_state: 'held',
    } });
    await tx.listing_availability.update({ where: { id: allocation.slot.id }, data: { spots_available: allocation.remaining } });
    return { created, listing };
  }, { isolationLevel: 'ReadCommitted' });
}

export async function updateCapacityBooking(prisma: any, id: string, changes: { status?: string; payment_status?: string }) {
  let audit: Record<string, unknown> | undefined;
  const result = await prisma.$transaction(async (tx: any) => {
    const initial = await tx.bookings.findUnique({ where: { id } });
    if (!initial) throw new BadRequestException('booking not found');
    const listing = await lockedListing(tx, initial.listing_id);
    const booking = await tx.bookings.findUnique({ where: { id } });
    const nextStatus = changes.status || booking.status;
    if (nextStatus === 'cancelled' && RELEASED.includes(booking.status) && !changes.payment_status) return booking;
    // Payment lifecycle owns paid bookings once an external operation may exist.
    // This also protects legacy bookings whose external IDs predate PaymentRecord.
    const payment = await tx.paymentRecord.findUnique({ where: { booking_id: id } });
    if (hasFinancialRisk(booking, payment)) {
      if (changes.payment_status) throw new ConflictException('Use the payment lifecycle');
      if (nextStatus === 'cancelled') {
        const transition = bookingTransition(booking, payment, 'cancellation_requested');
        audit = { booking_id: id, payment_record_id: payment?.id, processor: payment?.processor,
          payment_intent_id: payment?.stripe_payment_intent_id || booking.payment_intent_id,
          checkout_session_id: payment?.stripe_checkout_session_id || booking.checkout_session_id,
          operation: 'cancellation_requested', previous_booking_state: booking.status, new_booking_state: transition.status,
          previous_payment_state: payment?.status || booking.payment_status, new_payment_state: transition.financial,
          inventory_action: transition.inventory, expected_amount_cents: payment?.amount_gross_cents ?? booking.amount_cents,
          expected_currency: payment?.currency || booking.currency, result: 'committed' };
        if (payment) await tx.paymentRecord.update({ where: { id: payment.id }, data: { status: transition.financial, resolution: transition.resolution, resolution_reason: transition.reason } });
        const updated = await tx.bookings.update({ where: { id }, data: { status: transition.status,
          inventory_state: transition.inventory === 'RELEASE' ? 'released' : inventoryState(booking) } });
        await refreshCapacity(tx, booking);
        return updated;
      }
      if (nextStatus === 'completed' && booking.status === 'confirmed' && booking.payment_status === 'paid') {
        return tx.bookings.update({ where: { id }, data: { status: 'completed' } });
      }
      if (nextStatus === booking.status && !changes.payment_status) return booking;
      throw new ConflictException('Booking state is managed by the payment lifecycle');
    }
    if (booking.amount_cents > 0 && ['confirmed', 'completed'].includes(nextStatus)) throw new ConflictException('Payment must succeed before confirmation');
    if (!CONSUMING.includes(nextStatus) && !RELEASED.includes(nextStatus)) throw new BadRequestException('invalid status');
    if (CONSUMING.includes(nextStatus) && RELEASED.includes(booking.status)) {
      // Reactivation, including late payment events, must reacquire seats.
      await available(tx, listing, booking.date, booking.num_people, id);
    }
    const updated = await tx.bookings.update({ where: { id }, data: { ...changes,
      inventory_state: RELEASED.includes(nextStatus) ? 'released' : 'held' } });
    await refreshCapacity(tx, booking);
    return updated;
  }, { isolationLevel: 'ReadCommitted' });
  if (audit) financialAudit(audit);
  return result;
}

export async function refreshCapacity(tx: any, booking: any) {
  const day = dayOf(booking.date);
  const slots = await tx.listing_availability.findMany({ where: { listing_id: booking.listing_id, date: { gte: day, lt: new Date(+day + DAY_MS) } } });
  if (slots.length === 1) {
    const used = await occupied(tx, booking.listing_id, day);
    await tx.listing_availability.update({ where: { id: slots[0].id }, data: { spots_available: Math.max(0, slots[0].spots_total - used) } });
  }
}

export async function requireReservedCapacity(prisma: any, id: string) {
  return prisma.$transaction(async (tx: any) => {
    const initial = await tx.bookings.findUnique({ where: { id } });
    if (!initial) throw new BadRequestException('booking not found');
    const listing = await lockedListing(tx, initial.listing_id);
    const booking = await tx.bookings.findUnique({ where: { id } });
    if (!['pending', 'confirmed'].includes(booking.status)) throw new ConflictException('Booking is not reserved for payment');
    await available(tx, listing, booking.date, booking.num_people, id);
  }, { isolationLevel: 'ReadCommitted' });
}
