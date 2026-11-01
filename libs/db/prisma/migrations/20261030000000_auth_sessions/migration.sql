-- Additive only. Abort rather than wait indefinitely for a live users lock.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "users" ADD COLUMN "auth_epoch" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reauth_after" TIMESTAMPTZ(3),
  ADD CONSTRAINT "users_auth_epoch_nonnegative" CHECK ("auth_epoch" >= 0);
CREATE TABLE "auth_sessions" (
  "id" TEXT PRIMARY KEY,
  "kind" VARCHAR(16) NOT NULL,
  "user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "credential_hash" VARCHAR(64) UNIQUE,
  "flow_hash" VARCHAR(64) UNIQUE,
  "generation" INTEGER NOT NULL DEFAULT 0 CHECK ("generation" >= 0),
  "user_epoch" INTEGER NOT NULL DEFAULT 0 CHECK ("user_epoch" >= 0),
  "auth_method" VARCHAR(16),
  "email_verified_at" TIMESTAMPTZ(3),
  "authenticated_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "revocation_reason" VARCHAR(32),
  CONSTRAINT "auth_sessions_kind" CHECK ("kind" IN ('web', 'native')),
  CONSTRAINT "auth_sessions_hashes" CHECK (("credential_hash" IS NULL OR "credential_hash" ~ '^[a-f0-9]{64}$') AND ("flow_hash" IS NULL OR "flow_hash" ~ '^[a-f0-9]{64}$')),
  CONSTRAINT "auth_sessions_state" CHECK (
    ("user_id" IS NULL AND "kind"='web' AND "flow_hash" IS NOT NULL AND "credential_hash" IS NULL AND "auth_method" IS NULL AND "authenticated_at" IS NULL AND "email_verified_at" IS NULL AND ("revoked_at" IS NOT NULL OR "generation"=0))
    OR ("user_id" IS NOT NULL AND "credential_hash" IS NOT NULL AND "generation">0 AND "auth_method" IS NOT NULL AND "auth_method" IN ('password','email_code','google','firebase') AND ("authenticated_at" IS NOT NULL OR "auth_method" IN ('google','firebase')))),
  CONSTRAINT "auth_sessions_native" CHECK ("kind"<>'native' OR ("user_id" IS NOT NULL AND "flow_hash" IS NULL)),
  CONSTRAINT "auth_sessions_time" CHECK ("expires_at">"created_at" AND "last_seen_at">="created_at"),
  CONSTRAINT "auth_sessions_revocation" CHECK (("revoked_at" IS NULL AND "revocation_reason" IS NULL) OR ("revoked_at" IS NOT NULL AND "revocation_reason" IS NOT NULL AND "revocation_reason" IN ('logout','logout_all','recovery','account_disabled')))
);
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id","revoked_at");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
-- Application rollback must preserve these tombstones/cutoffs, never un-revoke rows.
CREATE FUNCTION "auth_session_monotonic"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.generation < OLD.generation OR NEW.kind <> OLD.kind OR NEW.flow_hash IS DISTINCT FROM OLD.flow_hash
    OR (OLD.revoked_at IS NOT NULL AND (NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR NEW.credential_hash IS DISTINCT FROM OLD.credential_hash OR NEW.user_id IS DISTINCT FROM OLD.user_id))
    OR (OLD.kind='native' AND NEW.user_id IS DISTINCT FROM OLD.user_id)
    OR (NEW.credential_hash IS DISTINCT FROM OLD.credential_hash AND NEW.generation<=OLD.generation)
    OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.generation<=OLD.generation)
  THEN RAISE EXCEPTION 'Session security state cannot move backwards'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "auth_session_monotonic" BEFORE UPDATE ON "auth_sessions" FOR EACH ROW EXECUTE FUNCTION "auth_session_monotonic"();
CREATE FUNCTION "auth_user_epoch_monotonic"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.auth_epoch < OLD.auth_epoch OR (OLD.reauth_after IS NOT NULL AND (NEW.reauth_after IS NULL OR NEW.reauth_after<OLD.reauth_after))
  THEN RAISE EXCEPTION 'Authentication recovery state cannot move backwards'; END IF;
  IF (OLD.status='active' AND NEW.status<>'active') OR OLD.password_hash IS DISTINCT FROM NEW.password_hash OR OLD.email IS DISTINCT FROM NEW.email THEN
    NEW.auth_epoch := GREATEST(NEW.auth_epoch, OLD.auth_epoch+1);
    NEW.reauth_after := GREATEST(NEW.reauth_after, clock_timestamp());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "auth_user_epoch_monotonic" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "auth_user_epoch_monotonic"();
COMMIT;
