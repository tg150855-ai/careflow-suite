import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { can, type Module, type Action } from "@/lib/permissions";

/** Conditionally render children based on the active user's role permissions. */
export function Can({
  module,
  action = "view",
  fallback = null,
  children,
}: {
  module: Module;
  action?: Action;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { roles } = useAuth();
  return <>{can(roles, module, action) ? children : fallback}</>;
}
