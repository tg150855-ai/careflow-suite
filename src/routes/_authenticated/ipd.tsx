import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/ipd")({ component: () => <ComingSoon title="IPD" description="Admissions, ward & bed management" /> });
