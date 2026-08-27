-- Analytics próprio: jornada do visitante na vitrine (Meta trackCustom + Supabase).
-- Eventos: SiteView, SearchProduct, ProductOpen, ProductClose, ClickShopee.
-- Idempotente: seguro rodar mais de uma vez.

create extension if not exists "pgcrypto";

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_name text not null check (event_name in (
    'SiteView', 'SearchProduct', 'ProductOpen', 'ProductClose', 'ClickShopee'
  )),
  session_id uuid not null,
  product_id bigint,
  product_position integer check (product_position is null or product_position between 1 and 1000),
  product_section text,
  search_term text,
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 3600000),
  source text check (source is null or source in ('modal', 'card', 'unknown')),
  url text,
  ip_hash text,
  user_agent text,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_session_id_idx
  on public.analytics_events (session_id, created_at);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

comment on table public.analytics_events is
  'Eventos customizados da vitrine (SiteView, SearchProduct, ProductOpen, ProductClose, ClickShopee).';
