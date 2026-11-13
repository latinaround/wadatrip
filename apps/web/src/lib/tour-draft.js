// Public listing text only, scoped to the verified account and this browser tab.
export const TOUR_DRAFT_TTL = 24 * 60 * 60 * 1000;
const prefix = 'wadatrip:tour-draft:v1:';
const fields = {
  title: 300, category: 100, description: 20000, city: 200, country_code: 2,
  duration_minutes: 12, price_from: 16, currency: 3, start_date: 10, end_date: 10,
  timezone: 100, meeting_point: 2000, cancellation_policy: 8000,
  booking_cutoff_hours: 12, tags: 2000, cover_image_url: 2048,
};
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
function publicFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const clean = {};
  for (const [key, max] of Object.entries(fields)) {
    const value = input[key] ?? '';
    if (!['string', 'number'].includes(typeof value) || String(value).length > max) return null;
    clean[key] = String(value);
  }
  return clean;
}
export function tourDraftKey(ownerId) { return validId(ownerId) ? prefix + ownerId : null; }
export function tourDraftStorage() { try { return window.sessionStorage; } catch { return null; } }
export function readTourDraft(storage, ownerId, now = Date.now()) {
  const key = tourDraftKey(ownerId); if (!key) return null;
  try {
    const raw = storage.getItem(key); if (!raw || raw.length > 60000) return null;
    const entry = JSON.parse(raw), clean = publicFields(entry.fields);
    if (entry.version !== 1 || !clean || !Number.isFinite(entry.updatedAt)
      || entry.updatedAt > now + 60000 || now - entry.updatedAt >= TOUR_DRAFT_TTL
      || !(entry.editingId === null || validId(entry.editingId)) || typeof entry.isFreeTour !== 'boolean') return null;
    return { version: 1, updatedAt: entry.updatedAt, fields: clean, editingId: entry.editingId, isFreeTour: entry.isFreeTour };
  } catch { return null; }
}
export function writeTourDraft(storage, ownerId, form, editingId, isFreeTour, now = Date.now()) {
  const key = tourDraftKey(ownerId), clean = publicFields(form);
  if (!key || !clean || !(editingId === null || validId(editingId))) return false;
  try { storage.setItem(key, JSON.stringify({ version: 1, updatedAt: now, fields: clean, editingId, isFreeTour: Boolean(isFreeTour) })); return true; }
  catch { return false; }
}
export function clearTourDraft(storage, ownerId, editingId) {
  const entry = readTourDraft(storage, ownerId);
  if (!entry || entry.editingId !== editingId) return;
  try { storage.removeItem(tourDraftKey(ownerId)); } catch { /* Saving a server draft must not fail because local storage is unavailable. */ }
}

// Use the server's clock plus the local receipt time, rather than assuming the
// browser clock matches the server or that a reload resets the idle deadline.
export function sessionExpiryTime(session, observedAt) {
  const server = Date.parse(session?.server_time), idle = Date.parse(session?.idle_expires_at), absolute = Date.parse(session?.expires_at);
  if (![server, idle, absolute, observedAt].every(Number.isFinite)) return null;
  const remaining = Math.min(idle, absolute) - server;
  if (remaining > 8 * 60 * 60 * 1000) return null;
  return observedAt + remaining;
}
