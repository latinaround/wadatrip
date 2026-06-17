export function isFreeTour(item) {
  return Array.isArray(item?.tags) && item.tags.includes('free_tour');
}

export function getListingPriceBadge(item, formatPrice) {
  return isFreeTour(item) ? 'Free walking tour' : formatPrice(item?.price_from, item?.currency || 'USD');
}

export function getListingBookingCta(item) {
  return isFreeTour(item) ? 'Join free tour' : 'Book and pay securely';
}

export function getListingShareCopy(item) {
  return isFreeTour(item)
    ? 'Share this link so travelers can open the tour and join without paying first.'
    : 'Share this link so travelers can open the tour and book it online.';
}
