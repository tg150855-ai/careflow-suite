import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Loader2, PowerOff } from "lucide-react";
import { useEnabledModules } from "@/lib/use-enabled-modules";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { loading: modulesLoading, isPathEnabled } = useEnabledModules();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const blocked = !modulesLoading && !isPathEnabled(path);

  return (
    <AppShell>
      {blocked ? <ModuleDisabled /> : <Outlet />}
    </AppShell>
  );
}

function ModuleDisabled() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 space-y-4 text-center">
          <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
            <PowerOff className="size-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Module disabled</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This module has been turned off for your hospital in Settings → Departments.
            </p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/dashboard">Back to dashboard</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

