// Explicit allowlists: new ORM fields must never silently become public API fields.
export const publicListingSelect = {
  id: true, provider_id: true, title: true, description: true, category: true,
  city: true, country_code: true, duration_minutes: true, price_from: true,
  currency: true, start_date: true, end_date: true, tags: true, status: true,
  cover_image_url: true, created_at: true,
} as const;

export const publicProviderSelect = {
  id: true, type: true, name: true, languages: true, base_city: true,
  country_code: true, ratings_avg: true, ratings_count: true, status: true,
  photo_url: true, instagram_handle: true, bio_short: true, verified_level: true,
} as const;

export const publicProviderDetailSelect = {
  ...publicProviderSelect,
  listings: { where: { status: { in: ['published', 'approved'] } }, select: publicListingSelect },
};

// Private administrative view. Never use this projection on public routes.
export const adminProviderDetailSelect = {
  ...publicProviderSelect,
  email: true, phone: true, created_at: true,
  documents: { select: { id: true, url: true, doc_type: true, status: true, notes: true } },
} as const;

function pickPublicFields(record: any, select: Record<string, unknown>): any {
  if (!record) return record;
  return Object.fromEntries(Object.keys(select).filter(key => select[key] === true && Object.hasOwn(record, key))
    .map(key => [key, record[key]]));
}

// Also project responses from a remote Hub; its ORM shape is not a public API contract.
export function toPublicListing(record: any) {
  const listing = pickPublicFields(record, publicListingSelect);
  if (listing && record.provider) listing.provider = pickPublicFields(record.provider, publicProviderSelect);
  return listing;
}

export function toPublicProvider(record: any) {
  const provider = pickPublicFields(record, publicProviderSelect);
  if (provider && Array.isArray(record.listings)) {
    provider.listings = record.listings.filter((listing: any) => ['published', 'approved'].includes(listing.status))
      .map(toPublicListing);
  }
  return provider;
}

export const safeUserSelect = { id: true, name: true, email: true } as const;
export const bookingSelect = {
  id: true, listing_id: true, trip_id: true, provider_id: true, user_id: true,
  status: true, date: true, num_people: true, total_price: true, amount_cents: true,
  currency: true, payment_status: true, checkout_session_id: true, payment_intent_id: true,
  created_at: true, listing: { select: publicListingSelect },
  provider: { select: publicProviderSelect }, user: { select: safeUserSelect },
} as const;

export function safeUser(user: any) {
  return { id: user.id, email: user.email, name: user.name, role: user.role,
    status: user.status, created_at: user.created_at, last_login_at: user.last_login_at };
}
