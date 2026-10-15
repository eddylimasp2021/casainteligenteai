-- =====================================================================
-- CASA INTELIGENTE I.A. — IoT Gateway, MQTT, Adapters & Command Lifecycle
-- Migration: 20261014230000_iot_gateway_core.sql
-- =====================================================================

-- Enums
do $$ begin
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

-- 1. IoT Gateways
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
create index if not exists idx_iot_gateways_household on public.iot_gateways(household_id);
create index if not exists idx_iot_gateways_key on public.iot_gateways(gateway_key);
grant select, insert, update, delete on public.iot_gateways to authenticated;
grant all on public.iot_gateways to service_role;
alter table public.iot_gateways enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'members read iot_gateways' and tablename = 'iot_gateways') then
    create policy "members read iot_gateways" on public.iot_gateways for select to authenticated using (public.is_household_member(household_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'admins manage iot_gateways' and tablename = 'iot_gateways') then
    create policy "admins manage iot_gateways" on public.iot_gateways for all to authenticated using (public.is_household_admin(household_id, auth.uid())) with check (public.is_household_admin(household_id, auth.uid()));
  end if;
end $$;

create or replace trigger iot_gateways_touch before update on public.iot_gateways for each row execute function public.touch_updated_at();

-- 2. IoT Integrations
create table if not exists public.iot_integrations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  gateway_id uuid references public.iot_gateways(id) on delete cascade,
  type public.iot_integration_type not null,
  name text not null,
  enabled boolean not null default true,
  status public.iot_integration_status not null default 'disconnected',
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  error_message text,
  devices_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, type)
);
create index if not exists idx_iot_integrations_household on public.iot_integrations(household_id);
create index if not exists idx_iot_integrations_gateway on public.iot_integrations(gateway_id);
grant select, insert, update, delete on public.iot_integrations to authenticated;
grant all on public.iot_integrations to service_role;
alter table public.iot_integrations enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'members read iot_integrations' and tablename = 'iot_integrations') then
    create policy "members read iot_integrations" on public.iot_integrations for select to authenticated using (public.is_household_member(household_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'admins manage iot_integrations' and tablename = 'iot_integrations') then
    create policy "admins manage iot_integrations" on public.iot_integrations for all to authenticated using (public.is_household_admin(household_id, auth.uid())) with check (public.is_household_admin(household_id, auth.uid()));
  end if;
end $$;

create or replace trigger iot_integrations_touch before update on public.iot_integrations for each row execute function public.touch_updated_at();

-- 3. IoT Devices (Unified Physical Device Shadow)
create table if not exists public.iot_devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  device_id uuid references public.devices(id) on delete cascade,
  gateway_id uuid references public.iot_gateways(id) on delete set null,
  integration_id uuid references public.iot_integrations(id) on delete set null,
  external_id text not null,
  protocol text not null,
  name text not null,
  availability public.iot_device_availability not null default 'unknown',
  desired_state jsonb not null default '{}'::jsonb,
  reported_state jsonb not null default '{}'::jsonb,
  battery_level int,
  signal_quality int,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, external_id)
);
create index if not exists idx_iot_devices_household on public.iot_devices(household_id);
create index if not exists idx_iot_devices_device_id on public.iot_devices(device_id);
create index if not exists idx_iot_devices_gateway on public.iot_devices(gateway_id);
grant select, insert, update, delete on public.iot_devices to authenticated;
grant all on public.iot_devices to service_role;
alter table public.iot_devices enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'members read iot_devices' and tablename = 'iot_devices') then
    create policy "members read iot_devices" on public.iot_devices for select to authenticated using (public.is_household_member(household_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'admins manage iot_devices' and tablename = 'iot_devices') then
    create policy "admins manage iot_devices" on public.iot_devices for all to authenticated using (public.is_household_admin(household_id, auth.uid())) with check (public.is_household_admin(household_id, auth.uid()));
  end if;
end $$;

create or replace trigger iot_devices_touch before update on public.iot_devices for each row execute function public.touch_updated_at();

-- 4. IoT Device Capabilities
create table if not exists public.iot_device_capabilities (
  id uuid primary key default gen_random_uuid(),
  iot_device_id uuid not null references public.iot_devices(id) on delete cascade,
  capability_id text not null,
  type text not null,
  readable boolean not null default true,
  writable boolean not null default true,
  unit text,
  metadata jsonb not null default '{}'::jsonb,
  unique (iot_device_id, capability_id)
);
create index if not exists idx_iot_device_caps on public.iot_device_capabilities(iot_device_id);
grant select, insert, update, delete on public.iot_device_capabilities to authenticated;
grant all on public.iot_device_capabilities to service_role;
alter table public.iot_device_capabilities enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'members read iot_caps' and tablename = 'iot_device_capabilities') then
    create policy "members read iot_caps" on public.iot_device_capabilities for select to authenticated using (
      exists (select 1 from public.iot_devices d where d.id = iot_device_id and public.is_household_member(d.household_id, auth.uid()))
    );
  end if;
end $$;

-- 5. IoT Commands (Full State Machine)
create table if not exists public.iot_commands (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null unique default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  iot_device_id uuid references public.iot_devices(id) on delete set null,
  gateway_id uuid references public.iot_gateways(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  action text not null,
  parameters jsonb not null default '{}'::jsonb,
  status public.iot_command_status not null default 'CREATED',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  attempts int not null default 0,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_iot_commands_lookup on public.iot_commands(command_id);
create index if not exists idx_iot_commands_household on public.iot_commands(household_id, created_at desc);
create index if not exists idx_iot_commands_status on public.iot_commands(status);
grant select, insert, update on public.iot_commands to authenticated;
grant all on public.iot_commands to service_role;
alter table public.iot_commands enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'members read iot_commands' and tablename = 'iot_commands') then
    create policy "members read iot_commands" on public.iot_commands for select to authenticated using (public.is_household_member(household_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'members insert iot_commands' and tablename = 'iot_commands') then
    create policy "members insert iot_commands" on public.iot_commands for insert to authenticated with check (
      public.is_household_member(household_id, auth.uid()) and (public.household_role_of(household_id, auth.uid()) <> 'guest')
    );
  end if;
end $$;

create or replace trigger iot_commands_touch before update on public.iot_commands for each row execute function public.touch_updated_at();

-- 6. IoT Command Events (Lifecycle Audit)
create table if not exists public.iot_command_events (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.iot_commands(command_id) on delete cascade,
  from_status public.iot_command_status,
  to_status public.iot_command_status not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_iot_cmd_events on public.iot_command_events(command_id, created_at desc);
grant select on public.iot_command_events to authenticated;
grant all on public.iot_command_events to service_role;
alter table public.iot_command_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'members read iot_command_events' and tablename = 'iot_command_events') then
    create policy "members read iot_command_events" on public.iot_command_events for select to authenticated using (
      exists (select 1 from public.iot_commands c where c.command_id = command_id and public.is_household_member(c.household_id, auth.uid()))
    );
  end if;
end $$;

-- 7. IoT Events (Incoming Sensor/Device Events)
create table if not exists public.iot_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  iot_device_id uuid references public.iot_devices(id) on delete cascade,
  topic text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'gateway',
  created_at timestamptz not null default now()
);
create index if not exists idx_iot_events_household on public.iot_events(household_id, created_at desc);
grant select on public.iot_events to authenticated;
grant all on public.iot_events to service_role;
alter table public.iot_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'members read iot_events' and tablename = 'iot_events') then
    create policy "members read iot_events" on public.iot_events for select to authenticated using (public.is_household_member(household_id, auth.uid()));
  end if;
end $$;

-- 8. IoT Telemetry (Time-series / Metrics)
create table if not exists public.iot_telemetry (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  iot_device_id uuid references public.iot_devices(id) on delete cascade,
  metric text not null,
  value numeric not null,
  unit text,
  recorded_at timestamptz not null default now()
);
create index if not exists idx_iot_telemetry on public.iot_telemetry(household_id, metric, recorded_at desc);
grant select on public.iot_telemetry to authenticated;
grant all on public.iot_telemetry to service_role;
alter table public.iot_telemetry enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'members read iot_telemetry' and tablename = 'iot_telemetry') then
    create policy "members read iot_telemetry" on public.iot_telemetry for select to authenticated using (public.is_household_member(household_id, auth.uid()));
  end if;
end $$;

-- 9. IoT Pairing Sessions (Zigbee/Matter/Wi-Fi Discovery)
create table if not exists public.iot_pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  gateway_id uuid references public.iot_gateways(id) on delete cascade,
  protocol text not null,
  status text not null default 'active',
  permit_duration_sec int not null default 180,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_iot_pairing on public.iot_pairing_sessions(household_id, expires_at desc);
grant select, insert, update on public.iot_pairing_sessions to authenticated;
grant all on public.iot_pairing_sessions to service_role;
alter table public.iot_pairing_sessions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'members read iot_pairing' and tablename = 'iot_pairing_sessions') then
    create policy "members read iot_pairing" on public.iot_pairing_sessions for select to authenticated using (public.is_household_member(household_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'admins manage iot_pairing' and tablename = 'iot_pairing_sessions') then
    create policy "admins manage iot_pairing" on public.iot_pairing_sessions for all to authenticated using (public.is_household_admin(household_id, auth.uid())) with check (public.is_household_admin(household_id, auth.uid()));
  end if;
end $$;

-- 10. IoT Certificates
create table if not exists public.iot_certificates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  gateway_id uuid references public.iot_gateways(id) on delete cascade,
  name text not null,
  fingerprint text not null,
  expires_at timestamptz not null,
  status text not null default 'valid',
  created_at timestamptz not null default now()
);
create index if not exists idx_iot_certificates on public.iot_certificates(household_id);
grant select on public.iot_certificates to authenticated;
grant all on public.iot_certificates to service_role;
alter table public.iot_certificates enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'members read iot_certs' and tablename = 'iot_certificates') then
    create policy "members read iot_certs" on public.iot_certificates for select to authenticated using (public.is_household_member(household_id, auth.uid()));
  end if;
end $$;

-- 11. RPC Helper: Issue verified command
create or replace function public.issue_iot_command(
  _household uuid,
  _device uuid,
  _action text,
  _parameters jsonb default '{}'::jsonb,
  _expires_seconds int default 30
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  cid uuid := gen_random_uuid();
  exp timestamptz := now() + (_expires_seconds || ' seconds')::interval;
  d public.devices;
  role public.household_role;
begin
  select * into d from public.devices where id = _device;
  if d.id is null then raise exception 'device_not_found'; end if;
  if d.household_id <> _household then raise exception 'mismatched_household'; end if;

  role := public.household_role_of(_household, auth.uid());
  if role is null or role = 'guest' then raise exception 'forbidden'; end if;

  if d.is_critical and not coalesce((_parameters->>'confirmed')::boolean, false) then
    raise exception 'confirmation_required';
  end if;

  insert into public.iot_commands(
    command_id, household_id, device_id, requested_by, action, parameters, status, issued_at, expires_at
  ) values (
    cid, _household, _device, auth.uid(), _action, _parameters, 'QUEUED', now(), exp
  );

  insert into public.iot_command_events(command_id, from_status, to_status, details)
  values (cid, 'CREATED', 'QUEUED', jsonb_build_object('action', _action, 'source', 'user_rpc'));

  -- Mark pending on device state
  update public.devices
  set state = state || jsonb_build_object('pending', _parameters, 'pending_command_id', cid)
  where id = _device;

  return jsonb_build_object(
    'command_id', cid,
    'status', 'QUEUED',
    'device_id', _device,
    'expires_at', exp
  );
end $$;

-- 12. Add tables to Supabase Realtime publication
do $$ begin
  begin
    alter publication supabase_realtime add table public.iot_gateways;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.iot_integrations;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.iot_commands;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.iot_devices;
  exception when duplicate_object then null; end;
end $$;
