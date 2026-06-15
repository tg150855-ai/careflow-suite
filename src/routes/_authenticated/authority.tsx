import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import {
  MODULES, MODULE_LABELS, ROLE_LABELS, PERMISSIONS, WORKFLOWS,
} from "@/lib/permissions";
import type { AppRole } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/authority")({
  component: AuthorityPage,
});

const ROLES = Object.keys(ROLE_LABELS) as AppRole[];

function AuthorityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Authority & Workflow"
        subtitle="Role hierarchy, permission matrix and clinical workflows across SBG Arogya Plus."
        icon={ShieldCheck}
      />

      <Tabs defaultValue="workflows">
        <TabsList>
          <TabsTrigger value="workflows">Hospital Workflows</TabsTrigger>
          <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
          <TabsTrigger value="roles">Role Cards</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-6 mt-4">
          {WORKFLOWS.map((wf) => (
            <Card key={wf.title}>
              <CardHeader><CardTitle>{wf.title}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-stretch gap-2">
                  {wf.steps.map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-2"
                    >
                      <div className="rounded-xl border bg-card px-3 py-2 min-w-[180px]">
                        <div className="text-xs text-muted-foreground">Step {i + 1}</div>
                        <div className="font-medium text-sm">{s.label}</div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {s.owner.map((r) => (
                            <Badge key={r} variant="secondary" className="text-[10px] capitalize">
                              {ROLE_LABELS[r]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {i < wf.steps.length - 1 && (
                        <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                      )}
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Role × Module Permission Matrix</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    <th className="text-left p-2 border-b font-semibold sticky left-0 bg-card min-w-[160px]">
                      Module
                    </th>
                    {ROLES.map((r) => (
                      <th key={r} className="p-2 border-b font-medium text-center whitespace-nowrap">
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((m) => (
                    <tr key={m} className="hover:bg-muted/30">
                      <td className="p-2 border-b sticky left-0 bg-background font-medium">
                        {MODULE_LABELS[m]}
                      </td>
                      {ROLES.map((r) => {
                        const acts = PERMISSIONS[r]?.[m];
                        return (
                          <td key={r} className="p-2 border-b text-center">
                            {acts?.length ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <Check className="size-3.5 text-success" />
                                <span className="text-[9px] text-muted-foreground uppercase">
                                  {acts.includes("approve") ? "APPR" :
                                    acts.includes("delete") ? "FULL" :
                                    acts.includes("edit") ? "R/W" : "RO"}
                                </span>
                              </div>
                            ) : (
                              <X className="size-3.5 text-muted-foreground/40 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROLES.map((r) => {
              const mods = Object.keys(PERMISSIONS[r] ?? {});
              return (
                <Card key={r}>
                  <CardHeader>
                    <CardTitle className="text-base">{ROLE_LABELS[r]}</CardTitle>
                    <div className="text-xs text-muted-foreground capitalize">{r.replace("_", " ")}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground mb-2">
                      {mods.length} module{mods.length === 1 ? "" : "s"} accessible
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {mods.slice(0, 14).map((m) => (
                        <Badge key={m} variant="outline" className="text-[10px]">
                          {MODULE_LABELS[m as keyof typeof MODULE_LABELS]}
                        </Badge>
                      ))}
                      {mods.length > 14 && (
                        <Badge variant="secondary" className="text-[10px]">+{mods.length - 14} more</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
