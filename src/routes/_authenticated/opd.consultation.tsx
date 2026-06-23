import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope } from "lucide-react";

export const Route = createFileRoute("/_authenticated/opd/consultation")({
  component: () => (
    <Card className="p-12 text-center">
      <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
        <Stethoscope className="size-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">Consultation</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        Open a patient from the live OPD queue to start consultation. The enhanced consultation
        workspace (voice input, structured medications, attachments) ships in Phase 4.
      </p>
      <Button asChild className="mt-4" variant="outline"><Link to="/opd">Go to queue</Link></Button>
    </Card>
  ),
});
