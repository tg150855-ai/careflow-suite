import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/ot")({ component: () => <ComingSoon title="OT / Surgery" description="OT scheduling, surgery notes, OT billing" /> });
