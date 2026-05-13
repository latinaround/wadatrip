ALTER TABLE "providers"
ADD COLUMN "user_id" TEXT;

UPDATE "providers" AS p
SET "user_id" = u."id"
FROM "users" AS u
WHERE p."user_id" IS NULL
  AND LOWER(p."email") = LOWER(u."email");

CREATE UNIQUE INDEX "providers_user_id_key" ON "providers"("user_id");
CREATE INDEX "idx_providers_user" ON "providers"("user_id");

ALTER TABLE "providers"
ADD CONSTRAINT "providers_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
