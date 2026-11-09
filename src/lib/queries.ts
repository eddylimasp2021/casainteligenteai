import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Device = Tables<"devices">;
export type Room = Tables<"rooms">;
export type DeviceState = {
  on?: boolean; brightness?: number; color?: string; temperature?: number; humidity?: number;
  mode?: string; volume?: number; speed?: number; position?: number; locked?: boolean;
  motion?: boolean; power?: number; pending?: Record<string, unknown>;
};
export const stateOf = (d: Device) => (d.state ?? {}) as DeviceState;

export const INITIAL_FALLBACK_DEVICES: Device[] = [
  {
    id: "dev-smart-tv-sala",
    household_id: "casa-principal-master",
    name: "LG webOS Smart TV (Sala)",
    category: "entretenimento",
    device_type: "televisao",
    manufacturer: "LG",
    model: "70LB7200-SA",
    ip_address: "192.168.0.168",
    mac_address: "c4:36:6c:40:84:ac",
    room_id: null,
    status: "online",
    protocol: "wifi",
    capabilities: ["power", "volume", "channel", "media_player", "apps"],
    state: { on: true, volume: 20 },
    is_critical: false,
    simulated: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  } as Device,
  {
    id: "dev-cam-garagem",
    household_id: "casa-principal-master",
    name: "Câmera Garagem Rua",
    category: "seguranca",
    device_type: "camera_ip",
    manufacturer: "Generic",
    model: "IP Cam Full HD",
    ip_address: "192.168.0.139",
    mac_address: "2c:05:47:b1:2a:93",
    room_id: null,
    status: "online",
    protocol: "wifi",
    capabilities: ["video", "webrtc", "ptz", "audio"],
    state: { on: true },
    is_critical: true,
    simulated: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  } as Device,
  {
    id: "dev-cam-externa",
    household_id: "casa-principal-master",
    name: "Câmera Externa",
    category: "seguranca",
    device_type: "camera_ip",
    manufacturer: "Generic",
    model: "IP Cam Externa",
    ip_address: "192.168.0.198",
    mac_address: "88:83:5d:06:0d:90",
    room_id: null,
    status: "online",
    protocol: "wifi",
    capabilities: ["video", "webrtc"],
    state: { on: true },
    is_critical: true,
    simulated: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  } as Device,
  {
    id: "dev-cam-tripla",
    household_id: "casa-principal-master",
    name: "Câmera Tripla 3-Lentes",
    category: "seguranca",
    device_type: "camera_ip",
    manufacturer: "Generic",
    model: "Multi-Lens 3-in-1",
    ip_address: "192.168.0.240",
    mac_address: "4c:b0:08:10:a3:6a",
    room_id: null,
    status: "online",
    protocol: "wifi",
    capabilities: ["video", "webrtc", "multi_lens"],
    state: { on: true },
    is_critical: true,
    simulated: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  } as Device,
];

export function useRooms(householdId?: string) {
  return useQuery({
    queryKey: ["rooms", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("rooms").select("*").eq("household_id", householdId!).order("sort_order");
        if (error) return [];
        return data || [];
      } catch {
        return [];
      }
    },
  });
}

export function useDevices(householdId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!householdId) return;
    try {
      const ch = supabase
        .channel(`devices-${householdId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `household_id=eq.${householdId}` }, () => {
          qc.invalidateQueries({ queryKey: ["devices", householdId] });
        })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    } catch {}
  }, [householdId, qc]);

  return useQuery({
    queryKey: ["devices", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("devices").select("*").eq("household_id", householdId!).order("name");
        if (error || !data || data.length === 0) {
          // Recupera dispositivos locais se a tabela em nuvem exigir RLS
          const savedLocal = typeof window !== "undefined" ? localStorage.getItem("homepulse_saved_devices_v1") : null;
          if (savedLocal) {
            try { return JSON.parse(savedLocal); } catch {}
          }
          return INITIAL_FALLBACK_DEVICES;
        }
        return data;
      } catch {
        return INITIAL_FALLBACK_DEVICES;
      }
    },
  });
}

export async function logAction(householdId: string, action: string, deviceId: string | null = null, details: Record<string, unknown> = {}) {
  await supabase.rpc("log_action", { _household: householdId, _action: action, _device: deviceId ?? undefined, _details: details as never });
}
