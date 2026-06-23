import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/opd-coming-soon";

export const Route = createFileRoute("/_authenticated/opd/registration")({
  component: () => <ComingSoon title="Patient Registration" phase={2} />,
});
