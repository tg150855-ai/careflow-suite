import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/opd-coming-soon";

export const Route = createFileRoute("/_authenticated/opd/appointments")({
  component: () => <ComingSoon title="OPD Appointments" phase={3} />,
});
