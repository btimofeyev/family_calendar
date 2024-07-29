--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3 (Ubuntu 16.3-1.pgdg22.04+1)
-- Dumped by pg_dump version 16.3 (Ubuntu 16.3-1.pgdg22.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: btimofeyev
--

CREATE TABLE public.calendar_events (
    id integer NOT NULL,
    family_id integer,
    title character varying(255),
    description text,
    event_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.calendar_events OWNER TO btimofeyev;

--
-- Name: calendar_events_id_seq; Type: SEQUENCE; Schema: public; Owner: btimofeyev
--

CREATE SEQUENCE public.calendar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendar_events_id_seq OWNER TO btimofeyev;

--
-- Name: calendar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: btimofeyev
--

ALTER SEQUENCE public.calendar_events_id_seq OWNED BY public.calendar_events.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: btimofeyev
--

CREATE TABLE public.comments (
    comment_id integer NOT NULL,
    post_id integer,
    author_id integer,
    text text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.comments OWNER TO btimofeyev;

--
-- Name: comments_comment_id_seq; Type: SEQUENCE; Schema: public; Owner: btimofeyev
--

CREATE SEQUENCE public.comments_comment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_comment_id_seq OWNER TO btimofeyev;

--
-- Name: comments_comment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: btimofeyev
--

ALTER SEQUENCE public.comments_comment_id_seq OWNED BY public.comments.comment_id;


--
-- Name: families; Type: TABLE; Schema: public; Owner: btimofeyev
--

CREATE TABLE public.families (
    family_id integer NOT NULL,
    family_name character varying(255)
);


ALTER TABLE public.families OWNER TO btimofeyev;

--
-- Name: families_family_id_seq; Type: SEQUENCE; Schema: public; Owner: btimofeyev
--

CREATE SEQUENCE public.families_family_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.families_family_id_seq OWNER TO btimofeyev;

--
-- Name: families_family_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: btimofeyev
--

ALTER SEQUENCE public.families_family_id_seq OWNED BY public.families.family_id;


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: btimofeyev
--

CREATE TABLE public.invitations (
    id integer NOT NULL,
    family_id integer NOT NULL,
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone
);


ALTER TABLE public.invitations OWNER TO btimofeyev;

--
-- Name: invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: btimofeyev
--

CREATE SEQUENCE public.invitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invitations_id_seq OWNER TO btimofeyev;

--
-- Name: invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: btimofeyev
--

ALTER SEQUENCE public.invitations_id_seq OWNED BY public.invitations.id;


--
-- Name: likes; Type: TABLE; Schema: public; Owner: btimofeyev
--

CREATE TABLE public.likes (
    like_id integer NOT NULL,
    post_id integer,
    user_id integer
);


ALTER TABLE public.likes OWNER TO btimofeyev;

--
-- Name: likes_like_id_seq; Type: SEQUENCE; Schema: public; Owner: btimofeyev
--

CREATE SEQUENCE public.likes_like_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.likes_like_id_seq OWNER TO btimofeyev;

--
-- Name: likes_like_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: btimofeyev
--

ALTER SEQUENCE public.likes_like_id_seq OWNED BY public.likes.like_id;


--
-- Name: posts; Type: TABLE; Schema: public; Owner: btimofeyev
--

CREATE TABLE public.posts (
    post_id integer NOT NULL,
    author_id integer,
    family_id integer,
    image_url text,
    caption text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.posts OWNER TO btimofeyev;

--
-- Name: posts_post_id_seq; Type: SEQUENCE; Schema: public; Owner: btimofeyev
--

CREATE SEQUENCE public.posts_post_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.posts_post_id_seq OWNER TO btimofeyev;

--
-- Name: posts_post_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: btimofeyev
--

ALTER SEQUENCE public.posts_post_id_seq OWNED BY public.posts.post_id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: btimofeyev
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(255),
    family_id integer,
    role character varying(20) DEFAULT 'member'::character varying
);


ALTER TABLE public.users OWNER TO btimofeyev;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: btimofeyev
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO btimofeyev;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: btimofeyev
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: calendar_events id; Type: DEFAULT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.calendar_events ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_id_seq'::regclass);


--
-- Name: comments comment_id; Type: DEFAULT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.comments ALTER COLUMN comment_id SET DEFAULT nextval('public.comments_comment_id_seq'::regclass);


--
-- Name: families family_id; Type: DEFAULT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.families ALTER COLUMN family_id SET DEFAULT nextval('public.families_family_id_seq'::regclass);


--
-- Name: invitations id; Type: DEFAULT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.invitations ALTER COLUMN id SET DEFAULT nextval('public.invitations_id_seq'::regclass);


--
-- Name: likes like_id; Type: DEFAULT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.likes ALTER COLUMN like_id SET DEFAULT nextval('public.likes_like_id_seq'::regclass);


--
-- Name: posts post_id; Type: DEFAULT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.posts ALTER COLUMN post_id SET DEFAULT nextval('public.posts_post_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: calendar_events; Type: TABLE DATA; Schema: public; Owner: btimofeyev
--

COPY public.calendar_events (id, family_id, title, description, event_date, created_at, updated_at) FROM stdin;
1	1	Malachi's Birthday		2024-07-27 00:00:00	2024-07-22 18:57:23.194004	2024-07-22 18:57:23.194004
2	1	Jacobs Game 	https://www.youtube.com/watch?v=PPV_ZiZVjoo&list=RDTc6T3JF4UJw&index=2&ab_channel=DRKoncerthuset	2024-07-28 00:00:00	2024-07-22 19:14:08.838601	2024-07-22 19:14:08.838601
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: btimofeyev
--

COPY public.comments (comment_id, post_id, author_id, text, created_at) FROM stdin;
1	2	1	Comments are working	2024-07-22 19:22:30.847197
2	2	1	2nd comment	2024-07-22 19:22:39.73342
34	4	2	Eliana	2024-07-23 19:40:56.744289
35	2	2	Does commenting work	2024-07-23 19:42:06.418218
36	4	2	Hello	2024-07-24 17:27:19.706587
37	1	2	Hello	2024-07-24 17:28:24.532229
38	4	2	second cooment	2024-07-24 17:28:45.747562
39	5	2	Hello	2024-07-24 17:40:30.858642
40	6	2	Hello	2024-07-25 12:13:50.612414
\.


--
-- Data for Name: families; Type: TABLE DATA; Schema: public; Owner: btimofeyev
--

COPY public.families (family_id, family_name) FROM stdin;
1	Timofeyev
2	Timofeyev
3	Timofeyev
4	ABC
\.


--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: btimofeyev
--

COPY public.invitations (id, family_id, email, token, status, created_at, expires_at) FROM stdin;
1	1	btimofeyev@gmail.com	8d9ab00f1cddb948af46b76cf10365b129c00d73	pending	2024-07-23 18:42:52.458789	2024-07-30 15:42:53.051
2	1	btimofeyev@gmail.com	5233b93e1cdc8fbd1a5b5c2a75823f22978afce1	pending	2024-07-23 18:43:13.804683	2024-07-30 15:43:14.398
3	1	btimofeyev@gmail.com	697687856a535e0e205bbe724918ce9327e2bfb9	pending	2024-07-23 19:18:57.338942	2024-07-30 16:18:57.907
4	1	btimofeyev@gmail.com	b134e7561118e7d987f70287bc72b17af542416d	pending	2024-07-23 19:28:15.111508	2024-07-30 16:28:15.664
5	1	btimofeyev@gmail.com	2e1a7b0179f6e96bd2bcfe5c4b512273e43625ba	pending	2024-07-23 19:29:01.320697	2024-07-30 16:29:01.871
6	1	btimofeyev@gmail.com	cc8eada69f4d1af0bc4ed208d0aa9c0c473f8d00	accepted	2024-07-23 19:37:24.546115	2024-07-30 16:37:25.085
\.


--
-- Data for Name: likes; Type: TABLE DATA; Schema: public; Owner: btimofeyev
--

COPY public.likes (like_id, post_id, user_id) FROM stdin;
3	1	1
4	2	1
7	2	2
10	6	2
\.


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: btimofeyev
--

COPY public.posts (post_id, author_id, family_id, image_url, caption, created_at) FROM stdin;
1	1	1	https://homeschoolprofile.s3.us-east-2.amazonaws.com/photo-1721684496365-513186320.png	Ninjago	2024-07-22 17:41:38.210092
2	1	1	\N	Testing this out	2024-07-22 18:24:33.200244
3	1	1	\N	Hello World	2024-07-22 19:12:41.236239
4	1	1	https://homeschoolprofile.s3.us-east-2.amazonaws.com/photo-1721689994063-117441309.png	neew	2024-07-22 19:13:15.913714
5	1	1	\N	https://www.youtube.com/watch?v=PPV_ZiZVjoo&list=RDTc6T3JF4UJw&index=2&ab_channel=DRKoncerthuset	2024-07-22 19:14:22.122746
6	2	1	\N	New user	2024-07-23 19:40:30.400881
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: btimofeyev
--

COPY public.users (id, email, password, name, family_id, role) FROM stdin;
1	jacob@gmail.com	$2b$10$CNducqqSH3nh4aVCKmevGejrSuxVYFOLi5ELFFycbZNlb0FDNU/O.	Ben	1	admin
2	btimofeyev@gmail.com	$2b$10$Pi5TVplykxAVBoHznHiOVeD5naQte0laVgb/t61MIYB7GPMrlfegm	Eliana	1	member
4	timofeyevben@yahoo.com	$2b$10$EMVaXJqesvjRnOcPYPPbxu9O1n9dcQlBIF1AFU7z.d0Rri5Qk7WLK	Ben Timofeyev	4	member
\.


--
-- Name: calendar_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: btimofeyev
--

SELECT pg_catalog.setval('public.calendar_events_id_seq', 2, true);


--
-- Name: comments_comment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: btimofeyev
--

SELECT pg_catalog.setval('public.comments_comment_id_seq', 40, true);


--
-- Name: families_family_id_seq; Type: SEQUENCE SET; Schema: public; Owner: btimofeyev
--

SELECT pg_catalog.setval('public.families_family_id_seq', 4, true);


--
-- Name: invitations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: btimofeyev
--

SELECT pg_catalog.setval('public.invitations_id_seq', 6, true);


--
-- Name: likes_like_id_seq; Type: SEQUENCE SET; Schema: public; Owner: btimofeyev
--

SELECT pg_catalog.setval('public.likes_like_id_seq', 10, true);


--
-- Name: posts_post_id_seq; Type: SEQUENCE SET; Schema: public; Owner: btimofeyev
--

SELECT pg_catalog.setval('public.posts_post_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: btimofeyev
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (comment_id);


--
-- Name: families families_pkey; Type: CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_pkey PRIMARY KEY (family_id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_key UNIQUE (token);


--
-- Name: likes likes_pkey; Type: CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_pkey PRIMARY KEY (like_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (post_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(family_id);


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(post_id);


--
-- Name: invitations invitations_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(family_id);


--
-- Name: likes likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(post_id);


--
-- Name: likes likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: posts posts_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(family_id);


--
-- Name: users users_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btimofeyev
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(family_id);


--
-- PostgreSQL database dump complete
--

