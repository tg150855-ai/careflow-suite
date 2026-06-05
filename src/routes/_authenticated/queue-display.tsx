import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Hash, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/queue-display")({ component: QueueDisplay });

const STATIONS = [
  { code: "opd", label: "OPD" },
  { code: "lab", label: "Laboratory" },
  { code: "pharmacy", label: "Pharmacy" },
];

function QueueDisplay() {
  const [tokens, setTokens] = useState<any[]>([]);

  async function load() {
    const sb = supabase as any;
    const { data } = await sb.from("queue_tokens").select("*").order("created_at", { ascending: false }).limit(100);
    setTokens(data ?? []);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    const ch = (supabase as any).channel("queue-display")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tokens" }, () => load())
      .subscribe();
    return () => { clearInterval(t); (supabase as any).removeChannel(ch); };
  }, []);

  return (
    <div>
      <PageHeader icon={Hash} title="Queue Display" subtitle="Live token board · auto-refreshes every 5s · for hospital lobby TVs" />
      <div className="grid lg:grid-cols-3 gap-4">
        {STATIONS.map((s) => {
          const stationTokens = tokens.filter((t) => t.station === s.code || t.queue_type === s.code);
          const serving = stationTokens.find((t) => t.status === "serving");
          const waiting = stationTokens.filter((t) => t.status === "waiting");
          return (
            <Card key={s.code} className="overflow-hidden">
              <div className="bg-primary text-primary-foreground px-5 py-4">
                <div className="text-xs uppercase tracking-widest opacity-80">{s.label}</div>
                <div className="flex items-baseline justify-between mt-2">
                  <div>
                    <div className="text-xs opacity-80">Now Serving</div>
                    <div className="text-5xl font-bold tabular-nums">{serving?.token_number ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs opacity-80 flex items-center justify-end gap-1"><Users className="size-3" /> Waiting</div>
                    <div className="text-3xl font-semibold">{waiting.length}</div>
                  </div>
                </div>
              </div>
              <CardContent className="pt-4 space-y-2">
                <div className="text-xs uppercase font-semibold text-muted-foreground tracking-widest">Next in line</div>
                {waiting.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <span className="font-mono font-semibold">{t.token_number}</span>
                    <Badge variant="outline" className="text-xs">waiting</Badge>
                  </div>
                ))}
                {waiting.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Queue empty</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
