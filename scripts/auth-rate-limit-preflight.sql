-- READ ONLY. Run on an authorized existing Prisma database/copy, before migration.
-- A pre-existing table without a matching reviewed history requires investigation.
SELECT 'auth_request_limit_tables' AS metric, COUNT(*)::bigint AS count
FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_request_limits'
UNION ALL
SELECT 'unfinished_prisma_migrations', COUNT(*)::bigint
FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL
UNION ALL
SELECT 'auth_limit_migration_records', COUNT(*)::bigint
FROM "_prisma_migrations" WHERE migration_name = '20261026000000_auth_request_limits';
