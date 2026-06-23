import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/opd-coming-soon";

export const Route = createFileRoute("/_authenticated/opd/settings")({
  component: () => <ComingSoon title="OPD Settings" phase={6} />,
});
