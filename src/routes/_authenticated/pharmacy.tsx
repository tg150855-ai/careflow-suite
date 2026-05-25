import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/pharmacy")({ component: () => <ComingSoon title="Pharmacy" description="Inventory, sales billing, batch & expiry tracking" /> });
