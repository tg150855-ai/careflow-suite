import { useAuth } from "@/lib/auth-context";

/** True only when the active user has the `super_admin` role. Used to gate Delete actions. */
export function useIsSuperAdmin(): boolean {
  const { roles } = useAuth();
  return roles.includes("super_admin");
}
