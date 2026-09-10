import { BadRequestException } from '@nestjs/common';

const MAX_DB_INT = 2147483647;

function usdCurrency(value: unknown): string {
  if (typeof value !== 'string' || value.trim().toUpperCase() !== 'USD') {
    throw new BadRequestException('A valid USD currency is required');
  }
  return 'usd';
}

// Parse the DB decimal exactly; never round a browser-supplied amount into a price.
function cents(value: any): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value == null ? '' : String(value));
  if (!match) throw new BadRequestException('Invalid canonical price');
  const amount = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
  if (amount > BigInt(MAX_DB_INT)) throw new BadRequestException('Canonical amount is too large');
  return Number(amount);
}

export function calculateBookingPrice(listing: any, people: unknown) {
  if (!listing) throw new BadRequestException('listing not found');
  if (!['published', 'approved'].includes(listing.status)) throw new BadRequestException('Listing is not bookable');
  const num_people = typeof people === 'number' || typeof people === 'string' ? Number(people) : NaN;
  if (!Number.isSafeInteger(num_people) || num_people < 1 || num_people > MAX_DB_INT) {
    throw new BadRequestException('num_people must be a positive integer');
  }
  const currency = usdCurrency(listing.currency);
  const taggedFree = Array.isArray(listing.tags) && listing.tags.includes('free_tour');
  // Existing free-tour listings store a null price; the DB tag supplies their zero-price semantics.
  const unitCents = cents(taggedFree && listing.price_from == null ? '0' : listing.price_from);
  if (taggedFree && unitCents !== 0) throw new BadRequestException('Free tour canonical price must be zero');
  const amount_cents = unitCents * num_people;
  if (!Number.isSafeInteger(amount_cents) || amount_cents > MAX_DB_INT) throw new BadRequestException('Booking amount is too large');
  const total_price = `${Math.floor(amount_cents / 100)}.${String(amount_cents % 100).padStart(2, '0')}`;
  return { num_people, total_price, amount_cents, currency };
}

export function validateBookingPrice(booking: any) {
  // Legacy totals were client-controlled. Fail closed if they cannot be corroborated by the DB listing.
  const canonical = calculateBookingPrice(booking.listing, booking.num_people);
  const amount = booking.amount_cents;
  const currency = usdCurrency(booking.currency);
  if (!Number.isSafeInteger(amount) || amount !== cents(booking.total_price)
    || amount !== canonical.amount_cents || currency !== canonical.currency) {
    throw new BadRequestException('Booking price no longer matches the listing; create a new booking');
  }
  return { amount, currency };
}
