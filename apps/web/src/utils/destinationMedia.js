const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

export const buildDestinationCoverKey = (city, countryCode) =>
  `${normalizeToken(city)}::${normalizeToken(countryCode)}`;

export function resolveListingImage(item, destinationCoverMap = {}) {
  if (!item) return null;
  if (item.cover_image_url) return item.cover_image_url;
  const key = buildDestinationCoverKey(item.city, item.country_code);
  return destinationCoverMap[key] || null;
}

export function resolveProviderAvatar(item) {
  if (!item) return null;
  return item.provider_photo_url || item.provider?.photo_url || null;
}

export async function fetchDestinationCoverMap(apiBase, listings) {
  const missing = new Map();

  for (const item of listings || []) {
    if (!item || item.cover_image_url) continue;
    const city = String(item.city || '').trim();
    if (!city) continue;
    const countryCode = String(item.country_code || '').trim().toUpperCase();
    const key = buildDestinationCoverKey(city, countryCode);
    if (!missing.has(key)) {
      missing.set(key, { city, countryCode });
    }
  }

  if (!missing.size) return {};

  const entries = await Promise.all(
    Array.from(missing.entries()).map(async ([key, value]) => {
      const params = new URLSearchParams();
      params.set('city', value.city);
      if (value.countryCode) params.set('country_code', value.countryCode);

      try {
        const response = await fetch(`${apiBase}/destination-covers/resolve?${params.toString()}`);
        const data = await response.json().catch(() => null);
        const imageUrl = data?.item?.image_url ? String(data.item.image_url) : null;
        return [key, imageUrl];
      } catch {
        return [key, null];
      }
    }),
  );

  return Object.fromEntries(entries.filter(([, imageUrl]) => imageUrl));
}
