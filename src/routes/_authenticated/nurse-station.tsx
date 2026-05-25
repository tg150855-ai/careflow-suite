import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/nurse-station")({ component: () => <ComingSoon title="Nurse Station" description="Vitals, medication chart, shift handover" /> });
