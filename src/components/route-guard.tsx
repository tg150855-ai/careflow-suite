import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { can, MODULE_LABELS, type Module, type Action } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Route-level RBAC gate. Wrap any authenticated page body to enforce
 * module + action permission. Renders an "Access Denied" panel if the
 * current user's roles do not satisfy the requirement.
 */
export function RouteGuard({
  module,
  action = "view",
  children,
}: {
  module: Module;
  action?: Action;
  children: ReactNode;
}) {
  const { roles, loading } = useAuth();
  if (loading) return null;
  if (can(roles, module, action)) return <>{children}</>;
  return <Denied module={module} action={action} />;
}

function Denied({ module, action }: { module: Module; action: Action }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 space-y-4 text-center">
          <div className="mx-auto size-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldOff className="size-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your role does not allow <b>{action}</b> on{" "}
              <b>{MODULE_LABELS[module] ?? module}</b>.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Contact your administrator if you need access.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
