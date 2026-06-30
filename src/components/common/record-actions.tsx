import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Printer, Save, Download, Share2, FileDown } from "lucide-react";
import { useIsSuperAdmin } from "@/lib/use-super-admin";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Handler = () => void;

export type RecordActionsProps = {
  onEdit?: Handler;
  /** Shown only to super_admin. Confirms via AlertDialog before firing. */
  onDelete?: Handler;
  onPrint?: Handler;
  onSave?: Handler;
  onDownload?: Handler;
  onDownloadPdf?: Handler;
  onWhatsApp?: Handler;
  size?: "sm" | "icon" | "default";
  /** Plain-language label used inside the delete confirmation dialog. */
  deleteLabel?: string;
  className?: string;
};

/**
 * Standard per-record action row: Edit · Delete · Print · Save · Download · WhatsApp.
 * Delete is auto-hidden unless the active user is a super_admin.
 */
export function RecordActions({
  onEdit, onDelete, onPrint, onSave, onDownload, onDownloadPdf, onWhatsApp,
  size = "sm", deleteLabel = "this record", className,
}: RecordActionsProps) {
  const isSuperAdmin = useIsSuperAdmin();
  const showDelete = !!onDelete && isSuperAdmin;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      {onEdit && (
        <Button size={size} variant="outline" onClick={onEdit} className="gap-1.5">
          <Pencil className="size-4" />{size !== "icon" && "Edit"}
        </Button>
      )}
      {onSave && (
        <Button size={size} variant="outline" onClick={onSave} className="gap-1.5">
          <Save className="size-4" />{size !== "icon" && "Save"}
        </Button>
      )}
      {onPrint && (
        <Button size={size} variant="outline" onClick={onPrint} className="gap-1.5">
          <Printer className="size-4" />{size !== "icon" && "Print"}
        </Button>
      )}
      {onDownload && (
        <Button size={size} variant="outline" onClick={onDownload} className="gap-1.5">
          <Download className="size-4" />{size !== "icon" && "Excel"}
        </Button>
      )}
      {onDownloadPdf && (
        <Button size={size} variant="outline" onClick={onDownloadPdf} className="gap-1.5">
          <FileDown className="size-4" />{size !== "icon" && "PDF"}
        </Button>
      )}
      {onWhatsApp && (
        <Button size={size} variant="outline" onClick={onWhatsApp} className="gap-1.5 text-emerald-700 hover:text-emerald-800">
          <Share2 className="size-4" />{size !== "icon" && "WhatsApp"}
        </Button>
      )}
      {showDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size={size} variant="outline" className="gap-1.5 text-destructive hover:text-destructive">
              <Trash2 className="size-4" />{size !== "icon" && "Delete"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteLabel}?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. Only super-admins can delete records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
