import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Printer, Save, Download, Share2, FileDown, Trash2 } from "lucide-react";
import { SecureDeleteDialog } from "@/components/common/secure-delete-dialog";

type Handler = () => void | Promise<void>;

export type RecordActionsProps = {
  onEdit?: Handler;
  /** Delete action protected by SecureDeleteDialog (super_admin direct, others password-verified). */
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
 * Deletion is protected: Super Admin deletes directly, other users must verify account password.
 */
export function RecordActions({
  onEdit, onDelete, onPrint, onSave, onDownload, onDownloadPdf, onWhatsApp,
  size = "sm", deleteLabel = "this record", className,
}: RecordActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

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
      {onDelete && (
        <>
          <Button
            size={size}
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="gap-1.5 text-destructive hover:text-destructive"
            title={`Delete ${deleteLabel}`}
          >
            <Trash2 className="size-4" />{size !== "icon" && "Delete"}
          </Button>
          <SecureDeleteDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onConfirm={onDelete}
            deleteLabel={deleteLabel}
          />
        </>
      )}
    </div>
  );
}

