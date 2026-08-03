import { Suspense, lazy } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { InlineRxAction, InlineRxContext, InlineRxPayload } from "@/components/opd/prescription-inline";

// lazy — the heavy signature-canvas + A4 preview only loads when opened
const PrescriptionInline = lazy(() =>
  import("@/components/opd/prescription-inline").then((m) => ({ default: m.PrescriptionInline })),
);

/**
 * Digital prescription in a modal (desktop/laptop/tablet) that becomes a
 * full-screen sheet on mobile. Nothing loads until `open` is true.
 */
export function PrescriptionSheet({
  open,
  onOpenChange,
  ctx,
  saving,
  onAction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: InlineRxContext;
  saving?: boolean;
  onAction: (action: InlineRxAction, payload: InlineRxPayload) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 max-w-none w-screen h-[100dvh] rounded-none sm:w-[calc(100vw-3rem)] sm:h-[92vh] sm:max-w-[1200px] sm:rounded-lg flex flex-col"
      >
        <DialogHeader className="px-4 sm:px-6 py-3 border-b shrink-0">
          <DialogTitle className="text-base">Digital prescription</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
          {open && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                  <Loader2 className="size-4 mr-2 animate-spin" />Loading prescription…
                </div>
              }
            >
              <PrescriptionInline bare ctx={ctx} saving={saving} onAction={onAction} />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
