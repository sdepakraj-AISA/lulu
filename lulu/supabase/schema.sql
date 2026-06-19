-- ============================================================
-- Lulu — Supabase Schema
-- Run this in Supabase SQL Editor (project → SQL Editor → New query)
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- BUSINESSES
-- Core record for every SMB that signs up on Lulu
-- ============================================================
create table if not exists businesses (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  slug            text unique not null,           -- used in MCP endpoint URL: /api/mcp/<slug>
  description     text,
  category        text,                           -- 'retail' | 'service' | 'restaurant' | etc.
  website         text,
  phone           text,
  email           text,
  address         jsonb,                          -- { street, city, province, country, postal }
  hours           jsonb,                          -- { mon: '9-5', tue: '9-5', ... }
  plan            text not null default 'free',   -- 'free' | 'starter' | 'growth' | 'pro'
  registry_listed boolean not null default false, -- free tier = false; starter+ = true
  api_key         text unique default encode(gen_random_bytes(32), 'hex'),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- CONNECTORS
-- Each row = one integration (Shopify, Google Business, etc.)
-- linked to a business
-- ============================================================
create table if not exists connectors (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid references businesses(id) on delete cascade not null,
  type            text not null,                  -- 'shopify' | 'google_business' | 'merge_hris' | etc.
  status          text not null default 'pending', -- 'pending' | 'connected' | 'error' | 'disconnected'
  merge_account_token text,                       -- Merge.dev account token after OAuth
  last_synced_at  timestamptz,
  sync_error      text,
  config          jsonb,                          -- connector-specific config (store domain, etc.)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- MCP_SERVERS
-- Metadata for the hosted MCP server generated per business
-- ============================================================
create table if not exists mcp_servers (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid references businesses(id) on delete cascade not null unique,
  endpoint_url    text not null,                  -- e.g. https://api.getlulu.ai/api/mcp/<slug>
  tool_schema     jsonb,                          -- generated tool definitions (schema-generator output)
  version         integer not null default 1,
  last_built_at   timestamptz,
  build_status    text not null default 'pending', -- 'pending' | 'building' | 'live' | 'error'
  build_error     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- REGISTRY
-- The Lulu master registry — what AI agents query to find businesses
-- Only registry_listed=true businesses appear here
-- ============================================================
create table if not exists registry (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid references businesses(id) on delete cascade not null unique,
  search_vector   tsvector,                       -- full-text search index
  category        text,
  location        jsonb,                          -- { city, province, country }
  capabilities    text[],                         -- ['search_products', 'check_inventory', 'get_pricing']
  quality_score   numeric(4,2) default 100.0,     -- 0–100; degrades on stale data / downtime
  uptime_pct      numeric(5,2) default 100.0,
  avg_response_ms integer default 0,
  total_queries   bigint default 0,
  last_queried_at timestamptz,
  listed_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Full-text search index on registry
create index if not exists registry_search_idx on registry using gin(search_vector);

-- ============================================================
-- ANALYTICS_EVENTS
-- Every agent query, click-through, and conversion
-- Powers the attribution dashboard
-- ============================================================
create table if not exists analytics_events (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid references businesses(id) on delete cascade not null,
  event_type      text not null,                  -- 'registry_query' | 'mcp_tool_call' | 'click_through'
  agent_name      text,                           -- 'claude' | 'chatgpt' | 'gemini' | 'unknown'
  tool_called     text,                           -- which MCP tool was invoked
  query_text      text,                           -- what the agent searched for
  response_ms     integer,                        -- latency
  success         boolean default true,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

-- Index for dashboard queries
create index if not exists analytics_business_time_idx
  on analytics_events(business_id, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- Businesses can only read/write their own data
-- ============================================================
alter table businesses        enable row level security;
alter table connectors        enable row level security;
alter table mcp_servers       enable row level security;
alter table analytics_events  enable row level security;

-- Registry is publicly readable (agents need to query it)
alter table registry          enable row level security;

-- Businesses: owner can do everything
create policy "owner_all" on businesses
  for all using (auth.uid() = owner_id);

-- Connectors: owner of parent business
create policy "owner_all" on connectors
  for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- MCP servers: owner of parent business
create policy "owner_all" on mcp_servers
  for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- Analytics: owner read-only (writes happen via service role only)
create policy "owner_read" on analytics_events
  for select using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- Registry: anyone can read (AI agents query this unauthenticated)
create policy "public_read" on registry
  for select using (true);

-- ============================================================
-- TRIGGERS — updated_at auto-update
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_updated_at
  before update on businesses
  for each row execute function set_updated_at();

create trigger connectors_updated_at
  before update on connectors
  for each row execute function set_updated_at();

create trigger mcp_servers_updated_at
  before update on mcp_servers
  for each row execute function set_updated_at();

create trigger registry_updated_at
  before update on registry
  for each row execute function set_updated_at();

-- ============================================================
-- FUNCTION: update_registry_search_vector
-- Keeps full-text search index fresh when a business is listed
-- ============================================================
create or replace function update_registry_search_vector()
returns trigger language plpgsql as $$
declare
  biz businesses%rowtype;
begin
  select * into biz from businesses where id = new.business_id;
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(biz.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(biz.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(biz.category, '')), 'C');
  return new;
end;
$$;

create trigger registry_search_vector_update
  before insert or update on registry
  for each row execute function update_registry_search_vector();
