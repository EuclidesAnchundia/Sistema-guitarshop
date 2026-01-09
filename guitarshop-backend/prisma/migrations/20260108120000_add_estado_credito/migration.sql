-- Adds credit status field
ALTER TABLE "credito" ADD COLUMN IF NOT EXISTS "estado_credito" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO';
