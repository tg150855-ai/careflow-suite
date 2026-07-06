import { useAuth } from "@/lib/auth-context";

/**
 * True when the active user has the `admin` or `super_admin` role.
 * Used to gate Delete actions across every list/table in the app.
 * (Name kept for backwards compatibility with existing imports.)
 */
export function useIsSuperAdmin(): boolean {
  const { roles } = useAuth();
  return roles.includes("super_admin") || roles.includes("admin");
}
