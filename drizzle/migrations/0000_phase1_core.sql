
create type public.household_role as enum ('owner','admin','member','guest');
create type public.device_status as enum ('online','offline','unavailable','pairing');

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  home_type text not null default 'casa',
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  is_demo boolean not null default false,
  created_by uuid not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.households to authenticated;
grant all on public.households to service_role;
alter table public.households enable row level security;
create trigger households_touch before update on public.households for each row execute function public.touch_updated_at();

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null,
  role public.household_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);
create index on public.household_members(user_id);
grant select, insert, update, delete on public.household_members to authenticated;
grant all on public.household_members to service_role;
alter table public.household_members enable row level security;

create or replace function public.household_role_of(_household uuid, _user uuid) returns public.household_role
language sql stable security definer set search_path=public as $$
  select role from public.household_members where household_id=_household and user_id=_user
$$;
create or replace function public.is_household_member(_household uuid, _user uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.household_members where household_id=_household and user_id=_user)
$$;
create or replace function public.is_household_admin(_household uuid, _user uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.household_members where household_id=_household and user_id=_user and role in ('owner','admin'))
$$;

create policy "members read households" on public.households for select to authenticated using (public.is_household_member(id, auth.uid()));
create policy "admins update households" on public.households for update to authenticated using (public.is_household_admin(id, auth.uid()));
create policy "owner deletes households" on public.households for delete to authenticated using (public.household_role_of(id, auth.uid())='owner');

create policy "members read members" on public.household_members for select to authenticated using (public.is_household_member(household_id, auth.uid()));
create policy "admins manage members" on public.household_members for all to authenticated using (public.is_household_admin(household_id, auth.uid())) with check (public.is_household_admin(household_id, auth.uid()) and role <> 'owner');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  icon text not null default 'home',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.rooms(household_id);
grant select, insert, update, delete on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create trigger rooms_touch before update on public.rooms for each row execute function public.touch_updated_at();
create policy "members read rooms" on public.rooms for select to authenticated using (public.is_household_member(household_id, auth.uid()));
create policy "admins write rooms" on public.rooms for all to authenticated using (public.is_household_admin(household_id, auth.uid())) with check (public.is_household_admin(household_id, auth.uid()));

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  name text not null,
  category text not null,
  device_type text not null,
  manufacturer text,
  model text,
  protocol text not null default 'wifi',
  external_id text,
  firmware text,
  ip_address text,
  status public.device_status not null default 'offline',
  simulated boolean not null default false,
  is_critical boolean not null default false,
  capabilities text[] not null default '{}',
  state jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.devices(household_id);
create index on public.devices(room_id);
grant select, insert, update, delete on public.devices to authenticated;
grant all on public.devices to service_role;
alter table public.devices enable row level security;
create trigger devices_touch before update on public.devices for each row execute function public.touch_updated_at();
create policy "members read devices" on public.devices for select to authenticated using (public.is_household_member(household_id, auth.uid()));
create policy "admins write devices" on public.devices for all to authenticated using (public.is_household_admin(household_id, auth.uid())) with check (public.is_household_admin(household_id, auth.uid()));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid,
  device_id uuid references public.devices(id) on delete set null,
  action text not null,
  result text not null default 'success',
  source text not null default 'app',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs(household_id, created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "members read logs" on public.audit_logs for select to authenticated using (public.is_household_member(household_id, auth.uid()));

-- Logging helper for admin CRUD
create or replace function public.log_action(_household uuid, _action text, _device uuid default null, _details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_household_member(_household, auth.uid()) then raise exception 'forbidden'; end if;
  insert into public.audit_logs(household_id,user_id,device_id,action,details) values (_household, auth.uid(), _device, _action, _details);
end $$;

-- Create household + owner + rooms atomically
create or replace function public.create_household(_name text, _address text, _home_type text, _timezone text, _currency text, _rooms text[])
returns uuid language plpgsql security definer set search_path=public as $$
declare hid uuid; r text; i int := 0;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  insert into public.households(name,address,home_type,timezone,currency,created_by)
    values (_name, nullif(_address,''), _home_type, _timezone, _currency, auth.uid()) returning id into hid;
  insert into public.household_members(household_id,user_id,role) values (hid, auth.uid(), 'owner');
  foreach r in array coalesce(_rooms,'{}') loop
    i := i + 1;
    insert into public.rooms(household_id,name,icon,sort_order) values (hid, r, lower(r), i);
  end loop;
  insert into public.audit_logs(household_id,user_id,action) values (hid, auth.uid(), 'household.created');
  return hid;
end $$;

-- Control a device: members (not guests) may change state; critical devices need confirmation flag
create or replace function public.set_device_state(_device uuid, _patch jsonb, _confirmed boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.devices; role public.household_role; newstate jsonb; res text;
begin
  select * into d from public.devices where id=_device;
  if d.id is null then raise exception 'not_found'; end if;
  role := public.household_role_of(d.household_id, auth.uid());
  if role is null or role='guest' then raise exception 'forbidden'; end if;
  if d.is_critical and not _confirmed then raise exception 'confirmation_required'; end if;
  if d.status <> 'online' then
    insert into public.audit_logs(household_id,user_id,device_id,action,result,details) values (d.household_id, auth.uid(), d.id, 'device.control', 'device_offline', _patch);
    raise exception 'device_offline';
  end if;
  newstate := d.state || _patch;
  if d.simulated then
    update public.devices set state=newstate, last_seen_at=now() where id=d.id;
    res := 'simulated';
  else
    update public.devices set state = state || jsonb_build_object('pending', _patch) where id=d.id;
    res := 'pending_gateway';
  end if;
  insert into public.audit_logs(household_id,user_id,device_id,action,result,details) values (d.household_id, auth.uid(), d.id, 'device.control', res, _patch);
  return jsonb_build_object('result', res);
end $$;

-- Demo household (clearly flagged is_demo, devices simulated)
create or replace function public.create_demo_household() returns uuid language plpgsql security definer set search_path=public as $$
declare hid uuid; sala uuid; coz uuid; qto uuid; gar uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  insert into public.households(name,home_type,is_demo,created_by) values ('Casa Eduardo (demonstração)','casa',true,auth.uid()) returning id into hid;
  insert into public.household_members(household_id,user_id,role) values (hid, auth.uid(), 'owner');
  insert into public.rooms(household_id,name,icon,sort_order) values (hid,'Sala','sala',1) returning id into sala;
  insert into public.rooms(household_id,name,icon,sort_order) values (hid,'Cozinha','cozinha',2) returning id into coz;
  insert into public.rooms(household_id,name,icon,sort_order) values (hid,'Quarto','quarto',3) returning id into qto;
  insert into public.rooms(household_id,name,icon,sort_order) values (hid,'Garagem','garagem',4) returning id into gar;
  insert into public.devices(household_id,room_id,name,category,device_type,protocol,status,simulated,is_critical,capabilities,state,last_seen_at) values
   (hid,sala,'Luz da sala','iluminacao','lampada','wifi','online',true,false,'{onoff,brightness,color}','{"on":true,"brightness":70,"color":"#7dd3fc"}',now()),
   (hid,qto,'Ar-condicionado','climatizacao','ar_condicionado','wifi','online',true,false,'{onoff,temperature,mode}','{"on":false,"temperature":23,"mode":"cool"}',now()),
   (hid,sala,'TV','entretenimento','televisao','wifi','online',true,false,'{onoff,volume}','{"on":false,"volume":20}',now()),
   (hid,gar,'Sensor garagem','seguranca','sensor_movimento','zigbee','online',true,false,'{}','{"motion":false}',now()),
   (hid,gar,'Luz garagem','iluminacao','lampada','zigbee','online',true,false,'{onoff,brightness}','{"on":false,"brightness":100}',now()),
   (hid,sala,'Fechadura','seguranca','fechadura','matter','online',true,true,'{lock}','{"locked":true}',now()),
   (hid,gar,'Câmera','seguranca','camera','http','offline',true,false,'{}','{}',now() - interval '2 hours'),
   (hid,sala,'Sensor de clima da sala','ambiente','temperatura','zigbee','online',true,false,'{}','{"temperature":24.5,"humidity":58}',now()),
   (hid,coz,'Tomada da cafeteira','energia','tomada','wifi','online',true,false,'{onoff}','{"on":true,"power":850}',now());
  insert into public.audit_logs(household_id,user_id,action) values (hid, auth.uid(), 'demo.created');
  return hid;
end $$;

alter publication supabase_realtime add table public.devices;
alter publication supabase_realtime add table public.audit_logs;
