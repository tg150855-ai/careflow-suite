import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <Card className="p-12 text-center">
      <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
        <Sparkles className="size-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <Badge variant="secondary" className="mt-2">Ships in Phase {phase}</Badge>
      <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
        This sub-module is reserved and will be built as part of the staged OPD rollout.
      </p>
    </Card>
  );
}
