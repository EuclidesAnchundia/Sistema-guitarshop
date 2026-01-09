-- Seed data: estado_registro
-- This ensures new databases have the default row required by many tables (id_estado default = 1).

INSERT INTO "estado_registro" ("nombre_estado", "descripcion")
VALUES ('ACTIVO', 'Registro activo')
ON CONFLICT ("nombre_estado") DO NOTHING;
