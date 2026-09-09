-- AlterEnum
-- Dos estados nuevos para la reserva: los escribe unicamente el modulo de
-- pagos cuando Mercado Pago confirma (PAID) o rechaza (PAYMENT_FAILED).
ALTER TYPE "booking_status" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "booking_status" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'IN_PROCESS', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "payment" (
    "id" SERIAL NOT NULL,
    "quotation_id" UUID NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "preference_id" VARCHAR(64),
    "init_point" TEXT,
    "provider_payment_id" VARCHAR(64),
    "status_detail" VARCHAR(120),
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Unico a proposito: es la clave de idempotencia del flujo completo
-- (X-Idempotency-Key de la preferencia y external_reference del pago).
CREATE UNIQUE INDEX "payment_quotation_id_key" ON "payment"("quotation_id");

-- CreateIndex
CREATE INDEX "payment_booking_id_idx" ON "payment"("booking_id");

-- CreateIndex
CREATE INDEX "booking_user_id_start_date_idx" ON "booking"("user_id", "start_date");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
