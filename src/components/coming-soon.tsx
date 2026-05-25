import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">{description ?? "This module is coming in a future phase."}</p>
      </div>
      <Card className="p-16 text-center border-dashed">
        <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <Sparkles className="size-6" />
        </div>
        <h2 className="font-semibold text-lg">Coming soon</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          We're shipping HMIS in phases. Phase 1 covers Patients, Appointments and OPD.
          IPD, Pharmacy, Lab, OT, Billing, Insurance, Reports and Staff land next.
        </p>
      </Card>
    </div>
  );
}
