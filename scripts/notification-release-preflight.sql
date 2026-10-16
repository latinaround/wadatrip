-- Counts only. No recipients, message bodies, payment payloads or credentials.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SELECT jsonb_build_object(
  'total', count(*),
  'pending', count(*) FILTER (WHERE status = 'pending'),
  'pending_attempted', count(*) FILTER (WHERE status = 'pending' AND attempts > 0),
  'active_leases', count(*) FILTER (WHERE lease_until > now()),
  'failed', count(*) FILTER (WHERE status = 'failed'),
  'sent', count(*) FILTER (WHERE status = 'sent'),
  'skipped', count(*) FILTER (WHERE status = 'skipped'),
  'invalid_status', count(*) FILTER (WHERE status NOT IN ('pending', 'failed', 'sent', 'skipped'))
) FROM booking_notifications;
COMMIT;
