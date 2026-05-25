import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/laboratory")({ component: () => <ComingSoon title="Laboratory" description="Test orders, sample tracking, report upload" /> });
