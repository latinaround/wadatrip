-- Additive: no existing identity, booking, financial or migration-history rows change.
-- Deploy explicitly before the new request-code handler. Missing protection fails closed.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE "auth_request_limits" (
  "key" CHAR(64) NOT NULL PRIMARY KEY,
  "window_started_at" TIMESTAMPTZ(3) NOT NULL,
  "attempts" INTEGER NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "auth_request_limit_key_valid" CHECK ("key" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "auth_request_limit_attempts_positive" CHECK ("attempts" > 0),
  CONSTRAINT "auth_request_limit_expiry_valid" CHECK ("expires_at" > "window_started_at")
);
CREATE INDEX "auth_request_limits_expires_at_idx" ON "auth_request_limits" ("expires_at");
COMMIT;
