import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/billing")({ component: () => <ComingSoon title="Billing" description="Consultation, procedure, pharmacy & room charges" /> });
