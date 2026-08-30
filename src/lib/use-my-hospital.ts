import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { ModuleKey } from "@/lib/modules";

export type HospitalStatus = "pending" | "approved" | "suspended" | "rejected";

export type HospitalRow = {
  id: string;
  hospital_name: string;
  owner_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  status: string | null;
  status_reason: string | null;
  subscription_plan: string | null;
  max_users: number | null;
  max_devices: number | null;
  expiry_date: string | null;
  notes: string | null;
  enabled_modules: unknown;
  allowed_roles?: unknown;

  created_at: string | null;
};

/**
 * The hospital tenant the signed-in user belongs to.
 * Realtime enabled: any status change (suspension, approval, rejection) is pushed instantly.
 */
export function useMyHospital() {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-hospital", user?.id],
    enabled: !!user?.id,
    staleTime: 5_000,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("hospital_id")
        .eq("id", user!.id)
        .maybeSingle();
      const hospitalId = (profile as { hospital_id?: string | null } | null)?.hospital_id ?? null;
      if (!hospitalId) return null;
      const { data: hospital } = await supabase
        .from("hospitals")
        .select("*")
        .eq("id", hospitalId)
        .maybeSingle();
      return (hospital as HospitalRow | null) ?? null;
    },
  });

  const hospital = data ?? null;
  const status = (hospital?.status ?? "approved") as HospitalStatus;

  // Instant Realtime push: updates the moment Super Admin suspends or approves the hospital
  useEffect(() => {
    if (!hospital?.id) return;
    const channelName = `hosp-status-${hospital.id}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hospitals", filter: `id=eq.${hospital.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["my-hospital"] });
          qc.invalidateQueries({ queryKey: ["enabled-modules"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hospital?.id, qc]);

  return {
    loading: authLoading || isLoading,
    hospital,
    /** null => legacy / unrestricted account (no tenant assigned) */
    isTenant: !!hospital,
    status,
    approved: !hospital || status === "approved",
    allowedModules: hospital ? toModuleSet(hospital.enabled_modules) : null,
  };
}

export function toModuleSet(value: unknown): Set<ModuleKey> {
  const arr = Array.isArray(value) ? value : [];
  return new Set(arr.filter((v): v is ModuleKey => typeof v === "string") as ModuleKey[]);
}
