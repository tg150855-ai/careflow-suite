import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { NSDashboard } from "@/components/nurse-station/dashboard";
import { NSBoard } from "@/components/nurse-station/board";
import { NSNotes } from "@/components/nurse-station/notes";
import { NSMar } from "@/components/nurse-station/mar";
import { NSVitals } from "@/components/nurse-station/vitals";
import { NSOrders } from "@/components/nurse-station/orders";
import { NSHandover } from "@/components/nurse-station/handover";
import { NSReports } from "@/components/nurse-station/reports";
import { NSSettings } from "@/components/nurse-station/settings";
import { HeartPulse } from "lucide-react";

export const Route = createFileRoute("/_authenticated/nurse-station")({ component: NurseStation });

const TABS = [
  { v: "dashboard", l: "Dashboard" },
  { v: "board", l: "Care Board" },
  { v: "notes", l: "Nursing Notes" },
  { v: "mar", l: "Medication (MAR)" },
  { v: "vitals", l: "Vitals" },
  { v: "orders", l: "Doctor Orders" },
  { v: "handover", l: "Shift Handover" },
  { v: "reports", l: "Reports" },
  { v: "settings", l: "Settings" },
];

function NurseStation() {
  const { roles } = useAuth();
  const [tab, setTab] = useState("dashboard");
  if (!can(roles as any, "nurse_station", "view")) {
    return <div className="p-8 text-sm text-muted-foreground">You don't have access to the Nurse Station.</div>;
  }
  return (
    <div className="space-y-4">
      <PageHeader
        title="Nurse Station"
        subtitle="Care board, medications, vitals, doctor orders, shift handovers."
        icon={HeartPulse}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map((t) => <TabsTrigger key={t.v} value={t.v}>{t.l}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="dashboard"><NSDashboard onTab={setTab} /></TabsContent>
        <TabsContent value="board"><NSBoard /></TabsContent>
        <TabsContent value="notes"><NSNotes /></TabsContent>
        <TabsContent value="mar"><NSMar /></TabsContent>
        <TabsContent value="vitals"><NSVitals /></TabsContent>
        <TabsContent value="orders"><NSOrders /></TabsContent>
        <TabsContent value="handover"><NSHandover /></TabsContent>
        <TabsContent value="reports"><NSReports /></TabsContent>
        <TabsContent value="settings"><NSSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
