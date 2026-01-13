--
-- PostgreSQL database dump
--

\restrict c11NjA8hTkaKbJUSeble7ItxBgMwGdk0Vr8ykjdXpdr8blnRfuPjYuGgeBoygJg

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

ALTER TABLE IF EXISTS ONLY public.usuario DROP CONSTRAINT IF EXISTS fk_usuario_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.usuario DROP CONSTRAINT IF EXISTS fk_usuario_estado;
ALTER TABLE IF EXISTS ONLY public.proveedor DROP CONSTRAINT IF EXISTS fk_proveedor_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.proveedor DROP CONSTRAINT IF EXISTS fk_proveedor_estado;
ALTER TABLE IF EXISTS ONLY public.producto DROP CONSTRAINT IF EXISTS fk_producto_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.producto DROP CONSTRAINT IF EXISTS fk_producto_proveedor;
ALTER TABLE IF EXISTS ONLY public.producto DROP CONSTRAINT IF EXISTS fk_producto_estado;
ALTER TABLE IF EXISTS ONLY public.producto_compra DROP CONSTRAINT IF EXISTS fk_producto_compra_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.producto_compra DROP CONSTRAINT IF EXISTS fk_producto_compra_estado;
ALTER TABLE IF EXISTS ONLY public.producto_compra DROP CONSTRAINT IF EXISTS fk_pc_producto;
ALTER TABLE IF EXISTS ONLY public.producto_compra DROP CONSTRAINT IF EXISTS fk_pc_compra;
ALTER TABLE IF EXISTS ONLY public.kardex DROP CONSTRAINT IF EXISTS fk_kx_producto;
ALTER TABLE IF EXISTS ONLY public.kardex DROP CONSTRAINT IF EXISTS fk_kardex_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.kardex DROP CONSTRAINT IF EXISTS fk_kardex_estado;
ALTER TABLE IF EXISTS ONLY public.factura DROP CONSTRAINT IF EXISTS fk_factura_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.factura DROP CONSTRAINT IF EXISTS fk_factura_usuario;
ALTER TABLE IF EXISTS ONLY public.factura DROP CONSTRAINT IF EXISTS fk_factura_estado;
ALTER TABLE IF EXISTS ONLY public.factura DROP CONSTRAINT IF EXISTS fk_factura_cliente;
ALTER TABLE IF EXISTS ONLY public.detalle_factura DROP CONSTRAINT IF EXISTS fk_detalle_producto;
ALTER TABLE IF EXISTS ONLY public.detalle_factura DROP CONSTRAINT IF EXISTS fk_detalle_factura_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.detalle_factura DROP CONSTRAINT IF EXISTS fk_detalle_factura_estado;
ALTER TABLE IF EXISTS ONLY public.detalle_factura DROP CONSTRAINT IF EXISTS fk_detalle_factura;
ALTER TABLE IF EXISTS ONLY public.cuota DROP CONSTRAINT IF EXISTS fk_cuota_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.cuota DROP CONSTRAINT IF EXISTS fk_cuota_credito;
ALTER TABLE IF EXISTS ONLY public.credito DROP CONSTRAINT IF EXISTS fk_credito_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.credito DROP CONSTRAINT IF EXISTS fk_credito_factura;
ALTER TABLE IF EXISTS ONLY public.credito DROP CONSTRAINT IF EXISTS fk_credito_estado;
ALTER TABLE IF EXISTS ONLY public.compra DROP CONSTRAINT IF EXISTS fk_compra_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.compra DROP CONSTRAINT IF EXISTS fk_compra_usuario;
ALTER TABLE IF EXISTS ONLY public.compra DROP CONSTRAINT IF EXISTS fk_compra_proveedor;
ALTER TABLE IF EXISTS ONLY public.compra DROP CONSTRAINT IF EXISTS fk_compra_estado;
ALTER TABLE IF EXISTS ONLY public.cliente DROP CONSTRAINT IF EXISTS fk_cliente_usuario_modifi;
ALTER TABLE IF EXISTS ONLY public.cliente DROP CONSTRAINT IF EXISTS fk_cliente_estado;
DROP TRIGGER IF EXISTS producto_compra_ai ON public.producto_compra;
DROP TRIGGER IF EXISTS detalle_factura_ai ON public.detalle_factura;
DROP INDEX IF EXISTS public.ux_producto_compra_unico;
DROP INDEX IF EXISTS public.ux_detalle_factura_unico;
DROP INDEX IF EXISTS public.ux_cuota_unica;
DROP INDEX IF EXISTS public.ix_producto_estado_stock;
DROP INDEX IF EXISTS public.ix_producto_estado_proveedor;
DROP INDEX IF EXISTS public.ix_producto_estado_fecha;
DROP INDEX IF EXISTS public.ix_kardex_producto_fecha;
DROP INDEX IF EXISTS public.ix_factura_forma_pago_fecha;
DROP INDEX IF EXISTS public.ix_factura_estado_fecha;
DROP INDEX IF EXISTS public.ix_factura_cliente_fecha;
DROP INDEX IF EXISTS public.ix_detalle_factura_id_producto;
DROP INDEX IF EXISTS public.ix_detalle_factura_id_factura;
ALTER TABLE IF EXISTS ONLY public.usuario DROP CONSTRAINT IF EXISTS usuario_pkey;
ALTER TABLE IF EXISTS ONLY public.usuario DROP CONSTRAINT IF EXISTS usuario_correo_key;
ALTER TABLE IF EXISTS ONLY public.usuario DROP CONSTRAINT IF EXISTS usuario_cedula_key;
ALTER TABLE IF EXISTS ONLY public.proveedor DROP CONSTRAINT IF EXISTS proveedor_ruc_cedula_key;
ALTER TABLE IF EXISTS ONLY public.proveedor DROP CONSTRAINT IF EXISTS proveedor_pkey;
ALTER TABLE IF EXISTS ONLY public.producto DROP CONSTRAINT IF EXISTS producto_pkey;
ALTER TABLE IF EXISTS ONLY public.producto_compra DROP CONSTRAINT IF EXISTS producto_compra_pkey;
ALTER TABLE IF EXISTS ONLY public.producto DROP CONSTRAINT IF EXISTS producto_codigo_producto_key;
ALTER TABLE IF EXISTS ONLY public.kardex DROP CONSTRAINT IF EXISTS kardex_pkey;
ALTER TABLE IF EXISTS ONLY public.factura DROP CONSTRAINT IF EXISTS factura_pkey;
ALTER TABLE IF EXISTS ONLY public.factura DROP CONSTRAINT IF EXISTS factura_numero_factura_key;
ALTER TABLE IF EXISTS ONLY public.estado_registro DROP CONSTRAINT IF EXISTS estado_registro_pkey;
ALTER TABLE IF EXISTS ONLY public.estado_registro DROP CONSTRAINT IF EXISTS estado_registro_nombre_estado_key;
ALTER TABLE IF EXISTS ONLY public.detalle_factura DROP CONSTRAINT IF EXISTS detalle_factura_pkey;
ALTER TABLE IF EXISTS ONLY public.cuota DROP CONSTRAINT IF EXISTS cuota_pkey;
ALTER TABLE IF EXISTS ONLY public.credito DROP CONSTRAINT IF EXISTS credito_pkey;
ALTER TABLE IF EXISTS ONLY public.compra DROP CONSTRAINT IF EXISTS compra_pkey;
ALTER TABLE IF EXISTS ONLY public.cliente DROP CONSTRAINT IF EXISTS cliente_pkey;
ALTER TABLE IF EXISTS ONLY public.cliente DROP CONSTRAINT IF EXISTS cliente_cedula_key;
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS public.usuario ALTER COLUMN id_usuario DROP DEFAULT;
ALTER TABLE IF EXISTS public.proveedor ALTER COLUMN id_proveedor DROP DEFAULT;
ALTER TABLE IF EXISTS public.producto_compra ALTER COLUMN id_producto_compra DROP DEFAULT;
ALTER TABLE IF EXISTS public.producto ALTER COLUMN id_producto DROP DEFAULT;
ALTER TABLE IF EXISTS public.kardex ALTER COLUMN id_kardex DROP DEFAULT;
ALTER TABLE IF EXISTS public.factura ALTER COLUMN id_factura DROP DEFAULT;
ALTER TABLE IF EXISTS public.estado_registro ALTER COLUMN id_estado DROP DEFAULT;
ALTER TABLE IF EXISTS public.detalle_factura ALTER COLUMN id_detalle_factura DROP DEFAULT;
ALTER TABLE IF EXISTS public.cuota ALTER COLUMN id_cuota DROP DEFAULT;
ALTER TABLE IF EXISTS public.credito ALTER COLUMN id_credito DROP DEFAULT;
ALTER TABLE IF EXISTS public.compra ALTER COLUMN id_compra DROP DEFAULT;
ALTER TABLE IF EXISTS public.cliente ALTER COLUMN id_cliente DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.usuario_id_usuario_seq;
DROP TABLE IF EXISTS public.usuario;
DROP SEQUENCE IF EXISTS public.proveedor_id_proveedor_seq;
DROP TABLE IF EXISTS public.proveedor;
DROP SEQUENCE IF EXISTS public.producto_id_producto_seq;
DROP SEQUENCE IF EXISTS public.producto_compra_id_producto_compra_seq;
DROP TABLE IF EXISTS public.producto_compra;
DROP TABLE IF EXISTS public.producto;
DROP SEQUENCE IF EXISTS public.kardex_id_kardex_seq;
DROP TABLE IF EXISTS public.kardex;
DROP SEQUENCE IF EXISTS public.factura_id_factura_seq;
DROP TABLE IF EXISTS public.factura;
DROP SEQUENCE IF EXISTS public.estado_registro_id_estado_seq;
DROP TABLE IF EXISTS public.estado_registro;
DROP SEQUENCE IF EXISTS public.detalle_factura_id_detalle_factura_seq;
DROP TABLE IF EXISTS public.detalle_factura;
DROP SEQUENCE IF EXISTS public.cuota_id_cuota_seq;
DROP TABLE IF EXISTS public.cuota;
DROP SEQUENCE IF EXISTS public.credito_id_credito_seq;
DROP TABLE IF EXISTS public.credito;
DROP SEQUENCE IF EXISTS public.compra_id_compra_seq;
DROP TABLE IF EXISTS public.compra;
DROP SEQUENCE IF EXISTS public.cliente_id_cliente_seq;
DROP TABLE IF EXISTS public.cliente;
DROP TABLE IF EXISTS public._prisma_migrations;
DROP FUNCTION IF EXISTS public.trg_producto_compra_after_insert();
DROP FUNCTION IF EXISTS public.trg_detalle_factura_after_insert();
DROP FUNCTION IF EXISTS public.fn_recalcular_totales_factura(p_id_factura integer);
DROP FUNCTION IF EXISTS public.fn_recalcular_totales_compra(p_id_compra integer);
-- *not* dropping schema, since initdb creates it
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: fn_recalcular_totales_compra(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_recalcular_totales_compra(p_id_compra integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_subtotal NUMERIC(12,2);
BEGIN
    SELECT COALESCE(SUM(subtotal), 0)
    INTO v_subtotal
    FROM producto_compra
    WHERE id_compra = p_id_compra
      AND id_estado <> (SELECT id_estado FROM estado_registro WHERE nombre_estado = 'ANULADO');

    UPDATE compra
    SET subtotal = v_subtotal,
        impuesto = ROUND(v_subtotal * 0.12, 2),
        total    = ROUND(v_subtotal * 1.12, 2)
    WHERE id_compra = p_id_compra;
END;
$$;


--
-- Name: fn_recalcular_totales_factura(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_recalcular_totales_factura(p_id_factura integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_subtotal NUMERIC(12,2);
BEGIN
    SELECT COALESCE(SUM(subtotal), 0)
    INTO v_subtotal
    FROM detalle_factura
    WHERE id_factura = p_id_factura
      AND id_estado <> (SELECT id_estado FROM estado_registro WHERE nombre_estado = 'ANULADO');

    UPDATE factura
    SET subtotal = v_subtotal,
        impuesto = ROUND(v_subtotal * 0.12, 2),
        total    = ROUND(v_subtotal * 1.12, 2)
    WHERE id_factura = p_id_factura;
END;
$$;


--
-- Name: trg_detalle_factura_after_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_detalle_factura_after_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_stock_actual INT;
BEGIN
    SELECT cantidad_stock
    INTO v_stock_actual
    FROM producto
    WHERE id_producto = NEW.id_producto
    FOR UPDATE;

    IF v_stock_actual IS NULL THEN
        RAISE EXCEPTION 'Producto % no existe', NEW.id_producto;
    END IF;

    IF v_stock_actual < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %: stock actual %, cantidad solicitada %',
            NEW.id_producto, v_stock_actual, NEW.cantidad;
    END IF;

    -- Descontar stock
    UPDATE producto
    SET cantidad_stock = cantidad_stock - NEW.cantidad
    WHERE id_producto = NEW.id_producto;

    -- Registrar en kardex
    INSERT INTO kardex (
        id_producto,
        fecha_movimiento,
        tipo_movimiento,
        origen,
        id_referencia,
        cantidad,
        costo_unitario,
        comentario
    )
    VALUES (
        NEW.id_producto,
        NOW(),
        'SALIDA',
        'VENTA',
        NEW.id_factura,
        NEW.cantidad,
        NEW.precio_unitario,
        'Salida por venta'
    );

    -- Recalcular totales de la factura
    PERFORM fn_recalcular_totales_factura(NEW.id_factura);

    RETURN NEW;
END;
$$;


--
-- Name: trg_producto_compra_after_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_producto_compra_after_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Actualizar stock
    UPDATE producto
    SET cantidad_stock = cantidad_stock + NEW.cantidad_compra
    WHERE id_producto = NEW.id_producto;

    -- Registrar en kardex
    INSERT INTO kardex (
        id_producto,
        fecha_movimiento,
        tipo_movimiento,
        origen,
        id_referencia,
        cantidad,
        costo_unitario,
        comentario
    )
    VALUES (
        NEW.id_producto,
        NOW(),
        'ENTRADA',
        'COMPRA',
        NEW.id_compra,
        NEW.cantidad_compra,
        NEW.costo_unitario,
        'Ingreso por compra'
    );

    -- Recalcular totales de la compra
    PERFORM fn_recalcular_totales_compra(NEW.id_compra);

    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente (
    id_cliente integer NOT NULL,
    nombres character varying(60) NOT NULL,
    apellidos character varying(60) NOT NULL,
    cedula character varying(10) NOT NULL,
    correo character varying(120),
    telefono character varying(20),
    direccion character varying(150),
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    id_estado integer DEFAULT 1 NOT NULL,
    id_usuario_modifi integer,
    CONSTRAINT chk_cliente_cedula CHECK (((char_length((cedula)::text) = 10) AND ((cedula)::text ~ '^[0-9]+$'::text))),
    CONSTRAINT chk_cliente_correo CHECK (((correo IS NULL) OR ((correo)::text ~ '^[^@]+@[^@]+\.[^@]+$'::text)))
);


--
-- Name: cliente_id_cliente_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_id_cliente_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cliente_id_cliente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_id_cliente_seq OWNED BY public.cliente.id_cliente;


--
-- Name: compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compra (
    id_compra integer NOT NULL,
    fecha_compra timestamp without time zone DEFAULT now() NOT NULL,
    id_proveedor integer NOT NULL,
    id_usuario integer NOT NULL,
    observacion character varying(255),
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    impuesto numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    id_estado integer DEFAULT 1 NOT NULL,
    id_usuario_modifi integer
);


--
-- Name: compra_id_compra_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compra_id_compra_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compra_id_compra_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compra_id_compra_seq OWNED BY public.compra.id_compra;


--
-- Name: credito; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credito (
    id_credito integer NOT NULL,
    id_factura integer NOT NULL,
    monto_total numeric(12,2) NOT NULL,
    saldo_pendiente numeric(12,2) NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date,
    id_estado integer DEFAULT 1 NOT NULL,
    id_usuario_modifi integer,
    estado_credito character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    CONSTRAINT chk_credito_montos CHECK (((monto_total >= (0)::numeric) AND (saldo_pendiente >= (0)::numeric)))
);


--
-- Name: credito_id_credito_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credito_id_credito_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credito_id_credito_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credito_id_credito_seq OWNED BY public.credito.id_credito;


--
-- Name: cuota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cuota (
    id_cuota integer NOT NULL,
    id_credito integer NOT NULL,
    numero_cuota integer NOT NULL,
    fecha_vencimiento date NOT NULL,
    monto_cuota numeric(12,2) NOT NULL,
    monto_pagado numeric(12,2) DEFAULT 0 NOT NULL,
    estado_cuota character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    fecha_pago date,
    id_usuario_modifi integer,
    CONSTRAINT chk_cuota_estado CHECK (((estado_cuota)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PAGADA'::character varying, 'VENCIDA'::character varying])::text[]))),
    CONSTRAINT chk_cuota_montos CHECK (((monto_cuota >= (0)::numeric) AND (monto_pagado >= (0)::numeric)))
);


--
-- Name: cuota_id_cuota_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cuota_id_cuota_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuota_id_cuota_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cuota_id_cuota_seq OWNED BY public.cuota.id_cuota;


--
-- Name: detalle_factura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_factura (
    id_detalle_factura integer NOT NULL,
    id_factura integer NOT NULL,
    id_producto integer NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario numeric(12,2) NOT NULL,
    descuento numeric(12,2) DEFAULT 0 NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    id_estado integer DEFAULT 1 NOT NULL,
    id_usuario_modifi integer,
    CONSTRAINT chk_detalle_factura_cantidad CHECK ((cantidad > 0)),
    CONSTRAINT chk_detalle_factura_precios CHECK (((precio_unitario >= (0)::numeric) AND (descuento >= (0)::numeric) AND (subtotal >= (0)::numeric)))
);


--
-- Name: detalle_factura_id_detalle_factura_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detalle_factura_id_detalle_factura_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_factura_id_detalle_factura_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detalle_factura_id_detalle_factura_seq OWNED BY public.detalle_factura.id_detalle_factura;


--
-- Name: estado_registro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estado_registro (
    id_estado integer NOT NULL,
    nombre_estado character varying(30) NOT NULL,
    descripcion character varying(100)
);


--
-- Name: estado_registro_id_estado_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estado_registro_id_estado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estado_registro_id_estado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estado_registro_id_estado_seq OWNED BY public.estado_registro.id_estado;


--
-- Name: factura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.factura (
    id_factura integer NOT NULL,
    numero_factura character varying(30) NOT NULL,
    fecha_factura timestamp without time zone DEFAULT now() NOT NULL,
    id_cliente integer NOT NULL,
    id_usuario integer NOT NULL,
    observacion character varying(255),
    forma_pago character varying(30) DEFAULT 'CONTADO'::character varying NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    impuesto numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    id_estado integer DEFAULT 1 NOT NULL,
    id_usuario_modifi integer
);


--
-- Name: factura_id_factura_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.factura_id_factura_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: factura_id_factura_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.factura_id_factura_seq OWNED BY public.factura.id_factura;


--
-- Name: kardex; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kardex (
    id_kardex integer NOT NULL,
    id_producto integer NOT NULL,
    fecha_movimiento timestamp without time zone DEFAULT now() NOT NULL,
    tipo_movimiento character varying(20) NOT NULL,
    origen character varying(20) NOT NULL,
    id_referencia integer,
    cantidad integer NOT NULL,
    costo_unitario numeric(12,2) NOT NULL,
    comentario character varying(255),
    id_estado integer DEFAULT 1 NOT NULL,
    id_usuario_modifi integer,
    CONSTRAINT chk_kardex_cantidad CHECK ((cantidad > 0)),
    CONSTRAINT chk_kardex_origen CHECK (((origen)::text = ANY ((ARRAY['COMPRA'::character varying, 'VENTA'::character varying, 'AJUSTE'::character varying])::text[]))),
    CONSTRAINT chk_kardex_tipo_mov CHECK (((tipo_movimiento)::text = ANY ((ARRAY['ENTRADA'::character varying, 'SALIDA'::character varying, 'AJUSTE'::character varying])::text[])))
);


--
-- Name: kardex_id_kardex_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kardex_id_kardex_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kardex_id_kardex_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kardex_id_kardex_seq OWNED BY public.kardex.id_kardex;


--
-- Name: producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto (
    id_producto integer NOT NULL,
    codigo_producto character varying(30) NOT NULL,
    nombre_producto character varying(100) NOT NULL,
    descripcion character varying(255),
    id_proveedor integer,
    precio_compra numeric(12,2) DEFAULT 0 NOT NULL,
    precio_venta numeric(12,2) DEFAULT 0 NOT NULL,
    cantidad_stock integer DEFAULT 0 NOT NULL,
    stock_minimo integer DEFAULT 0 NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    id_estado integer DEFAULT 1 NOT NULL,
    id_usuario_modifi integer,
    CONSTRAINT chk_producto_precios CHECK (((precio_compra >= (0)::numeric) AND (precio_venta >= (0)::numeric))),
    CONSTRAINT chk_producto_stock CHECK (((cantidad_stock >= 0) AND (stock_minimo >= 0)))
);


--
-- Name: producto_compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto_compra (
    id_producto_compra integer NOT NULL,
    id_compra integer NOT NULL,
    id_producto integer NOT NULL,
    cantidad_compra integer NOT NULL,
    costo_unitario numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    id_estado integer DEFAULT 1 NOT NULL,
    id_usuario_modifi integer,
    CONSTRAINT chk_producto_compra_cantidad CHECK ((cantidad_compra > 0)),
    CONSTRAINT chk_producto_compra_costos CHECK (((costo_unitario >= (0)::numeric) AND (subtotal >= (0)::numeric)))
);


--
-- Name: producto_compra_id_producto_compra_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producto_compra_id_producto_compra_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producto_compra_id_producto_compra_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producto_compra_id_producto_compra_seq OWNED BY public.producto_compra.id_producto_compra;


--
-- Name: producto_id_producto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producto_id_producto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producto_id_producto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producto_id_producto_seq OWNED BY public.producto.id_producto;


--
-- Name: proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedor (
    id_proveedor integer NOT NULL,
    nombre_proveedor character varying(100) NOT NULL,
    ruc_cedula character varying(13) NOT NULL,
    correo character varying(120),
    telefono character varying(20),
    direccion character varying(150),
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    id_estado integer DEFAULT 1 NOT NULL,
    id_usuario_modifi integer,
    CONSTRAINT chk_proveedor_correo CHECK (((correo IS NULL) OR ((correo)::text ~ '^[^@]+@[^@]+\.[^@]+$'::text)))
);


--
-- Name: proveedor_id_proveedor_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proveedor_id_proveedor_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proveedor_id_proveedor_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.proveedor_id_proveedor_seq OWNED BY public.proveedor.id_proveedor;


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id_usuario integer NOT NULL,
    nombre_completo character varying(100) NOT NULL,
    correo character varying(120) NOT NULL,
    telefono character varying(20),
    direccion character varying(150),
    cedula character varying(10),
    rol character varying(30) DEFAULT 'VENDEDOR'::character varying NOT NULL,
    password_hash character varying(255) NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    id_estado integer DEFAULT 1 NOT NULL,
    id_usuario_modifi integer,
    CONSTRAINT chk_usuario_cedula CHECK (((cedula IS NULL) OR ((char_length((cedula)::text) = 10) AND ((cedula)::text ~ '^[0-9]+$'::text)))),
    CONSTRAINT chk_usuario_correo CHECK (((correo)::text ~ '^[^@]+@[^@]+\.[^@]+$'::text))
);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_id_usuario_seq OWNED BY public.usuario.id_usuario;


--
-- Name: cliente id_cliente; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente ALTER COLUMN id_cliente SET DEFAULT nextval('public.cliente_id_cliente_seq'::regclass);


--
-- Name: compra id_compra; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra ALTER COLUMN id_compra SET DEFAULT nextval('public.compra_id_compra_seq'::regclass);


--
-- Name: credito id_credito; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito ALTER COLUMN id_credito SET DEFAULT nextval('public.credito_id_credito_seq'::regclass);


--
-- Name: cuota id_cuota; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuota ALTER COLUMN id_cuota SET DEFAULT nextval('public.cuota_id_cuota_seq'::regclass);


--
-- Name: detalle_factura id_detalle_factura; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_factura ALTER COLUMN id_detalle_factura SET DEFAULT nextval('public.detalle_factura_id_detalle_factura_seq'::regclass);


--
-- Name: estado_registro id_estado; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estado_registro ALTER COLUMN id_estado SET DEFAULT nextval('public.estado_registro_id_estado_seq'::regclass);


--
-- Name: factura id_factura; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factura ALTER COLUMN id_factura SET DEFAULT nextval('public.factura_id_factura_seq'::regclass);


--
-- Name: kardex id_kardex; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex ALTER COLUMN id_kardex SET DEFAULT nextval('public.kardex_id_kardex_seq'::regclass);


--
-- Name: producto id_producto; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto ALTER COLUMN id_producto SET DEFAULT nextval('public.producto_id_producto_seq'::regclass);


--
-- Name: producto_compra id_producto_compra; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_compra ALTER COLUMN id_producto_compra SET DEFAULT nextval('public.producto_compra_id_producto_compra_seq'::regclass);


--
-- Name: proveedor id_proveedor; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor ALTER COLUMN id_proveedor SET DEFAULT nextval('public.proveedor_id_proveedor_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuario_id_usuario_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
7435546b-3dcf-4d6d-b5c3-55d793081e1a	40bfbf43b72e1053b63193fd7dbeeabf55dbfa7e8f7dfc1bb1a6d89301fc370c	\N	20251210053938_init_reset	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20251210053938_init_reset\n\nDatabase error code: 42P07\n\nDatabase error:\nERROR: la relación «cliente» ya existe\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P07), message: "la relación «cliente» ya existe", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("heap.c"), line: Some(1162), routine: Some("heap_create_with_catalog") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20251210053938_init_reset"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="20251210053938_init_reset"\n             at schema-engine\\commands\\src\\commands\\apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:260	\N	2026-01-07 19:36:42.96601-05	0
\.


--
-- Data for Name: cliente; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cliente (id_cliente, nombres, apellidos, cedula, correo, telefono, direccion, fecha_registro, id_estado, id_usuario_modifi) FROM stdin;
1	Carlos	Villao	1314500741	carlos@gmail.com	0988227874	Primera de Enero	2025-12-10 14:47:58.541	1	1
2	CONSUMIDOR	FINAL	9999999999	\N	\N	\N	2026-01-08 07:55:07.786	1	1
\.


--
-- Data for Name: compra; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.compra (id_compra, fecha_compra, id_proveedor, id_usuario, observacion, subtotal, impuesto, total, id_estado, id_usuario_modifi) FROM stdin;
1	2025-12-10 06:08:43.927	1	1	\N	3.08	0.37	3.45	1	1
2	2025-12-10 21:35:49.359	1	1	Compra de cuerdas	100.00	12.00	112.00	1	1
\.


--
-- Data for Name: credito; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.credito (id_credito, id_factura, monto_total, saldo_pendiente, fecha_inicio, fecha_fin, id_estado, id_usuario_modifi, estado_credito) FROM stdin;
1	2	22.40	0.00	2025-12-10	2026-01-08	1	1	CANCELADO
\.


--
-- Data for Name: cuota; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cuota (id_cuota, id_credito, numero_cuota, fecha_vencimiento, monto_cuota, monto_pagado, estado_cuota, fecha_pago, id_usuario_modifi) FROM stdin;
1	1	1	2026-01-01	11.20	11.20	PAGADA	2026-01-08	1
2	1	2	2026-01-31	11.20	11.20	PAGADA	2026-01-08	1
\.


--
-- Data for Name: detalle_factura; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.detalle_factura (id_detalle_factura, id_factura, id_producto, cantidad, precio_unitario, descuento, subtotal, id_estado, id_usuario_modifi) FROM stdin;
1	1	1	1	20.00	5.00	15.00	1	1
2	2	1	1	20.00	0.00	20.00	1	1
3	3	2	7	20.05	0.04	140.31	3	1
4	4	2	2	20.00	0.00	40.00	3	1
5	5	1	4	20.00	0.00	80.00	1	1
6	5	3	1	24.00	0.00	24.00	1	1
7	6	1	1	20.00	0.00	20.00	1	1
8	6	9	1	20.00	0.00	20.00	1	1
9	6	3	1	24.00	0.00	24.00	1	1
10	6	11	1	100.00	0.00	100.00	1	1
11	6	4	1	30.00	0.00	30.00	1	1
12	7	1	1	20.00	0.00	20.00	1	1
13	8	1	1	20.00	0.00	20.00	1	1
14	9	1	1	20.00	0.00	20.00	1	1
15	10	11	1	100.00	0.00	100.00	1	1
16	11	1	1	20.00	0.00	20.00	1	1
17	12	11	1	100.00	0.00	100.00	1	1
18	13	8	1	20.00	0.00	20.00	1	1
19	14	11	1	100.00	0.00	100.00	1	1
20	15	1	1	20.00	0.00	20.00	1	1
21	16	1	1	20.00	0.00	20.00	1	1
22	17	1	1	20.00	0.00	20.00	1	1
23	18	11	1	100.00	0.00	100.00	1	1
\.


--
-- Data for Name: estado_registro; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.estado_registro (id_estado, nombre_estado, descripcion) FROM stdin;
2	INACTIVO	Registro inactivo / dado de baja
3	ANULADO	Registro anulado
4	PENDIENTE	Pendiente de completar
1	ACTIVO	Registro activo
\.


--
-- Data for Name: factura; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.factura (id_factura, numero_factura, fecha_factura, id_cliente, id_usuario, observacion, forma_pago, subtotal, impuesto, total, id_estado, id_usuario_modifi) FROM stdin;
1	F-000001	2025-12-10 16:56:32.851	1	1	Todo bien	CONTADO	15.00	1.80	16.80	1	1
2	F-000002	2025-12-10 16:57:51.136	1	1	TODO BIEN	CREDITO	20.00	2.40	22.40	1	1
3	F-000003	2026-01-05 06:21:58.415	1	1	\N	CONTADO	140.31	16.84	157.15	3	1
4	F-000004	2026-01-07 05:57:16.62	1	1	Compre algo, pero no quería que le del IVA a sus productos	CONTADO	40.00	4.80	44.80	3	1
5	F-000005	2026-01-07 08:15:30.46	1	1	\N	CONTADO	104.00	12.48	116.48	1	1
6	F-000006	2026-01-07 17:52:18.72	1	1	Compra de cuerdas	CONTADO	194.00	23.28	217.28	1	1
7	F-000007	2026-01-07 18:18:19.888	1	1	Compra de cuerdas	CONTADO	20.00	2.40	22.40	1	1
8	F-000008	2026-01-07 18:40:00.898	1	1	Compra de cuerdas	CONTADO	20.00	2.40	22.40	1	1
9	F-000009	2026-01-07 19:54:21.971	1	1	Compras de cuerdas ahora.	CONTADO	20.00	2.40	22.40	1	1
10	F-000010	2026-01-07 19:57:03.839	1	1	\N	CONTADO	100.00	12.00	112.00	1	1
11	F-000011	2026-01-07 20:03:38.229	1	1	\N	CONTADO	20.00	2.40	22.40	1	1
12	F-000012	2026-01-07 20:06:30.271	1	1	\N	CONTADO	100.00	12.00	112.00	1	1
13	F-000013	2026-01-07 21:25:53.393	1	1	\N	CONTADO	20.00	2.40	22.40	1	1
14	F-000014	2026-01-08 07:44:46.93	1	1	El mejor cliente	CONTADO	100.00	12.00	112.00	1	1
15	F-000015	2026-01-08 07:47:15.742	1	1	\N	CONTADO	20.00	2.40	22.40	1	1
16	F-000016	2026-01-08 07:51:37.894	1	1	\N	CONTADO	20.00	2.40	22.40	1	1
17	F-000017	2026-01-08 07:55:07.819	2	1	\N	CONTADO	20.00	2.40	22.40	1	1
18	F-000018	2026-01-08 07:57:57.717	2	1	\N	CONTADO	100.00	12.00	112.00	1	1
\.


--
-- Data for Name: kardex; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kardex (id_kardex, id_producto, fecha_movimiento, tipo_movimiento, origen, id_referencia, cantidad, costo_unitario, comentario, id_estado, id_usuario_modifi) FROM stdin;
1	1	2025-12-10 01:08:43.922106	ENTRADA	COMPRA	1	4	0.77	Ingreso por compra	1	\N
2	1	2025-12-10 06:08:43.946	ENTRADA	COMPRA	1	4	0.77	\N	1	1
3	1	2025-12-10 11:56:32.843223	SALIDA	VENTA	1	1	20.00	Salida por venta	1	\N
4	1	2025-12-10 16:56:32.89	SALIDA	VENTA	1	1	20.00	Todo bien	1	1
5	1	2025-12-10 11:57:51.130756	SALIDA	VENTA	2	1	20.00	Salida por venta	1	\N
6	1	2025-12-10 16:57:51.142	SALIDA	VENTA	2	1	20.00	TODO BIEN	1	1
7	1	2025-12-10 16:35:49.356078	ENTRADA	COMPRA	2	10	10.00	Ingreso por compra	1	\N
8	1	2025-12-10 21:35:49.393	ENTRADA	COMPRA	2	10	10.00	Compra de cuerdas	1	1
9	2	2026-01-05 01:21:58.406908	SALIDA	VENTA	3	7	20.05	Salida por venta	1	\N
10	2	2026-01-05 06:21:58.484	SALIDA	VENTA	3	7	20.05	\N	1	1
11	2	2026-01-05 06:22:04.605	ENTRADA	AJUSTE	3	7	20.05	Reverso de F-000003	1	1
12	2	2026-01-07 00:57:16.609707	SALIDA	VENTA	4	2	20.00	Salida por venta	1	\N
13	2	2026-01-07 05:57:16.698	SALIDA	VENTA	4	2	20.00	Compro algo	1	1
14	2	2026-01-07 07:34:04.102	ENTRADA	AJUSTE	4	2	20.00	Reverso de F-000004	1	1
15	1	2026-01-07 03:15:30.447246	SALIDA	VENTA	5	4	20.00	Salida por venta	1	\N
16	1	2026-01-07 08:15:30.478	SALIDA	VENTA	5	4	20.00	\N	1	1
17	3	2026-01-07 03:15:30.447246	SALIDA	VENTA	5	1	24.00	Salida por venta	1	\N
18	3	2026-01-07 08:15:30.484	SALIDA	VENTA	5	1	24.00	\N	1	1
19	1	2026-01-07 12:52:18.703237	SALIDA	VENTA	6	1	20.00	Salida por venta	1	\N
20	1	2026-01-07 17:52:18.776	SALIDA	VENTA	6	1	20.00	Compra de cuerdas	1	1
21	9	2026-01-07 12:52:18.703237	SALIDA	VENTA	6	1	20.00	Salida por venta	1	\N
22	9	2026-01-07 17:52:18.782	SALIDA	VENTA	6	1	20.00	Compra de cuerdas	1	1
23	3	2026-01-07 12:52:18.703237	SALIDA	VENTA	6	1	24.00	Salida por venta	1	\N
24	3	2026-01-07 17:52:18.79	SALIDA	VENTA	6	1	24.00	Compra de cuerdas	1	1
25	11	2026-01-07 12:52:18.703237	SALIDA	VENTA	6	1	100.00	Salida por venta	1	\N
26	11	2026-01-07 17:52:18.796	SALIDA	VENTA	6	1	100.00	Compra de cuerdas	1	1
27	4	2026-01-07 12:52:18.703237	SALIDA	VENTA	6	1	30.00	Salida por venta	1	\N
28	4	2026-01-07 17:52:18.802	SALIDA	VENTA	6	1	30.00	Compra de cuerdas	1	1
29	1	2026-01-07 13:18:19.879069	SALIDA	VENTA	7	1	20.00	Salida por venta	1	\N
30	1	2026-01-07 18:18:19.909	SALIDA	VENTA	7	1	20.00	Compra de cuerdas	1	1
31	1	2026-01-07 13:40:00.894273	SALIDA	VENTA	8	1	20.00	Salida por venta	1	\N
32	1	2026-01-07 18:40:00.916	SALIDA	VENTA	8	1	20.00	Compra de cuerdas	1	1
33	1	2026-01-07 14:54:21.964438	SALIDA	VENTA	9	1	20.00	Salida por venta	1	\N
34	1	2026-01-07 19:54:21.996	SALIDA	VENTA	9	1	20.00	Compras de cuerdas ahora.	1	1
35	11	2026-01-07 14:57:03.832253	SALIDA	VENTA	10	1	100.00	Salida por venta	1	\N
36	11	2026-01-07 19:57:03.848	SALIDA	VENTA	10	1	100.00	\N	1	1
37	1	2026-01-07 15:03:38.223501	SALIDA	VENTA	11	1	20.00	Salida por venta	1	\N
38	1	2026-01-07 20:03:38.246	SALIDA	VENTA	11	1	20.00	\N	1	1
39	11	2026-01-07 15:06:30.265445	SALIDA	VENTA	12	1	100.00	Salida por venta	1	\N
40	11	2026-01-07 20:06:30.279	SALIDA	VENTA	12	1	100.00	\N	1	1
41	8	2026-01-07 16:25:53.386954	SALIDA	VENTA	13	1	20.00	Salida por venta	1	\N
42	8	2026-01-07 21:25:53.414	SALIDA	VENTA	13	1	20.00	\N	1	1
43	11	2026-01-08 02:44:46.920938	SALIDA	VENTA	14	1	100.00	Salida por venta	1	\N
44	11	2026-01-08 07:44:46.978	SALIDA	VENTA	14	1	100.00	El mejor cliente	1	1
45	1	2026-01-08 02:47:15.736923	SALIDA	VENTA	15	1	20.00	Salida por venta	1	\N
46	1	2026-01-08 07:47:15.75	SALIDA	VENTA	15	1	20.00	\N	1	1
47	1	2026-01-08 02:51:37.890566	SALIDA	VENTA	16	1	20.00	Salida por venta	1	\N
48	1	2026-01-08 07:51:37.912	SALIDA	VENTA	16	1	20.00	\N	1	1
49	1	2026-01-08 02:55:07.78454	SALIDA	VENTA	17	1	20.00	Salida por venta	1	\N
50	1	2026-01-08 07:55:07.841	SALIDA	VENTA	17	1	20.00	\N	1	1
51	11	2026-01-08 02:57:57.710487	SALIDA	VENTA	18	1	100.00	Salida por venta	1	\N
52	11	2026-01-08 07:57:57.724	SALIDA	VENTA	18	1	100.00	\N	1	1
\.


--
-- Data for Name: producto; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.producto (id_producto, codigo_producto, nombre_producto, descripcion, id_proveedor, precio_compra, precio_venta, cantidad_stock, stock_minimo, fecha_creacion, id_estado, id_usuario_modifi) FROM stdin;
8	CRD-006	Cuerdas para Violín	\N	1	10.00	20.00	18	5	2025-12-16 01:27:09.499	1	1
12	AMP-002	Amplificador de requinto	\N	1	10.00	20.00	20	5	2026-01-07 23:22:58.948	1	1
1	CRD-001	Cuerdas de guitarra	Cuerdas de guitarra clasica	1	10.00	20.00	9	5	2025-12-10 06:08:10.445	1	1
5	ACC-001	Capotraste metálico	Capotraste ajustable de metal	1	0.00	12.00	20	4	2025-12-15 04:57:07.805	1	1
7	CRD-005	Ukele	Cuerdas de la mejor calidad	1	8.00	10.00	20	5	2025-12-15 22:51:15.552	1	1
10	AMP-001	GEO2	\N	1	40.00	50.00	10	2	2025-12-21 00:31:36.895	1	1
6	ACC-002	Afinador digital	Afinador cromático clip-on	1	0.00	16.00	15	3	2025-12-15 04:57:07.847	1	1
11	BAS-001	Bajo electrico	\N	1	50.00	100.00	0	0	2025-12-21 00:32:07.619	1	1
2	CRD-002	Cuerdas de guitarra clásica	Juego de cuerdas nylon para guitarra clásica	1	0.00	20.00	21	5	2025-12-15 04:57:07.639	1	1
9	CRD-007	Cuerdas para Violonchelo	\N	1	10.00	20.00	18	5	2025-12-16 01:27:09.565	1	1
3	CRD-003	Cuerdas de guitarra acústica	Juego de cuerdas acero para acústica	1	0.00	24.00	21	5	2025-12-15 04:57:07.714	1	1
4	CRD-004	Cuerdas de guitarra eléctrica	Juego de cuerdas níquel para eléctrica	1	0.00	30.00	38	8	2025-12-15 04:57:07.764	1	1
\.


--
-- Data for Name: producto_compra; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.producto_compra (id_producto_compra, id_compra, id_producto, cantidad_compra, costo_unitario, subtotal, id_estado, id_usuario_modifi) FROM stdin;
1	1	1	4	0.77	3.08	1	1
2	2	1	10	10.00	100.00	1	1
\.


--
-- Data for Name: proveedor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.proveedor (id_proveedor, nombre_proveedor, ruc_cedula, correo, telefono, direccion, fecha_registro, id_estado, id_usuario_modifi) FROM stdin;
1	Pincay	1314500741	pincay@gmail.com	0988227872	Orquides-Manta	2025-12-10 06:06:00.963	1	1
\.


--
-- Data for Name: usuario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuario (id_usuario, nombre_completo, correo, telefono, direccion, cedula, rol, password_hash, fecha_creacion, id_estado, id_usuario_modifi) FROM stdin;
1	David Anchundia	davidanchundia619@gmail.com	\N	\N	\N	ADMIN	$2b$10$JZZvg8fcmBp972c4SvO7kOAkTnn8JIUWtXeuVAsWAcNg1GKD/zeW6	2025-12-10 06:01:43.913	1	\N
\.


--
-- Name: cliente_id_cliente_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cliente_id_cliente_seq', 2, true);


--
-- Name: compra_id_compra_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.compra_id_compra_seq', 2, true);


--
-- Name: credito_id_credito_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.credito_id_credito_seq', 1, true);


--
-- Name: cuota_id_cuota_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cuota_id_cuota_seq', 2, true);


--
-- Name: detalle_factura_id_detalle_factura_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.detalle_factura_id_detalle_factura_seq', 23, true);


--
-- Name: estado_registro_id_estado_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.estado_registro_id_estado_seq', 23, true);


--
-- Name: factura_id_factura_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.factura_id_factura_seq', 18, true);


--
-- Name: kardex_id_kardex_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.kardex_id_kardex_seq', 52, true);


--
-- Name: producto_compra_id_producto_compra_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.producto_compra_id_producto_compra_seq', 2, true);


--
-- Name: producto_id_producto_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.producto_id_producto_seq', 12, true);


--
-- Name: proveedor_id_proveedor_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.proveedor_id_proveedor_seq', 1, true);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuario_id_usuario_seq', 2, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: cliente cliente_cedula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_cedula_key UNIQUE (cedula);


--
-- Name: cliente cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_pkey PRIMARY KEY (id_cliente);


--
-- Name: compra compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra
    ADD CONSTRAINT compra_pkey PRIMARY KEY (id_compra);


--
-- Name: credito credito_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito
    ADD CONSTRAINT credito_pkey PRIMARY KEY (id_credito);


--
-- Name: cuota cuota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuota
    ADD CONSTRAINT cuota_pkey PRIMARY KEY (id_cuota);


--
-- Name: detalle_factura detalle_factura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_factura
    ADD CONSTRAINT detalle_factura_pkey PRIMARY KEY (id_detalle_factura);


--
-- Name: estado_registro estado_registro_nombre_estado_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estado_registro
    ADD CONSTRAINT estado_registro_nombre_estado_key UNIQUE (nombre_estado);


--
-- Name: estado_registro estado_registro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estado_registro
    ADD CONSTRAINT estado_registro_pkey PRIMARY KEY (id_estado);


--
-- Name: factura factura_numero_factura_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factura
    ADD CONSTRAINT factura_numero_factura_key UNIQUE (numero_factura);


--
-- Name: factura factura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factura
    ADD CONSTRAINT factura_pkey PRIMARY KEY (id_factura);


--
-- Name: kardex kardex_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT kardex_pkey PRIMARY KEY (id_kardex);


--
-- Name: producto producto_codigo_producto_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT producto_codigo_producto_key UNIQUE (codigo_producto);


--
-- Name: producto_compra producto_compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_compra
    ADD CONSTRAINT producto_compra_pkey PRIMARY KEY (id_producto_compra);


--
-- Name: producto producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT producto_pkey PRIMARY KEY (id_producto);


--
-- Name: proveedor proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT proveedor_pkey PRIMARY KEY (id_proveedor);


--
-- Name: proveedor proveedor_ruc_cedula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT proveedor_ruc_cedula_key UNIQUE (ruc_cedula);


--
-- Name: usuario usuario_cedula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_cedula_key UNIQUE (cedula);


--
-- Name: usuario usuario_correo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_correo_key UNIQUE (correo);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: ix_detalle_factura_id_factura; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_detalle_factura_id_factura ON public.detalle_factura USING btree (id_factura);


--
-- Name: ix_detalle_factura_id_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_detalle_factura_id_producto ON public.detalle_factura USING btree (id_producto);


--
-- Name: ix_factura_cliente_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_factura_cliente_fecha ON public.factura USING btree (id_cliente, fecha_factura);


--
-- Name: ix_factura_estado_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_factura_estado_fecha ON public.factura USING btree (id_estado, fecha_factura);


--
-- Name: ix_factura_forma_pago_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_factura_forma_pago_fecha ON public.factura USING btree (forma_pago, fecha_factura);


--
-- Name: ix_kardex_producto_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_kardex_producto_fecha ON public.kardex USING btree (id_producto, fecha_movimiento);


--
-- Name: ix_producto_estado_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_producto_estado_fecha ON public.producto USING btree (id_estado, fecha_creacion);


--
-- Name: ix_producto_estado_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_producto_estado_proveedor ON public.producto USING btree (id_estado, id_proveedor);


--
-- Name: ix_producto_estado_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_producto_estado_stock ON public.producto USING btree (id_estado, cantidad_stock);


--
-- Name: ux_cuota_unica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_cuota_unica ON public.cuota USING btree (id_credito, numero_cuota);


--
-- Name: ux_detalle_factura_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_detalle_factura_unico ON public.detalle_factura USING btree (id_factura, id_producto);


--
-- Name: ux_producto_compra_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_producto_compra_unico ON public.producto_compra USING btree (id_compra, id_producto);


--
-- Name: detalle_factura detalle_factura_ai; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER detalle_factura_ai AFTER INSERT ON public.detalle_factura FOR EACH ROW EXECUTE FUNCTION public.trg_detalle_factura_after_insert();


--
-- Name: producto_compra producto_compra_ai; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER producto_compra_ai AFTER INSERT ON public.producto_compra FOR EACH ROW EXECUTE FUNCTION public.trg_producto_compra_after_insert();


--
-- Name: cliente fk_cliente_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT fk_cliente_estado FOREIGN KEY (id_estado) REFERENCES public.estado_registro(id_estado);


--
-- Name: cliente fk_cliente_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT fk_cliente_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: compra fk_compra_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra
    ADD CONSTRAINT fk_compra_estado FOREIGN KEY (id_estado) REFERENCES public.estado_registro(id_estado);


--
-- Name: compra fk_compra_proveedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra
    ADD CONSTRAINT fk_compra_proveedor FOREIGN KEY (id_proveedor) REFERENCES public.proveedor(id_proveedor);


--
-- Name: compra fk_compra_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra
    ADD CONSTRAINT fk_compra_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: compra fk_compra_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra
    ADD CONSTRAINT fk_compra_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: credito fk_credito_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito
    ADD CONSTRAINT fk_credito_estado FOREIGN KEY (id_estado) REFERENCES public.estado_registro(id_estado);


--
-- Name: credito fk_credito_factura; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito
    ADD CONSTRAINT fk_credito_factura FOREIGN KEY (id_factura) REFERENCES public.factura(id_factura);


--
-- Name: credito fk_credito_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito
    ADD CONSTRAINT fk_credito_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: cuota fk_cuota_credito; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuota
    ADD CONSTRAINT fk_cuota_credito FOREIGN KEY (id_credito) REFERENCES public.credito(id_credito) ON DELETE CASCADE;


--
-- Name: cuota fk_cuota_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuota
    ADD CONSTRAINT fk_cuota_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: detalle_factura fk_detalle_factura; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_factura
    ADD CONSTRAINT fk_detalle_factura FOREIGN KEY (id_factura) REFERENCES public.factura(id_factura) ON DELETE CASCADE;


--
-- Name: detalle_factura fk_detalle_factura_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_factura
    ADD CONSTRAINT fk_detalle_factura_estado FOREIGN KEY (id_estado) REFERENCES public.estado_registro(id_estado);


--
-- Name: detalle_factura fk_detalle_factura_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_factura
    ADD CONSTRAINT fk_detalle_factura_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: detalle_factura fk_detalle_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_factura
    ADD CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto) REFERENCES public.producto(id_producto);


--
-- Name: factura fk_factura_cliente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factura
    ADD CONSTRAINT fk_factura_cliente FOREIGN KEY (id_cliente) REFERENCES public.cliente(id_cliente);


--
-- Name: factura fk_factura_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factura
    ADD CONSTRAINT fk_factura_estado FOREIGN KEY (id_estado) REFERENCES public.estado_registro(id_estado);


--
-- Name: factura fk_factura_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factura
    ADD CONSTRAINT fk_factura_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: factura fk_factura_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factura
    ADD CONSTRAINT fk_factura_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: kardex fk_kardex_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT fk_kardex_estado FOREIGN KEY (id_estado) REFERENCES public.estado_registro(id_estado);


--
-- Name: kardex fk_kardex_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT fk_kardex_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: kardex fk_kx_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT fk_kx_producto FOREIGN KEY (id_producto) REFERENCES public.producto(id_producto);


--
-- Name: producto_compra fk_pc_compra; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_compra
    ADD CONSTRAINT fk_pc_compra FOREIGN KEY (id_compra) REFERENCES public.compra(id_compra) ON DELETE CASCADE;


--
-- Name: producto_compra fk_pc_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_compra
    ADD CONSTRAINT fk_pc_producto FOREIGN KEY (id_producto) REFERENCES public.producto(id_producto);


--
-- Name: producto_compra fk_producto_compra_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_compra
    ADD CONSTRAINT fk_producto_compra_estado FOREIGN KEY (id_estado) REFERENCES public.estado_registro(id_estado);


--
-- Name: producto_compra fk_producto_compra_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_compra
    ADD CONSTRAINT fk_producto_compra_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: producto fk_producto_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT fk_producto_estado FOREIGN KEY (id_estado) REFERENCES public.estado_registro(id_estado);


--
-- Name: producto fk_producto_proveedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT fk_producto_proveedor FOREIGN KEY (id_proveedor) REFERENCES public.proveedor(id_proveedor);


--
-- Name: producto fk_producto_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT fk_producto_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: proveedor fk_proveedor_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT fk_proveedor_estado FOREIGN KEY (id_estado) REFERENCES public.estado_registro(id_estado);


--
-- Name: proveedor fk_proveedor_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT fk_proveedor_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: usuario fk_usuario_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT fk_usuario_estado FOREIGN KEY (id_estado) REFERENCES public.estado_registro(id_estado);


--
-- Name: usuario fk_usuario_usuario_modifi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT fk_usuario_usuario_modifi FOREIGN KEY (id_usuario_modifi) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict c11NjA8hTkaKbJUSeble7ItxBgMwGdk0Vr8ykjdXpdr8blnRfuPjYuGgeBoygJg

