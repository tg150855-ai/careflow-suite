import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/settings")({ component: () => <ComingSoon title="Settings" description="Hospital details, departments, templates, integrations" /> });
