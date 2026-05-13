export const sanitizeWhatsAppNumber = (value) => {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits || null;
};

export const normalizeInstagramHandle = (value) => {
  const normalized = String(value || '').trim().replace(/^@+/, '');
  return normalized || null;
};

export const formatGuideRating = (rating, count) => {
  const value = Number(rating || 0);
  const total = Number(count || 0);
  if (!value) return 'New guide';
  return `${value.toFixed(1)}★ guide rating${total ? ` · ${total} reviews` : ''}`;
};

export const buildWhatsAppUrl = (phone, providerName, title) => {
  const normalized = sanitizeWhatsAppNumber(phone);
  if (!normalized) return null;
  const text = encodeURIComponent(`Hi ${providerName || 'guide'}, I'm interested in "${title || 'your tours'}" on WadaTrip.`);
  return `https://wa.me/${normalized}?text=${text}`;
};

export const buildInstagramUrl = (handle) => {
  const normalized = normalizeInstagramHandle(handle);
  return normalized ? `https://www.instagram.com/${normalized}/` : null;
};

export const buildGuideHref = (providerId) => {
  const id = String(providerId || '').trim();
  return id ? `/guides/${id}` : null;
};
