import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/reports")({ component: () => <ComingSoon title="Reports & Analytics" description="Revenue, OPD, IPD, pharmacy and occupancy reports" /> });
