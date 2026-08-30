-- Funil por campanha: utm + InitiateCheckout no analytics próprio.

alter table public.analytics_events
  add column if not exists utm_campaign text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text;

alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events
  add constraint analytics_events_event_name_check
  check (event_name in (
    'SiteView', 'SearchProduct', 'ProductOpen', 'ProductClose', 'ClickShopee',
    'InitiateCheckout', 'Search', 'PageView'
  ));

create index if not exists analytics_events_utm_campaign_idx
  on public.analytics_events (utm_campaign, event_name, created_at desc);

create index if not exists analytics_events_product_campaign_idx
  on public.analytics_events (utm_campaign, product_id, created_at desc);

comment on column public.analytics_events.utm_campaign is
  'Slug da campanha (utm_campaign sanitizado) para funil por anúncio.';
