import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/opd-coming-soon";

export const Route = createFileRoute("/_authenticated/opd/billing")({
  component: () => <ComingSoon title="OPD Billing" phase={5} />,
});
