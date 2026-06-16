import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole =
  | "admin"
  | "super_admin"
  | "doctor"
  | "receptionist"
  | "nurse"
  | "pharmacist"
  | "lab_tech"
  | "accountant"
  | "surgeon"
  | "insurance_officer"
  | "ot_coordinator"
  | "ambulance_driver"
  | "hr_manager"
  | "finance_manager"
  | "dept_head"
  | "procurement_officer"
  | "patient";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: { full_name: string | null; phone: string | null; password_changed?: boolean; login_disabled?: boolean } | null;
  loading: boolean;
  hasRole: (r: AppRole) => boolean;
  hasAnyRole: (rs: AppRole[]) => boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadRolesAndProfile(s.user.id), 0);
      } else {
        setRoles([]);
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadRolesAndProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadRolesAndProfile(userId: string) {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
    ]);
    setRoles((rolesRes.data ?? []).map((r) => r.role as AppRole));
    setProfile(profileRes.data ?? null);
  }

  const value: AuthState = {
    user,
    session,
    roles,
    profile,
    loading,
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
