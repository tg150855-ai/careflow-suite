import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/change-password")({ component: ChangePassword });

function ChangePassword() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { setBusy(false); return toast.error(error.message); }
    await (supabase as any).rpc("mark_password_changed");
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><KeyRound className="size-5" /></div>
          <div>
            <h1 className="text-xl font-semibold">Set a new password</h1>
            <p className="text-sm text-muted-foreground">Your account requires a password change before continuing.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1"><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div className="space-y-1"><Label>Confirm new password</Label><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        </div>
        <Button onClick={submit} disabled={busy || !user} className="w-full">{busy ? "Updating…" : "Update password"}</Button>
      </Card>
    </div>
  );
}
