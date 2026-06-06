import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Search } from "lucide-react";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/knowledge")({ component: KbPage });

const CATEGORIES = ["SOP", "Policy", "Clinical Guideline", "Training", "Reference"];

function KbPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ category: CATEGORIES[0], title: "", content: "", tags: "" });

  const load = () => listRows("knowledge_base", { order: "updated_at" }).then(setRows);
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const k = q.toLowerCase();
    return rows.filter((r) => !k || r.title?.toLowerCase().includes(k) || r.content?.toLowerCase().includes(k) || (r.tags ?? []).some((t: string) => t.toLowerCase().includes(k)));
  }, [rows, q]);

  async function save() {
    if (!f.title || !f.content) return toast.error("Title and content required");
    await insertRow("knowledge_base", { ...f, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean) });
    toast.success("Article added"); setOpen(false); setF({ category: CATEGORIES[0], title: "", content: "", tags: "" }); load();
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={BookOpen} title="Hospital Knowledge Base" subtitle="SOPs, policies, clinical guidelines and training materials." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />New Article</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Knowledge Article</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label>
                  <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                    <SelectTrigger /><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Tags (comma-separated)</Label><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></div>
              </div>
              <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
              <div><Label>Content</Label><Textarea rows={10} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SOPs, policies, guidelines…" className="pl-9" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((r) => (
          <Card key={r.id}><CardContent className="pt-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Badge variant="outline">{r.category}</Badge>
              <span className="text-xs text-muted-foreground">v{r.version}</span>
            </div>
            <div className="font-semibold">{r.title}</div>
            <div className="text-sm text-muted-foreground mt-2 line-clamp-4 whitespace-pre-wrap">{r.content}</div>
            {r.tags?.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{r.tags.map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>}
          </CardContent></Card>
        ))}
        {filtered.length === 0 && <Card className="md:col-span-2"><CardContent className="py-12 text-center text-sm text-muted-foreground">No articles found.</CardContent></Card>}
      </div>
    </div>
  );
}
