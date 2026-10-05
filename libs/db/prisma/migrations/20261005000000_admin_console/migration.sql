-- Additive: never grant roles or modify historical business records.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
CREATE TABLE "admin_mfa" (
 "user_id" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE RESTRICT,
 "secret_encrypted" TEXT NOT NULL,
 "enabled_at" TIMESTAMP(3), "setup_expires_at" TIMESTAMP(3) NOT NULL,
 "last_counter" BIGINT NOT NULL DEFAULT -1 CHECK ("last_counter" >= -1),
 "failures" INTEGER NOT NULL DEFAULT 0 CHECK ("failures" >= 0),
 "locked_until" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" >= 1),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "admin_audit_log" (
 "id" TEXT PRIMARY KEY,
 "actor_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "action" TEXT NOT NULL, "resource_id" TEXT,
 "result" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "admin_audit_log_actor_id_created_at_idx" ON "admin_audit_log"("actor_id","created_at");
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at");
COMMIT;
