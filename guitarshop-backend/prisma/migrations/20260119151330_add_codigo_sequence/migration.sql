-- DropForeignKey
ALTER TABLE "payment" DROP CONSTRAINT "payment_id_credito_fkey";

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "id_factura" INTEGER,
ALTER COLUMN "id_credito" DROP NOT NULL;

-- CreateTable
CREATE TABLE "codigo_sequence" (
    "prefix" VARCHAR(60) NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "codigo_sequence_pkey" PRIMARY KEY ("prefix")
);

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_id_credito_fkey" FOREIGN KEY ("id_credito") REFERENCES "credito"("id_credito") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_id_factura_fkey" FOREIGN KEY ("id_factura") REFERENCES "factura"("id_factura") ON DELETE SET NULL ON UPDATE CASCADE;
