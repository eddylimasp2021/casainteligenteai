-- =====================================================================
-- CASA INTELIGENTE I.A. — ESQUEMA COMPLETO INDEPENDENTE SUPABASE
-- =====================================================================

-- Extensões necessárias
create extension if not exists "uuid-ossp";

-- Enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'device_status') then
    create type public.device_status as enum ('online', 'offline', 'unavailable', 'pairing');
  end if;
  if not exists (select 1 from pg_type where typname = 'household_role') then
    create type public.household_role as enum ('owner', 'admin', 'member', 'guest');
  end if;
  if not exists (select 1 from pg_type where typname = 'iot_gateway_status') then
    create type public.iot_gateway_status as enum ('online', 'offline', 'degraded', 'maintenance');
  end if;
  if not exists (select 1 from pg_type where typname = 'iot_integration_type') then
    create type public.iot_integration_type as enum ('mqtt', 'home_assistant', 'zigbee2mqtt', 'matter', 'esp32');
  end if;
  if not exists (select 1 from pg_type where typname = 'iot_integration_status') then
    create type public.iot_integration_status as enum ('connected', 'disconnected', 'error', 'degraded');
  end if;
  if not exists (select 1 from pg_type where typname = 'iot_command_status') then
    create type public.iot_command_status as enum (
      'CREATED', 'AUTHORIZED', 'QUEUED', 'SENT', 'ACKNOWLEDGED', 'SUCCEEDED',
      'FAILED', 'EXPIRED', 'REJECTED', 'TIMED_OUT', 'CANCELLED'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'iot_device_availability') then
    create type public.iot_device_availability as enum ('online', 'offline', 'unknown');
  end if;
end $$;

-- 1. Households (Residências)
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Household Members (Membros da Residência)
create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null,
  role public.household_role not null default 'member',
  created_at timestamptz not null default now()
);

-- 3. Rooms (Cômodos)
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  icon text,
  floor integer default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Devices (Dispositivos)
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  name text not null,
  category text not null,
  device_type text not null,
  protocol text not null default 'wifi',
  status public.device_status not null default 'online',
  capabilities text[] not null default '{}',
  state jsonb not null default '{}'::jsonb,
  ip_address text,
  model text,
  manufacturer text,
  firmware text,
  external_id text,
  is_critical boolean not null default false,
  simulated boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Automations (Automações)
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  enabled boolean not null default true,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Audit Logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid,
  device_id uuid references public.devices(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  result text not null,
  source text not null default 'web',
  created_at timestamptz not null default now()
);

-- 7. Energy Metrics
create table if not exists public.energy_metrics (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  power_watts numeric(10, 2) not null default 0,
  voltage numeric(6, 2),
  current_amperes numeric(6, 2),
  energy_kwh numeric(12, 4) not null default 0,
  cost_estimate numeric(10, 2) not null default 0,
  recorded_at timestamptz not null default now()
);

-- 8. Security Events
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  details jsonb not null default '{}'::jsonb,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- 9. IoT Gateways
create table if not exists public.iot_gateways (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  gateway_key text not null unique,
  version text not null default '1.0.0',
  status public.iot_gateway_status not null default 'offline',
  ip_address text,
  supported_integrations text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Inserir dados padrão para Casa Master
insert into public.households (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Casa Inteligente Master')
on conflict (id) do nothing;

-- Inserir Cômodos Padrão
insert into public.rooms (household_id, name, floor) values
('11111111-1111-1111-1111-111111111111', 'Sala de Estar', 1),
('11111111-1111-1111-1111-111111111111', 'Garagem & Portão', 1),
('11111111-1111-1111-1111-111111111111', 'Quarto Principal', 2),
('11111111-1111-1111-1111-111111111111', 'Cozinha', 1)
on conflict do nothing;

-- Inserir Gateway Principal
insert into public.iot_gateways (household_id, name, gateway_key, status, ip_address, supported_integrations)
values (
  '11111111-1111-1111-1111-111111111111',
  'Gateway Local Python',
  'gw-master-principal-01',
  'online',
  '127.0.0.1',
  array['home_assistant', 'mqtt', 'matter', 'zigbee2mqtt']
)
on conflict (gateway_key) do nothing;

-- Inserir Dispositivos Iniciais (TV LG, Câmeras, Luzes)
insert into public.devices (household_id, name, category, device_type, protocol, status, capabilities, ip_address)
values
('11111111-1111-1111-1111-111111111111', 'Smart TV LG Sala', 'media', 'tv', 'wifi', 'online', array['power', 'volume', 'apps', 'source'], '192.168.0.168'),
('11111111-1111-1111-1111-111111111111', 'Câmera Tripla Lente 1', 'security', 'camera', 'rtsp', 'online', array['video_stream', 'ptz', 'motion'], '192.168.0.139'),
('11111111-1111-1111-1111-111111111111', 'Câmera IP Garagem', 'security', 'camera', 'rtsp', 'online', array['video_stream', 'night_vision'], '192.168.0.198'),
('11111111-1111-1111-1111-111111111111', 'Luz Sala de Estar', 'lighting', 'light', 'zigbee', 'online', array['power', 'brightness', 'color'], null)
on conflict do nothing;

-- Permissões gerais para acesso seguro
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
