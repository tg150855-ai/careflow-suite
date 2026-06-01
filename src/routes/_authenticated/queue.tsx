import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hash, Plus, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/queue")({ component: QueuePage });

function QueuePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [counter, setCounter] = useState("OPD-1");
  const [estimated, setEstimated] = useState("10");

  async function load() {
    const { data } = await supabase
      .from("queue_tokens").select("*, patients(full_name)")
      .gte("issued_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order("token_no", { ascending: true });
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("queue").on("postgres_changes", { event: "*", schema: "public", table: "queue_tokens" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function issue() {
    if (!counter) return toast.error("Counter required");
    const { error } = await supabase.from("queue_tokens").insert({
      counter, status: "waiting", estimated_minutes: parseInt(estimated) || 10,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Token issued");
    load();
  }

  async function next(id: string) {
    await supabase.from("queue_tokens").update({ status: "called", called_at: new Date().toISOString() } as any).eq("id", id);
  }
  async function serve(id: string) {
    await supabase.from("queue_tokens").update({ status: "served", served_at: new Date().toISOString() } as any).eq("id", id);
  }

  const counters = Array.from(new Set(rows.map((r) => r.counter)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Hash className="size-6 text-primary" /> Smart Queue Management</h1>
        <p className="text-sm text-muted-foreground">Live tokens across reception, OPD, pharmacy. Real-time updates.</p>
      </div>

      <Card><CardContent className="pt-6 flex flex-wrap items-end gap-3">
        <div><Label>Counter</Label>
          <Select value={counter} onValueChange={setCounter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Reception">Reception</SelectItem>
              <SelectItem value="OPD-1">OPD-1</SelectItem>
              <SelectItem value="OPD-2">OPD-2</SelectItem>
              <SelectItem value="Pharmacy">Pharmacy</SelectItem>
              <SelectItem value="Lab">Lab</SelectItem>
              <SelectItem value="Billing">Billing</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Est. wait (min)</Label><Input type="number" className="w-28" value={estimated} onChange={(e) => setEstimated(e.target.value)} /></div>
        <Button onClick={issue}><Plus className="size-4 mr-1" /> Issue Token</Button>
      </CardContent></Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {counters.length === 0 && <div className="col-span-full text-center text-muted-foreground py-10">No tokens today. Issue one to begin.</div>}
        {counters.map((c) => {
          const list = rows.filter((r) => r.counter === c);
          const current = list.find((r) => r.status === "called");
          const waiting = list.filter((r) => r.status === "waiting");
          return (
            <Card key={c}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">{c}</div>
                  <Badge variant="outline">{waiting.length} waiting</Badge>
                </div>
                <div className="rounded-lg bg-primary/10 p-4 text-center mb-3">
                  <div className="text-xs text-muted-foreground">Now Serving</div>
                  <div className="text-4xl font-bold text-primary">{current ? `#${current.token_no}` : "—"}</div>
                  {current && <div className="text-xs mt-1">Called {format(new Date(current.called_at), "HH:mm")}</div>}
                </div>
                {current && <Button size="sm" className="w-full mb-2" variant="outline" onClick={() => serve(current.id)}>Mark Served</Button>}
                {waiting[0] && (
                  <Button size="sm" className="w-full" onClick={() => next(waiting[0].id)}>
                    Call Next #{waiting[0].token_no} <ChevronRight className="size-4 ml-1" />
                  </Button>
                )}
                {waiting.length > 1 && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Up next: {waiting.slice(1, 5).map((w) => `#${w.token_no}`).join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
