--
-- PostgreSQL database dump
--

\restrict SanFmzcIza73Dt0ie5wxweUeiuAl6TLBeZYUdYVjKiAzpaJkdrQxcXaequoL0P2

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
4a43ed05-064f-4646-b473-3ad111c970ba	e1f544c304bfed401850fc0c970145fff855dc772b322634128644a07580204b	2025-11-05 21:18:34.818767-05	20251030233715_init	\N	\N	2025-11-05 21:18:34.714843-05	1
81b6fe71-cd99-4b75-a1d0-228dcc27927a	4d39ec68c6ab336d4b624115b2865868497d6a03ef8ee73218b7e82d93f08a13	2025-11-05 21:18:34.829808-05	20251031004059_add_usuario	\N	\N	2025-11-05 21:18:34.81967-05	1
9f9ad291-41e1-4b10-bb96-e757fd2973cc	3a406f737041eb1313d540eeca23a5a97a25db5193323e2bd0786aec670ed6e2	2025-11-05 21:18:34.841445-05	20251031005929_init	\N	\N	2025-11-05 21:18:34.830839-05	1
08421789-0509-4d64-a413-3e068c309e64	5b9fda5d8fbca4624fdef5e148cc7b9365e8e9dac27427ebe2d803dd02a8c58c	2025-11-05 21:18:46.197218-05	20251106021846_init	\N	\N	2025-11-05 21:18:46.146492-05	1
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--

\unrestrict SanFmzcIza73Dt0ie5wxweUeiuAl6TLBeZYUdYVjKiAzpaJkdrQxcXaequoL0P2

-- =============================
-- ESTRUCTURA PROFESIONAL GUITARSHOP
-- =============================

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS public.cliente (
    id_cliente SERIAL PRIMARY KEY,
    nombres VARCHAR(60) NOT NULL,
    apellidos VARCHAR(60) NOT NULL,
    cedula VARCHAR(10) UNIQUE NOT NULL,
    correo VARCHAR(120),
    telefono VARCHAR(20),
    direccion VARCHAR(150),
    fecha_nacimiento DATE,
    fecha_registro TIMESTAMP(6) DEFAULT now(),
    id_estado INT DEFAULT 1,
    id_usuario_modifi INT,
    CONSTRAINT fk_cliente_estado FOREIGN KEY (id_estado) REFERENCES estado_registro(id_estado),
    CONSTRAINT fk_cliente_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES usuario(id_usuario)
);

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS public.usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    correo VARCHAR(120) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(150),
    cedula VARCHAR(10) UNIQUE,
    fecha_nacimiento DATE,
    rol VARCHAR(30) DEFAULT 'VENDEDOR',
    password_hash VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP(6) DEFAULT now(),
    last_login TIMESTAMP(6),
    intentos_fallidos INT DEFAULT 0,
    bloqueado BOOLEAN DEFAULT false,
    id_estado INT DEFAULT 1,
    id_usuario_modifi INT,
    CONSTRAINT fk_usuario_estado FOREIGN KEY (id_estado) REFERENCES estado_registro(id_estado),
    CONSTRAINT fk_usuario_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES usuario(id_usuario)
);
CREATE INDEX IF NOT EXISTS ix_usuario_correo ON usuario(correo);
CREATE INDEX IF NOT EXISTS ix_usuario_rol ON usuario(rol);
CREATE INDEX IF NOT EXISTS ix_usuario_activo ON usuario(activo);
CREATE INDEX IF NOT EXISTS ix_usuario_bloqueado ON usuario(bloqueado);

-- Tabla de auditoría de usuario
CREATE TABLE IF NOT EXISTS public.usuario_auditoria (
    id_auditoria SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    evento VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255),
    fecha_evento TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_auditoria_usuario ON usuario_auditoria(id_usuario);
CREATE INDEX IF NOT EXISTS ix_auditoria_evento ON usuario_auditoria(evento);

-- Estado de registro (mínimo)
CREATE TABLE IF NOT EXISTS public.estado_registro (
    id_estado SERIAL PRIMARY KEY,
    nombre_estado VARCHAR(30) UNIQUE NOT NULL,
    descripcion VARCHAR(100)
);
INSERT INTO public.estado_registro (nombre_estado, descripcion) VALUES ('ACTIVO', 'Registro activo') ON CONFLICT DO NOTHING;

-- Usuario admin inicial (password: admin123, cambiar después de primer login)
INSERT INTO public.usuario (nombre_completo, correo, password_hash, rol, activo)
VALUES ('Administrador', 'admin@guitarshop.com', '$2b$10$7QJ8Qw1Qw1Qw1Qw1Qw1QwOQw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1', 'ADMIN', true)
ON CONFLICT (correo) DO NOTHING;

-- Comentarios y preparación para escalabilidad:
-- * Puedes agregar más roles en la tabla usuario (rol VARCHAR(30)).
-- * Para permisos granulares, crea una tabla rol_permiso y usuario_rol.
-- * Para logs generales, crea una tabla log_evento.
-- * Para integración de pasarela de pago, crea una tabla pago_externo y un endpoint webhook.
-- * Todos los campos de auditoría y relaciones están preparados para crecimiento.

