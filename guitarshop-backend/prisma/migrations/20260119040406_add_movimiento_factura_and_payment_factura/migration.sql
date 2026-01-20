-- CreateTable
CREATE TABLE "movimiento_factura" (
    "id_movimiento_factura" SERIAL NOT NULL,
    "id_factura" INTEGER NOT NULL,
    "fecha" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoMovimientoCredito" NOT NULL DEFAULT 'PAGO',
    "monto" DECIMAL(12,2) NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "referencia" VARCHAR(100),
    "nota" VARCHAR(255),
    "id_usuario" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "movimiento_factura_pkey" PRIMARY KEY ("id_movimiento_factura")
);

-- CreateIndex
CREATE INDEX "movimiento_factura_id_factura_idx" ON "movimiento_factura"("id_factura");

-- CreateIndex
CREATE INDEX "movimiento_factura_fecha_idx" ON "movimiento_factura"("fecha");

-- AddForeignKey
ALTER TABLE "movimiento_factura" ADD CONSTRAINT "movimiento_factura_id_factura_fkey" FOREIGN KEY ("id_factura") REFERENCES "factura"("id_factura") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_factura" ADD CONSTRAINT "movimiento_factura_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;
