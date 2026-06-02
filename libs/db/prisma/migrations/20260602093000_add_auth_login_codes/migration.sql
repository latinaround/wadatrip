CREATE TABLE "auth_login_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'traveler',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,

    CONSTRAINT "auth_login_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_login_codes_email_created_at_idx" ON "auth_login_codes"("email", "created_at");
CREATE INDEX "auth_login_codes_expires_at_idx" ON "auth_login_codes"("expires_at");
CREATE INDEX "auth_login_codes_user_id_idx" ON "auth_login_codes"("user_id");

ALTER TABLE "auth_login_codes" ADD CONSTRAINT "auth_login_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
