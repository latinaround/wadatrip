-- READ ONLY. No user identities, address keys or financial data are printed.
SELECT 'auth_request_limit_constraints' AS metric, COUNT(*)::bigint AS count
FROM pg_constraint WHERE conrelid = 'auth_request_limits'::regclass
UNION ALL
SELECT 'auth_request_limit_indexes', COUNT(*)::bigint
FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'auth_request_limits'
UNION ALL
SELECT 'invalid_auth_limit_rows', COUNT(*)::bigint
FROM "auth_request_limits" WHERE "key" !~ '^[a-f0-9]{64}$' OR attempts < 1 OR expires_at <= window_started_at
UNION ALL
SELECT 'expired_buckets_pending_cleanup', COUNT(*)::bigint
FROM "auth_request_limits" WHERE expires_at <= CURRENT_TIMESTAMP
UNION ALL
SELECT 'unfinished_prisma_migrations', COUNT(*)::bigint
FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;
