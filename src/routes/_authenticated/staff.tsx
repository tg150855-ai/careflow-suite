import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/staff")({ component: () => <ComingSoon title="Staff Management" description="Doctors, nurses, attendance, shifts, salary" /> });
