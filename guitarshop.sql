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
-- PostgreSQL database dump complete
--

\unrestrict SanFmzcIza73Dt0ie5wxweUeiuAl6TLBeZYUdYVjKiAzpaJkdrQxcXaequoL0P2

