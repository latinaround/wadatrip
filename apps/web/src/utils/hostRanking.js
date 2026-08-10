const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getHostBadge(host) {
  if (host?.provider_badge) return host.provider_badge;
  const status = String(host?.provider_status || '').toLowerCase();
  const level = String(host?.provider_verified_level || '').toLowerCase();
  const verified = status === 'verified' || status === 'approved';
  if (verified && level === 'licensed') return 'Licensed guide';
  return verified ? 'Verified host' : null;
}

export function getHostTrustScore(host) {
  const apiScore = Number(host?.provider_trust_score);
  if (Number.isFinite(apiScore)) return apiScore;
  const badge = getHostBadge(host);
  const rating = Math.min(5, Math.max(0, numeric(host?.provider_ratings_avg)));
  const reviewCount = Math.max(0, numeric(host?.provider_ratings_count));
  return (badge === 'Licensed guide' ? 50 : badge ? 35 : 0) + rating * 4 + Math.min(10, Math.log10(reviewCount + 1) * 5);
}

export function sortHostsByTrust(hosts) {
  return [...hosts].sort((left, right) => {
    const scoreDifference = getHostTrustScore(right) - getHostTrustScore(left);
    if (scoreDifference !== 0) return scoreDifference;
    const ratingDifference = numeric(right?.provider_ratings_avg) - numeric(left?.provider_ratings_avg);
    if (ratingDifference !== 0) return ratingDifference;
    const reviewDifference = numeric(right?.provider_ratings_count) - numeric(left?.provider_ratings_count);
    if (reviewDifference !== 0) return reviewDifference;
    return numeric(left?.price_from) - numeric(right?.price_from);
  });
}