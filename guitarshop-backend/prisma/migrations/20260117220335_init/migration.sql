-- CreateTable
CREATE TABLE "cliente" (
    "id_cliente" SERIAL NOT NULL,
    "nombres" VARCHAR(60) NOT NULL,
    "apellidos" VARCHAR(60) NOT NULL,
    "cedula" VARCHAR(10) NOT NULL,
    "correo" VARCHAR(120),
    "telefono" VARCHAR(20),
    "direccion" VARCHAR(150),
    "fecha_nacimiento" DATE,
    "fecha_registro" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_estado" INTEGER NOT NULL DEFAULT 1,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "compra" (
    "id_compra" SERIAL NOT NULL,
    "fecha_compra" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_proveedor" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "observacion" VARCHAR(255),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuesto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "id_estado" INTEGER NOT NULL DEFAULT 1,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id_compra")
);

-- CreateTable
CREATE TABLE "credito" (
    "id_credito" SERIAL NOT NULL,
    "id_factura" INTEGER NOT NULL,
    "monto_total" DECIMAL(12,2) NOT NULL,
    "saldo_pendiente" DECIMAL(12,2) NOT NULL,
    "estado_credito" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "id_estado" INTEGER NOT NULL DEFAULT 1,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "credito_pkey" PRIMARY KEY ("id_credito")
);

-- CreateTable
CREATE TABLE "cuota" (
    "id_cuota" SERIAL NOT NULL,
    "id_credito" INTEGER NOT NULL,
    "numero_cuota" INTEGER NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "monto_cuota" DECIMAL(12,2) NOT NULL,
    "monto_pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado_cuota" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "fecha_pago" DATE,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "cuota_pkey" PRIMARY KEY ("id_cuota")
);

-- CreateTable
CREATE TABLE "movimiento_credito" (
    "id_movimiento_credito" SERIAL NOT NULL,
    "id_credito" INTEGER NOT NULL,
    "id_cuota" INTEGER NOT NULL,
    "fecha" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'PAGO',
    "monto" DECIMAL(12,2) NOT NULL,
    "metodo" VARCHAR(30) NOT NULL,
    "referencia" VARCHAR(100),
    "nota" VARCHAR(255),
    "id_usuario" INTEGER NOT NULL,

    CONSTRAINT "movimiento_credito_pkey" PRIMARY KEY ("id_movimiento_credito")
);

-- CreateTable
CREATE TABLE "detalle_factura" (
    "id_detalle_factura" SERIAL NOT NULL,
    "id_factura" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "id_estado" INTEGER NOT NULL DEFAULT 1,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "detalle_factura_pkey" PRIMARY KEY ("id_detalle_factura")
);

-- CreateTable
CREATE TABLE "factura" (
    "id_factura" SERIAL NOT NULL,
    "numero_factura" VARCHAR(30) NOT NULL,
    "fecha_factura" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_cliente" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "observacion" VARCHAR(255),
    "forma_pago" VARCHAR(30) NOT NULL DEFAULT 'CONTADO',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuesto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "id_estado" INTEGER NOT NULL DEFAULT 1,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "factura_pkey" PRIMARY KEY ("id_factura")
);

-- CreateTable
CREATE TABLE "kardex" (
    "id_kardex" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "fecha_movimiento" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo_movimiento" VARCHAR(20) NOT NULL,
    "origen" VARCHAR(20) NOT NULL,
    "id_referencia" INTEGER,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "comentario" VARCHAR(255),
    "id_estado" INTEGER NOT NULL DEFAULT 1,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "kardex_pkey" PRIMARY KEY ("id_kardex")
);

-- CreateTable
CREATE TABLE "producto" (
    "id_producto" SERIAL NOT NULL,
    "codigo_producto" VARCHAR(30) NOT NULL,
    "nombre_producto" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "id_proveedor" INTEGER,
    "precio_compra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precio_venta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cantidad_stock" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_estado" INTEGER NOT NULL DEFAULT 1,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "producto_compra" (
    "id_producto_compra" SERIAL NOT NULL,
    "id_compra" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad_compra" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "id_estado" INTEGER NOT NULL DEFAULT 1,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "producto_compra_pkey" PRIMARY KEY ("id_producto_compra")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id_proveedor" SERIAL NOT NULL,
    "nombre_proveedor" VARCHAR(100) NOT NULL,
    "ruc_cedula" VARCHAR(13) NOT NULL,
    "correo" VARCHAR(120),
    "telefono" VARCHAR(20),
    "direccion" VARCHAR(150),
    "fecha_registro" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_estado" INTEGER NOT NULL DEFAULT 1,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id_proveedor")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nombre_completo" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(120) NOT NULL,
    "telefono" VARCHAR(20),
    "direccion" VARCHAR(150),
    "cedula" VARCHAR(10),
    "fecha_nacimiento" DATE,
    "rol" VARCHAR(30) NOT NULL DEFAULT 'VENDEDOR',
    "password_hash" VARCHAR(255) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "id_estado" INTEGER NOT NULL DEFAULT 1,
    "id_usuario_modifi" INTEGER,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "usuario_auditoria" (
    "id_auditoria" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "evento" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(255),
    "fecha_evento" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_auditoria_pkey" PRIMARY KEY ("id_auditoria")
);

-- CreateTable
CREATE TABLE "estado_registro" (
    "id_estado" SERIAL NOT NULL,
    "nombre_estado" VARCHAR(30) NOT NULL,
    "descripcion" VARCHAR(100),

    CONSTRAINT "estado_registro_pkey" PRIMARY KEY ("id_estado")
);

-- CreateIndex
CREATE UNIQUE INDEX "cliente_cedula_key" ON "cliente"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "ux_cuota_unica" ON "cuota"("id_credito", "numero_cuota");

-- CreateIndex
CREATE INDEX "ix_mov_credito_credito" ON "movimiento_credito"("id_credito");

-- CreateIndex
CREATE INDEX "ix_mov_credito_cuota" ON "movimiento_credito"("id_cuota");

-- CreateIndex
CREATE INDEX "ix_mov_credito_fecha" ON "movimiento_credito"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ux_detalle_factura_unico" ON "detalle_factura"("id_factura", "id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "factura_numero_factura_key" ON "factura"("numero_factura");

-- CreateIndex
CREATE UNIQUE INDEX "producto_codigo_producto_key" ON "producto"("codigo_producto");

-- CreateIndex
CREATE UNIQUE INDEX "ux_producto_compra_unico" ON "producto_compra"("id_compra", "id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_ruc_cedula_key" ON "proveedor"("ruc_cedula");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_cedula_key" ON "usuario"("cedula");

-- CreateIndex
CREATE INDEX "ix_usuario_correo" ON "usuario"("correo");

-- CreateIndex
CREATE INDEX "ix_usuario_rol" ON "usuario"("rol");

-- CreateIndex
CREATE INDEX "ix_usuario_activo" ON "usuario"("activo");

-- CreateIndex
CREATE INDEX "ix_usuario_bloqueado" ON "usuario"("bloqueado");

-- CreateIndex
CREATE INDEX "ix_auditoria_usuario" ON "usuario_auditoria"("id_usuario");

-- CreateIndex
CREATE INDEX "ix_auditoria_evento" ON "usuario_auditoria"("evento");

-- CreateIndex
CREATE UNIQUE INDEX "estado_registro_nombre_estado_key" ON "estado_registro"("nombre_estado");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "fk_cliente_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_registro"("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "fk_cliente_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "fk_compra_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_registro"("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "fk_compra_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "fk_compra_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "fk_compra_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "credito" ADD CONSTRAINT "fk_credito_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_registro"("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "credito" ADD CONSTRAINT "fk_credito_factura" FOREIGN KEY ("id_factura") REFERENCES "factura"("id_factura") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "credito" ADD CONSTRAINT "fk_credito_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuota" ADD CONSTRAINT "fk_cuota_credito" FOREIGN KEY ("id_credito") REFERENCES "credito"("id_credito") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuota" ADD CONSTRAINT "fk_cuota_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_credito" ADD CONSTRAINT "fk_mov_credito_credito" FOREIGN KEY ("id_credito") REFERENCES "credito"("id_credito") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_credito" ADD CONSTRAINT "fk_mov_credito_cuota" FOREIGN KEY ("id_cuota") REFERENCES "cuota"("id_cuota") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_credito" ADD CONSTRAINT "fk_mov_credito_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_factura" ADD CONSTRAINT "fk_detalle_factura" FOREIGN KEY ("id_factura") REFERENCES "factura"("id_factura") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_factura" ADD CONSTRAINT "fk_detalle_factura_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_registro"("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_factura" ADD CONSTRAINT "fk_detalle_factura_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_factura" ADD CONSTRAINT "fk_detalle_producto" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "factura" ADD CONSTRAINT "fk_factura_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "factura" ADD CONSTRAINT "fk_factura_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_registro"("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "factura" ADD CONSTRAINT "fk_factura_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "factura" ADD CONSTRAINT "fk_factura_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "kardex" ADD CONSTRAINT "fk_kardex_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_registro"("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "kardex" ADD CONSTRAINT "fk_kardex_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "kardex" ADD CONSTRAINT "fk_kx_producto" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "fk_producto_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_registro"("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "fk_producto_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "fk_producto_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto_compra" ADD CONSTRAINT "fk_pc_compra" FOREIGN KEY ("id_compra") REFERENCES "compra"("id_compra") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto_compra" ADD CONSTRAINT "fk_pc_producto" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto_compra" ADD CONSTRAINT "fk_producto_compra_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_registro"("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto_compra" ADD CONSTRAINT "fk_producto_compra_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedor" ADD CONSTRAINT "fk_proveedor_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_registro"("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedor" ADD CONSTRAINT "fk_proveedor_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "fk_usuario_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_registro"("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "fk_usuario_usuario_modifi" FOREIGN KEY ("id_usuario_modifi") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_auditoria" ADD CONSTRAINT "usuario_auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
