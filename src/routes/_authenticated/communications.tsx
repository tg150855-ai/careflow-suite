import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/communications")({ component: CommsPage });

function CommsPage() {
  const [wa, setWa] = useState<any[]>([]);
  const [sms, setSms] = useState<any[]>([]);
  const [em, setEm] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("whatsapp_logs").select("*").order("created_at", { ascending: false }).limit(50).then(({ data }) => setWa(data ?? []));
    supabase.from("sms_logs").select("*").order("created_at", { ascending: false }).limit(50).then(({ data }) => setSms(data ?? []));
    supabase.from("email_logs").select("*").order("created_at", { ascending: false }).limit(50).then(({ data }) => setEm(data ?? []));
  }, []);

  const Tbl = ({ rows, kind }: { rows: any[]; kind: "wa" | "sms" | "em" }) => (
    <Table>
      <TableHeader><TableRow><TableHead>Recipient</TableHead><TableHead>Type</TableHead>{kind === "em" && <TableHead>Subject</TableHead>}<TableHead>Status</TableHead><TableHead>Sent</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={kind === "em" ? 5 : 4} className="text-center text-muted-foreground py-8">No messages logged</TableCell></TableRow>}
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{r.recipient}</TableCell>
            <TableCell className="capitalize">{r.message_type.replace("_", " ")}</TableCell>
            {kind === "em" && <TableCell>{r.subject}</TableCell>}
            <TableCell><Badge variant="outline" className="capitalize">{r.status}</Badge></TableCell>
            <TableCell className="text-xs">{format(new Date(r.created_at), "dd MMM HH:mm")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><MessageSquare className="size-6 text-primary" /> Communication Center</h1>
        <p className="text-sm text-muted-foreground">WhatsApp, SMS and email delivery logs.</p>
      </div>
      <Tabs defaultValue="wa">
        <TabsList>
          <TabsTrigger value="wa">WhatsApp</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="em">Email</TabsTrigger>
        </TabsList>
        <TabsContent value="wa"><Card><CardContent className="pt-6"><Tbl rows={wa} kind="wa" /></CardContent></Card></TabsContent>
        <TabsContent value="sms"><Card><CardContent className="pt-6"><Tbl rows={sms} kind="sms" /></CardContent></Card></TabsContent>
        <TabsContent value="em"><Card><CardContent className="pt-6"><Tbl rows={em} kind="em" /></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
