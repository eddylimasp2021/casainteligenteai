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

export function useRooms(householdId?: string) {
  return useQuery({
    queryKey: ["rooms", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase.from("rooms").select("*").eq("household_id", householdId!).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useDevices(householdId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!householdId) return;
    const ch = supabase
      .channel(`devices-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `household_id=eq.${householdId}` }, () => {
        qc.invalidateQueries({ queryKey: ["devices", householdId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [householdId, qc]);

  return useQuery({
    queryKey: ["devices", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("*").eq("household_id", householdId!).order("name");
      if (error) throw error;
      return data;
    },
  });
}

export async function logAction(householdId: string, action: string, deviceId: string | null = null, details: Record<string, unknown> = {}) {
  await supabase.rpc("log_action", { _household: householdId, _action: action, _device: deviceId ?? undefined, _details: details as never });
}
