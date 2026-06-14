// React hook wrappers around the permission matrix.
import { useAuth } from "@/lib/auth-context";
import { can, type Action, type Module } from "@/lib/permissions";

export function useCan(module: Module, action: Action = "view"): boolean {
  const { roles } = useAuth();
  return can(roles, module, action);
}

/** Throws (for callers wrapped in error boundaries) if user lacks permission. */
export function useRequire(module: Module, action: Action = "view") {
  const allowed = useCan(module, action);
  if (!allowed) throw new Error(`Permission denied: ${action} on ${module}`);
}
