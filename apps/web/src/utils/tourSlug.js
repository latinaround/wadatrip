export const slugify = (value) => {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
};

export const buildTourSlug = ({ title, city, id }) => {
  const parts = [slugify(title), slugify(city)].filter(Boolean);
  const base = parts.join('-') || 'tour';
  const suffix = id ? String(id).slice(-6) : '';
  return suffix ? `${base}-${suffix}` : base;
};

export const isLikelyListingId = (value) => {
  if (!value) return false;
  return /^c[a-z0-9]{10,}$/i.test(String(value));
};

export const findListingIdFromSlug = (slug, items = []) => {
  if (!slug) return null;
  if (isLikelyListingId(slug)) return slug;
  const suffix = String(slug).split('-').pop();
  if (!suffix) return null;
  const match = items.find((item) => String(item.id || '').endsWith(suffix));
  return match?.id || null;
};

export const buildTourCode = ({ city, id }) => {
  const cityCode = slugify(city).slice(0, 3).toUpperCase() || 'LOC';
  const suffix = id ? String(id).slice(-4).toUpperCase() : '0000';
  return `WADA-${cityCode}-${suffix}`;
};
