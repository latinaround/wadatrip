-- Additive only: no historical rows are changed, copied or classified.
-- Keep ENABLE_COMMUNITY disabled until migration rehearsal, moderation and release review.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE "community_threads" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "country_code" VARCHAR(2) NOT NULL,
  "city" VARCHAR(100) NOT NULL,
  "region" VARCHAR(100) NOT NULL DEFAULT '',
  "destination_key" VARCHAR(64) NOT NULL,
  "kind" TEXT NOT NULL,
  "title" VARCHAR(140) NOT NULL,
  "message" VARCHAR(2000) NOT NULL,
  "commercial" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'open',
  "client_request_id" VARCHAR(36) NOT NULL,
  "public_notice_version" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "community_thread_status" CHECK (status IN ('open','resolved','hidden')),
  CONSTRAINT "community_thread_kind" CHECK (kind IN ('question','tip')),
  CONSTRAINT "community_thread_text" CHECK (char_length(trim(title)) BETWEEN 5 AND 140 AND char_length(trim(message)) BETWEEN 3 AND 2000),
  CONSTRAINT "community_thread_destination" CHECK (country_code ~ '^[A-Z]{2}$' AND destination_key ~ '^[0-9a-f]{64}$' AND (region = '' OR city <> '')),
  CONSTRAINT "community_thread_notice" CHECK (public_notice_version = 'public_community_v1'),
  CONSTRAINT "community_thread_request" CHECK (client_request_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
);
CREATE UNIQUE INDEX "community_threads_user_id_client_request_id_key" ON "community_threads"("user_id","client_request_id");
CREATE INDEX "community_threads_destination_key_status_created_at_id_idx" ON "community_threads"("destination_key","status","created_at","id");
CREATE INDEX "community_threads_country_code_status_created_at_id_idx" ON "community_threads"("country_code","status","created_at","id");
CREATE INDEX "community_threads_user_id_created_at_idx" ON "community_threads"("user_id","created_at");

CREATE TABLE "community_replies" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "thread_id" TEXT NOT NULL REFERENCES "community_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "message" VARCHAR(2000) NOT NULL,
  "commercial" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'visible',
  "helpful" BOOLEAN NOT NULL DEFAULT false,
  "client_request_id" VARCHAR(36) NOT NULL,
  "public_notice_version" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "community_reply_status" CHECK (status IN ('visible','hidden')),
  CONSTRAINT "community_reply_text" CHECK (char_length(trim(message)) BETWEEN 3 AND 2000),
  CONSTRAINT "community_reply_notice" CHECK (public_notice_version = 'public_community_v1'),
  CONSTRAINT "community_reply_request" CHECK (client_request_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
);
CREATE UNIQUE INDEX "community_replies_user_id_client_request_id_key" ON "community_replies"("user_id","client_request_id");
CREATE INDEX "community_replies_thread_id_status_created_at_id_idx" ON "community_replies"("thread_id","status","created_at","id");
CREATE INDEX "community_replies_user_id_created_at_idx" ON "community_replies"("user_id","created_at");
-- One selected answer per conversation, including during concurrent requests.
CREATE UNIQUE INDEX "community_replies_one_helpful" ON "community_replies"("thread_id") WHERE helpful;

CREATE TABLE "community_reports" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "thread_id" TEXT REFERENCES "community_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reply_id" TEXT REFERENCES "community_replies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolution" TEXT,
  "reviewed_by" TEXT REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_report_target" CHECK ((thread_id IS NULL) <> (reply_id IS NULL)),
  CONSTRAINT "community_report_reason" CHECK (reason IN ('spam','harassment','privacy','other')),
  CONSTRAINT "community_report_resolution" CHECK (
    (status = 'open' AND resolution IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status = 'resolved' AND resolution IS NOT NULL AND resolution IN ('hide','dismiss') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "community_reports_user_id_thread_id_key" ON "community_reports"("user_id","thread_id");
CREATE UNIQUE INDEX "community_reports_user_id_reply_id_key" ON "community_reports"("user_id","reply_id");
CREATE INDEX "community_reports_status_created_at_id_idx" ON "community_reports"("status","created_at","id");
CREATE INDEX "community_reports_user_id_created_at_idx" ON "community_reports"("user_id","created_at");

CREATE TABLE "community_blocks" (
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "blocked_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_blocks_pkey" PRIMARY KEY ("user_id","blocked_user_id"),
  CONSTRAINT "community_no_self_block" CHECK (user_id <> blocked_user_id)
);
CREATE INDEX "community_blocks_blocked_user_id_idx" ON "community_blocks"("blocked_user_id");
COMMIT;
