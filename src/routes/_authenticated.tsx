import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Loader2, PowerOff, Clock, Ban } from "lucide-react";
import { useEnabledModules } from "@/lib/use-enabled-modules";
import { useMyHospital } from "@/lib/use-my-hospital";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, loading, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { loading: modulesLoading, isPathEnabled } = useEnabledModules();
  const { loading: hospitalLoading, hospital, status } = useMyHospital();
  const isSuper = roles.includes("super_admin");

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!loading && session && isSuper) {
      navigate({ to: "/super-admin" });
    }
  }, [loading, session, isSuper, navigate]);

  if (loading || !session || hospitalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Tenant approval gate — legacy accounts (no hospital link) are unaffected.
  if (hospital && status !== "approved") {
    return <TenantGate status={status} name={hospital.hospital_name} reason={hospital.status_reason} onSignOut={async () => { await signOut(); navigate({ to: "/login" }); }} />;
  }

  const blocked = !modulesLoading && !isPathEnabled(path);

  return (
    <AppShell>
      {blocked ? <ModuleDisabled /> : <Outlet />}
    </AppShell>
  );
}

function TenantGate({ status, name, reason, onSignOut }: { status: string; name: string; reason?: string | null; onSignOut: () => void }) {
  const pending = status === "pending";
  const rejected = status === "rejected";
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-8 pb-6 space-y-4 text-center">
          <div className="mx-auto size-14 rounded-full bg-muted flex items-center justify-center">
            {pending ? <Clock className="size-7 text-muted-foreground" /> : <Ban className="size-7 text-destructive" />}
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {pending ? "Pending approval" : rejected ? "Registration rejected" : "Account suspended"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {pending
                ? `${name} has been registered and is waiting for platform super admin approval. You will get full access to your dashboard as soon as it is approved.`
                : rejected
                ? `The registration for ${name} was not approved. Please contact the platform administrator.`
                : `Access for ${name} has been suspended by the platform administrator.`}
            </p>
            {reason && <p className="text-xs text-muted-foreground mt-2">Note: {reason}</p>}
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Check again</Button>
            <Button variant="ghost" size="sm" onClick={onSignOut}>Sign out</Button>
          </div>
        </CardContent>
      </Card>
    </div>
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
            <h2 className="text-lg font-semibold">Module not available</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This module is either turned off in Settings → Departments, or not included in your hospital's plan.
            </p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/dashboard">Back to dashboard</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
