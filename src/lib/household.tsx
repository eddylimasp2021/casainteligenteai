import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import type { Tables, Enums } from "@/integrations/supabase/types";

export type Household = Tables<"households"> & { role: Enums<"household_role"> };
const KEY = "hp-household";

type Ctx = {
  households: Household[];
  current: Household | null;
  setCurrentId: (id: string) => void;
  loading: boolean;
  canAdmin: boolean;
  canControl: boolean;
  refetch: () => void;
};
const HouseholdCtx = createContext<Ctx | null>(null);

export function useHouseholdsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["households", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("role, households(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.households && !r.households.deleted_at)
        .map((r) => ({ ...(r.households as Tables<"households">), role: r.role })) as Household[];
    },
  });
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const q = useHouseholdsQuery();
  const [currentId, setCurrentIdState] = useState<string | null>(null);

  useEffect(() => {
    setCurrentIdState(localStorage.getItem(KEY));
  }, []);

  const households = q.data ?? [];
  const current = useMemo(
    () => households.find((h) => h.id === currentId) ?? households[0] ?? null,
    [households, currentId],
  );

  const value: Ctx = {
    households,
    current,
    loading: q.isLoading,
    canAdmin: current?.role === "owner" || current?.role === "admin",
    canControl: !!current && current.role !== "guest",
    setCurrentId: (id) => {
      localStorage.setItem(KEY, id);
      setCurrentIdState(id);
    },
    refetch: () => void q.refetch(),
  };
  return <HouseholdCtx.Provider value={value}>{children}</HouseholdCtx.Provider>;
}

export function useHousehold() {
  const c = useContext(HouseholdCtx);
  if (!c) throw new Error("useHousehold outside provider");
  return c;
}
