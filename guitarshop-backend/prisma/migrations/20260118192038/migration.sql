/*
  Warnings:

  - The `estado_credito` column on the `credito` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `estado_cuota` column on the `cuota` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `tipo` column on the `movimiento_credito` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updated_at` to the `movimiento_credito` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `metodo` on the `movimiento_credito` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EstadoCredito" AS ENUM ('ACTIVO', 'CANCELADO', 'EN_MORA', 'REFINANCIADO');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "TipoMovimientoCredito" AS ENUM ('PAGO', 'AJUSTE', 'CONDONACION', 'REPROGRAMACION', 'REFUND');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'PAYPHONE', 'OTRO');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYPHONE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED', 'CANCELED');

-- AlterTable
ALTER TABLE "credito" DROP COLUMN "estado_credito",
ADD COLUMN     "estado_credito" "EstadoCredito" NOT NULL DEFAULT 'ACTIVO';

-- AlterTable
ALTER TABLE "cuota" DROP COLUMN "estado_cuota",
ADD COLUMN     "estado_cuota" "EstadoCuota" NOT NULL DEFAULT 'PENDIENTE';

-- AlterTable
ALTER TABLE "movimiento_credito" ADD COLUMN     "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(6) NOT NULL,
ALTER COLUMN "id_cuota" DROP NOT NULL,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoMovimientoCredito" NOT NULL DEFAULT 'PAGO',
DROP COLUMN "metodo",
ADD COLUMN     "metodo" "MetodoPago" NOT NULL;

-- CreateTable
CREATE TABLE "payment" (
    "id_payment" SERIAL NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYPHONE',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_reference" VARCHAR(120) NOT NULL,
    "idempotency_key" VARCHAR(120),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'USD',
    "id_credito" INTEGER NOT NULL,
    "id_cuota" INTEGER,
    "id_usuario" INTEGER,
    "id_movimiento_credito" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id_payment")
);

-- CreateTable
CREATE TABLE "payment_webhook_event" (
    "id_event" SERIAL NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYPHONE',
    "event_id" VARCHAR(150) NOT NULL,
    "received_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "payment_webhook_event_pkey" PRIMARY KEY ("id_event")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_reference_key" ON "payment"("provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotency_key_key" ON "payment"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payment_id_movimiento_credito_key" ON "payment"("id_movimiento_credito");

-- CreateIndex
CREATE INDEX "payment_id_credito_idx" ON "payment"("id_credito");

-- CreateIndex
CREATE INDEX "payment_id_cuota_idx" ON "payment"("id_cuota");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "payment"("status");

-- CreateIndex
CREATE INDEX "payment_created_at_idx" ON "payment"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_event_event_id_key" ON "payment_webhook_event"("event_id");

-- CreateIndex
CREATE INDEX "payment_webhook_event_provider_idx" ON "payment_webhook_event"("provider");

-- CreateIndex
CREATE INDEX "payment_webhook_event_received_at_idx" ON "payment_webhook_event"("received_at");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_id_credito_fkey" FOREIGN KEY ("id_credito") REFERENCES "credito"("id_credito") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_id_cuota_fkey" FOREIGN KEY ("id_cuota") REFERENCES "cuota"("id_cuota") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_id_movimiento_credito_fkey" FOREIGN KEY ("id_movimiento_credito") REFERENCES "movimiento_credito"("id_movimiento_credito") ON DELETE SET NULL ON UPDATE CASCADE;
