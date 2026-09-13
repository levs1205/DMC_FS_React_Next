-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('STUDENT', 'ADMIN');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'STUDENT';

-- Data: el usuario del backoffice queda como ADMIN, el resto sigue en STUDENT.
UPDATE "user" SET "role" = 'ADMIN' WHERE "login" = 'admin@dmc.pe';

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" SERIAL NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_idx" ON "refresh_token"("user_id");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
