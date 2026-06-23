import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/opd-coming-soon";

export const Route = createFileRoute("/_authenticated/opd/reports")({
  component: () => <ComingSoon title="OPD Reports" phase={6} />,
});
