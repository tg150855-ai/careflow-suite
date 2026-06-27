import { Button } from "@/components/ui/button";
import {
  Plus, Pencil, Trash2, Save, Download, Printer, FileSpreadsheet, Settings, Share2,
} from "lucide-react";

type Handler = () => void;

export type ModuleActionBarProps = {
  /** Each handler is opt-in — buttons only appear when a handler is provided, so we never duplicate existing UI. */
  onAdd?: Handler;
  onEdit?: Handler;
  onDelete?: Handler;
  onSave?: Handler;
  onDownloadReport?: Handler;
  onPrint?: Handler;
  onExport?: Handler;
  onSettings?: Handler;
  onWhatsAppShare?: Handler;
  /** Right-side slot for module-specific extras (filters, view toggles). */
  extra?: React.ReactNode;
  /** Left-side slot, typically a SearchBox. */
  leading?: React.ReactNode;
  size?: "sm" | "default";
  className?: string;
  /** Disable interactive buttons (e.g. while saving). */
  disabled?: boolean;
};

/**
 * Standard module dashboard action bar. Render only the buttons whose handler is supplied
 * so pages can adopt the bar incrementally without duplicating existing controls.
 */
export function ModuleActionBar({
  onAdd, onEdit, onDelete, onSave, onDownloadReport, onPrint, onExport, onSettings, onWhatsAppShare,
  extra, leading, size = "sm", className, disabled,
}: ModuleActionBarProps) {
  const btn = size === "sm" ? "h-9" : "";
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {leading && <div className="flex-1 min-w-[180px] max-w-md">{leading}</div>}
      <div className="flex flex-wrap items-center gap-1.5">
        {onAdd && (
          <Button size={size} onClick={onAdd} disabled={disabled} className={`gap-1.5 ${btn}`}>
            <Plus className="size-4" /> Add
          </Button>
        )}
        {onEdit && (
          <Button size={size} variant="outline" onClick={onEdit} disabled={disabled} className={`gap-1.5 ${btn}`}>
            <Pencil className="size-4" /> Edit
          </Button>
        )}
        {onSave && (
          <Button size={size} variant="outline" onClick={onSave} disabled={disabled} className={`gap-1.5 ${btn}`}>
            <Save className="size-4" /> Save
          </Button>
        )}
        {onDelete && (
          <Button size={size} variant="outline" onClick={onDelete} disabled={disabled} className={`gap-1.5 ${btn} text-destructive hover:text-destructive`}>
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
        {onDownloadReport && (
          <Button size={size} variant="outline" onClick={onDownloadReport} disabled={disabled} className={`gap-1.5 ${btn}`}>
            <Download className="size-4" /> Report
          </Button>
        )}
        {onPrint && (
          <Button size={size} variant="outline" onClick={onPrint} disabled={disabled} className={`gap-1.5 ${btn}`}>
            <Printer className="size-4" /> Print
          </Button>
        )}
        {onExport && (
          <Button size={size} variant="outline" onClick={onExport} disabled={disabled} className={`gap-1.5 ${btn}`}>
            <FileSpreadsheet className="size-4" /> Export
          </Button>
        )}
        {onWhatsAppShare && (
          <Button size={size} variant="outline" onClick={onWhatsAppShare} disabled={disabled} className={`gap-1.5 ${btn} text-emerald-700 hover:text-emerald-800`}>
            <Share2 className="size-4" /> WhatsApp
          </Button>
        )}
        {onSettings && (
          <Button size={size} variant="ghost" onClick={onSettings} disabled={disabled} className={`gap-1.5 ${btn}`}>
            <Settings className="size-4" />
          </Button>
        )}
      </div>
      {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
    </div>
  );
}
