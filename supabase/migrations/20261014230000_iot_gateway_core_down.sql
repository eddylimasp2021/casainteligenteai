-- =====================================================================
-- CASA INTELIGENTE I.A. — IoT Gateway, MQTT, Adapters & Command Lifecycle
-- Rollback Migration (DOWN): 20261014230000_iot_gateway_core_down.sql
-- =====================================================================

-- Remove from Realtime publication
do $$ begin
  begin alter publication supabase_realtime drop table public.iot_gateways; exception when others then null; end;
  begin alter publication supabase_realtime drop table public.iot_integrations; exception when others then null; end;
  begin alter publication supabase_realtime drop table public.iot_commands; exception when others then null; end;
  begin alter publication supabase_realtime drop table public.iot_devices; exception when others then null; end;
end $$;

-- Drop RPC helper
drop function if exists public.issue_iot_command(_household uuid, _device uuid, _action text, _parameters jsonb, _expires_seconds int);

-- Drop tables in reverse order of foreign keys
drop table if exists public.iot_certificates cascade;
drop table if exists public.iot_pairing_sessions cascade;
drop table if exists public.iot_telemetry cascade;
drop table if exists public.iot_events cascade;
drop table if exists public.iot_command_events cascade;
drop table if exists public.iot_commands cascade;
drop table if exists public.iot_device_capabilities cascade;
drop table if exists public.iot_devices cascade;
drop table if exists public.iot_integrations cascade;
drop table if exists public.iot_gateways cascade;

-- Drop enum types
drop type if exists public.iot_device_availability;
drop type if exists public.iot_command_status;
drop type if exists public.iot_integration_status;
drop type if exists public.iot_integration_type;
drop type if exists public.iot_gateway_status;
