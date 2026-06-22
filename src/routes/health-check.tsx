import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Activity, Server, User, Shield, Database, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/health-check")({
  component: HealthCheckPage,
});

interface HealthStatus {
  supabaseConnected: boolean;
  authStatus: string;
  dbStatus: string;
  userEmail: string | null;
  userId: string | null;
  userRoles: string[];
  projectUrl: string;
  latencyMs: number | null;
  error: string | null;
}

function HealthCheckPage() {
  const { user, roles, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<HealthStatus>({
    supabaseConnected: false,
    authStatus: "Checking...",
    dbStatus: "Checking...",
    userEmail: null,
    userId: null,
    userRoles: [],
    projectUrl: "",
    latencyMs: null,
    error: null,
  });

  useEffect(() => {
    async function runHealthCheck() {
      const start = performance.now();
      const projectUrl =
        import.meta.env.VITE_SUPABASE_URL ||
        (typeof process !== "undefined" && process.env?.SUPABASE_URL) ||
        "";

      try {
        // Test 1: Auth connection
        const { data: authData, error: authError } = await supabase.auth.getUser();
        const authOk = !authError && !!authData?.user;

        // Test 2: Database connection (lightweight count on patients)
        const { count, error: dbError } = await supabase
          .from("patients")
          .select("*", { count: "exact", head: true });
        const dbOk = !dbError;

        const latency = Math.round(performance.now() - start);

        setStatus({
          supabaseConnected: authOk && dbOk,
          authStatus: authOk ? "Connected" : `Error: ${authError?.message || "Not authenticated"}`,
          dbStatus: dbOk ? "Connected" : `Error: ${dbError?.message || "Unreachable"}`,
          userEmail: authData?.user?.email ?? null,
          userId: authData?.user?.id ?? null,
          userRoles: roles,
          projectUrl,
          latencyMs: latency,
          error: null,
        });
      } catch (err) {
        setStatus((s) => ({
          ...s,
          supabaseConnected: false,
          authStatus: "Failed",
          dbStatus: "Failed",
          error: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    }

    if (!authLoading) {
      runHealthCheck();
    }
  }, [authLoading, roles]);

  const overall = status.supabaseConnected ? "healthy" : "unhealthy";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">System Health Check</h1>
            <p className="text-sm text-muted-foreground">Connection diagnostics for the active Supabase backend.</p>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm">
              Back to Home
            </Button>
          </Link>
        </motion.div>

        {/* Overall Status */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className={overall === "healthy" ? "border-success/40" : "border-destructive/40"}>
            <CardContent className="flex items-center gap-4 py-6">
              {overall === "healthy" ? (
                <CheckCircle2 className="size-10 text-success shrink-0" />
              ) : (
                <XCircle className="size-10 text-destructive shrink-0" />
              )}
              <div>
                <h2 className="text-lg font-semibold">
                  {overall === "healthy" ? "All Systems Operational" : "Connection Issue Detected"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {overall === "healthy"
                    ? "Supabase Connected \u2705"
                    : status.error || "Supabase is not reachable. Check credentials and network."}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Details Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusCard
            icon={Server}
            label="Project URL"
            value={status.projectUrl || "—"}
            status="info"
            delay={0.15}
          />
          <StatusCard
            icon={Wifi}
            label="Latency"
            value={status.latencyMs !== null ? `${status.latencyMs} ms` : "—"}
            status={status.latencyMs !== null && status.latencyMs < 300 ? "success" : "warning"}
            delay={0.2}
          />
          <StatusCard
            icon={Shield}
            label="Auth Service"
            value={status.authStatus}
            status={status.authStatus === "Connected" ? "success" : "warning"}
            delay={0.25}
          />
          <StatusCard
            icon={Database}
            label="Database"
            value={status.dbStatus}
            status={status.dbStatus === "Connected" ? "success" : "destructive"}
            delay={0.3}
          />
          <StatusCard
            icon={User}
            label="Current User"
            value={status.userEmail || "Not signed in"}
            status={status.userEmail ? "success" : "info"}
            delay={0.35}
          />
          <StatusCard
            icon={Activity}
            label="User Roles"
            value={status.userRoles.length > 0 ? status.userRoles.join(", ") : "—"}
            status="info"
            delay={0.4}
          />
        </div>

        {/* Environment variables note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"
        >
          <p className="font-medium text-foreground mb-1">Environment Variables</p>
          <p>
            Connection is initialized from <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code>{" "}
            and <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code>.
          </p>
          <p className="mt-1">
            These are already configured in this project. No manual steps are required.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  status,
  delay,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  status: "success" | "warning" | "destructive" | "info";
  delay: number;
}) {
  const colorMap = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    info: "text-muted-foreground",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Icon className={`size-4 ${colorMap[status]}`} />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium text-foreground break-all">{value}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
