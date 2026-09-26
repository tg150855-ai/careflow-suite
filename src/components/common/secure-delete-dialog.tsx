import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface SecureDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  deleteLabel?: string;
  title?: string;
  description?: string;
}

/**
 * Universal secure deletion dialog:
 * - Super Admins: Can delete directly via simple confirmation dialog (no password popup).
 * - Other Users: Must enter their account password verified server-side against Supabase Auth before deletion is authorized.
 */
export function SecureDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  deleteLabel = "this record",
  title,
  description,
}: SecureDeleteDialogProps) {
  const { user, roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  function handleClose() {
    setPassword("");
    setVerifying(false);
    onOpenChange(false);
  }

  async function handleVerifyAndDelete(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!password) {
      toast.error("Please enter your password to confirm deletion.");
      return;
    }
    if (!user?.email) {
      toast.error("User email not found. Please re-login.");
      return;
    }

    setVerifying(true);
    try {
      // Cryptographic server-side password check via Supabase Auth
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (authErr) {
        toast.error("Incorrect password. Deletion not authorized.");
        setPassword("");
        return;
      }

      // Password verified successfully
      await onConfirm();
      handleClose();
    } catch (err: any) {
      toast.error(err.message ?? "Authorization failed.");
    } finally {
      setVerifying(false);
    }
  }

  // Super Admin view: direct confirmation without password
  if (isSuperAdmin) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title ?? `Delete ${deleteLabel}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {description ??
                "This action cannot be undone. As Super Admin, you are deleting this record directly."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await onConfirm();
                handleClose();
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Other Users view: password confirmation required
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleVerifyAndDelete}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Lock className="size-4" />
              {title ?? `Confirm Deletion: ${deleteLabel}`}
            </DialogTitle>
            <DialogDescription>
              {description ??
                `This action cannot be undone. Enter your password to authorize the deletion of ${deleteLabel}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label htmlFor="secure-delete-password">Account Password</Label>
              <Input
                id="secure-delete-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={verifying}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={verifying}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={verifying || !password}
              className="gap-1.5"
            >
              {verifying ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" /> Verify & Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Drop-in button with secure delete verification built-in.
 */
export function SecureDeleteButton({
  onConfirm,
  deleteLabel = "this record",
  size = "sm",
  variant = "outline",
  className = "",
  title,
  description,
  disabled = false,
}: {
  onConfirm: () => void | Promise<void>;
  deleteLabel?: string;
  size?: "sm" | "icon" | "default";
  variant?: "outline" | "ghost" | "destructive";
  className?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size={size}
        variant={variant}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`gap-1.5 text-destructive hover:text-destructive ${className}`}
        title={`Delete ${deleteLabel}`}
      >
        <Trash2 className="size-4" />
        {size !== "icon" && "Delete"}
      </Button>

      <SecureDeleteDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={onConfirm}
        deleteLabel={deleteLabel}
        title={title}
        description={description}
      />
    </>
  );
}
