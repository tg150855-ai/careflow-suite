import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  PenTool,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Save,
  Printer,
  Download,
  Maximize2,
  Minimize2,
  Pill,
  Plus,
  X,
  FileSignature,
  FileText,
  Grid,
  AlignJustify,
  Square,
  Search,
  Check,
  Building2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useHospitalProfile } from "@/components/print-header";
import { useMyHospital } from "@/lib/use-my-hospital";
import { useMedicineSuggestions } from "@/components/opd/medicine-autocomplete";
import {
  type PatientTabNote,
  type DrawingStroke,
  type StrokePoint,
  type MedicineItem,
  savePatientTabNote,
  printTabNote,
} from "@/lib/patient-tab-notes";

interface TabNotePageCanvasProps {
  patient: {
    id: string;
    full_name?: string | null;
    uhid?: string | null;
    gender?: string | null;
    dob?: string | null;
    blood_group?: string | null;
  };
  department: "OPD" | "IPD" | "OT";
  contextId?: string | null;
  doctorName?: string | null;
  initialNote?: PatientTabNote | null;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onSaved?: (savedNote: PatientTabNote) => void;
  onCancel?: () => void;
}

const PEN_COLORS = [
  { name: "Black", value: "#1e293b", bg: "bg-slate-800" },
  { name: "Medical Blue", value: "#1d4ed8", bg: "bg-blue-700" },
  { name: "Crimson Red", value: "#dc2626", bg: "bg-red-600" },
  { name: "Forest Green", value: "#15803d", bg: "bg-green-700" },
  { name: "Purple", value: "#7e22ce", bg: "bg-purple-700" },
];

const PEN_SIZES = [
  { label: "Fine", value: 2 },
  { label: "Medium", value: 3.5 },
  { label: "Bold", value: 6 },
  { label: "Marker", value: 12 },
];

const COMMON_FREQUENCIES = ["1-0-1", "1-0-0", "0-0-1", "1-1-1", "SOS", "Stat"];

// Base height of the protected Letterhead & Patient Details Header before prescription area
const BASE_HEADER_HEIGHT = 150;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1050;

export function TabNotePageCanvas({
  patient,
  department,
  contextId,
  doctorName,
  initialNote,
  isFullscreen,
  onToggleFullscreen,
  onSaved,
  onCancel,
}: TabNotePageCanvasProps) {
  // Hospital queries
  const { hospital: myHospital } = useMyHospital();
  const { data: hospProfile } = useHospitalProfile();

  // Query actual registered hospitals from the database
  const { data: registeredHospitals = [] } = useQuery({
    queryKey: ["all-registered-hospitals-for-letterhead"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hospitals")
        .select("id, hospital_name, address, phone, email, city, state")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Resolve actual registered hospital name (filtering out any default 'SBG Arogya' placeholder)
  const defaultHospitalName = useMemo(() => {
    if (initialNote?.hospital_name) {
      return initialNote.hospital_name;
    }
    // 1. Check logged in user's tenant hospital
    if (myHospital?.hospital_name && !myHospital.hospital_name.toLowerCase().includes("sbg arogya")) {
      return myHospital.hospital_name;
    }
    // 2. Check registered hospitals in hospitals table
    const realHosp = registeredHospitals.find(
      (h: any) => h.hospital_name && !h.hospital_name.toLowerCase().includes("sbg arogya")
    );
    if (realHosp?.hospital_name) {
      return realHosp.hospital_name;
    }
    // 3. Check hospital_settings if configured by admin
    if (hospProfile?.hospital_name && !hospProfile.hospital_name.toLowerCase().includes("sbg arogya")) {
      return hospProfile.hospital_name;
    }
    // 4. Fallback to myHospital or first registered
    if (myHospital?.hospital_name) return myHospital.hospital_name;
    if (registeredHospitals[0]?.hospital_name) return registeredHospitals[0].hospital_name;

    return "CAREFLOW MULTISPECIALITY HOSPITAL";
  }, [initialNote, myHospital, registeredHospitals, hospProfile]);

  const [hospitalName, setHospitalName] = useState(defaultHospitalName);

  // Sync hospital name when queries resolve
  useEffect(() => {
    if (!hospitalName || hospitalName.toLowerCase().includes("sbg arogya")) {
      if (defaultHospitalName && !defaultHospitalName.toLowerCase().includes("sbg arogya")) {
        setHospitalName(defaultHospitalName);
      }
    }
  }, [defaultHospitalName, hospitalName]);

  const { data: suggestions = [] } = useMedicineSuggestions();

  // Canvas and tool states
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [activeTool, setActiveTool] = useState<"pen" | "eraser">("pen");
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].value);
  const [penSize, setPenSize] = useState<number>(3.5);
  const [paperPattern, setPaperPattern] = useState<"ruled" | "grid" | "plain">(
    initialNote?.background_pattern || "ruled"
  );
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const activeFullscreen = isFullscreen !== undefined ? isFullscreen : internalFullscreen;

  const toggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setInternalFullscreen((prev) => !prev);
    }
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  // Drawing strokes history
  const [strokes, setStrokes] = useState<DrawingStroke[]>(initialNote?.strokes || []);
  const [redoStack, setRedoStack] = useState<DrawingStroke[]>([]);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);
  const isDrawingRef = useRef(false);
  const eraserCursorPosRef = useRef<{ x: number; y: number } | null>(null);

  // Note metadata
  const [title, setTitle] = useState(
    initialNote?.title || `${department} Handwritten Note - ${format(new Date(), "dd MMM yyyy")}`
  );
  const [docName, setDocName] = useState(initialNote?.doctor_name || doctorName || "");
  const [clinicalNotes, setClinicalNotes] = useState(initialNote?.notes || "");
  const [saving, setSaving] = useState(false);

  // Medicine list & quick picker
  const [medicines, setMedicines] = useState<MedicineItem[]>(initialNote?.medicines || []);
  const [medicineQuery, setMedicineQuery] = useState("");
  const [medicineDosage, setMedicineDosage] = useState("1-0-1");
  const [medicineDuration, setMedicineDuration] = useState("5");
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);

  // Patient age calculator
  const patientAge = useMemo(() => {
    if (!patient.dob) return "—";
    try {
      const diff = new Date().getFullYear() - new Date(patient.dob).getFullYear();
      return `${diff}y`;
    } catch {
      return "—";
    }
  }, [patient.dob]);

  // Calculate dynamic protected top area (Hospital Letterhead + Patient Banner + Prescribed Medicines on Page)
  const effectiveHeaderHeight = useMemo(() => {
    if (medicines.length === 0) return 188; // Clean Rx symbol area
    // Base letterhead & patient banner (150px) + Title bar (26px) + Column Headers (22px) + Rows (28px each) + Bottom margin & notes divider (20px)
    return BASE_HEADER_HEIGHT + 26 + 22 + medicines.length * 28 + 20;
  }, [medicines.length]);

  // Redraw canvas content
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear whole canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ==========================================
    // LAYER 1: Paper Background & Ruled/Grid Lines
    // ==========================================
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle paper pattern strictly in the writing area below header and medicines
    if (paperPattern === "ruled") {
      ctx.save();
      ctx.strokeStyle = "#e2e8f0"; // clean subtle ruling line
      ctx.lineWidth = 1;
      const startY = effectiveHeaderHeight + 24;
      const lineSpacing = 30;
      for (let y = startY; y < canvas.height - 25; y += lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(35, y);
        ctx.lineTo(canvas.width - 35, y);
        ctx.stroke();
      }
      // Left vertical margin line
      ctx.strokeStyle = "#fed7aa"; // soft notebook margin line
      ctx.beginPath();
      ctx.moveTo(90, effectiveHeaderHeight + 10);
      ctx.lineTo(90, canvas.height - 25);
      ctx.stroke();
      ctx.restore();
    } else if (paperPattern === "grid") {
      ctx.save();
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      const gridSize = 24;
      for (let x = 35; x < canvas.width - 35; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, effectiveHeaderHeight + 10);
        ctx.lineTo(x, canvas.height - 25);
        ctx.stroke();
      }
      for (let y = effectiveHeaderHeight + 10; y < canvas.height - 25; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(35, y);
        ctx.lineTo(canvas.width - 35, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ==========================================
    // LAYER 2: User Drawing Strokes (CLIPPED TO WRITING AREA)
    // Protected: CANNOT touch or affect anything in the header or medicines!
    // ==========================================
    ctx.save();
    ctx.beginPath();
    // Clip strictly below header & medicines
    ctx.rect(0, effectiveHeaderHeight, canvas.width, canvas.height - effectiveHeaderHeight);
    ctx.clip();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw all confirmed strokes
    for (const stroke of strokes) {
      if (stroke.points.length === 0 || stroke.isEraser) continue;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;

      ctx.beginPath();
      if (stroke.points.length === 1) {
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
      } else {
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          const prev = stroke.points[i - 1];
          const curr = stroke.points[i];
          const midX = (prev.x + curr.x) / 2;
          const midY = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        ctx.stroke();
      }
    }

    // Draw active in-progress stroke
    if (
      currentStrokeRef.current &&
      currentStrokeRef.current.points.length > 0 &&
      !currentStrokeRef.current.isEraser
    ) {
      const active = currentStrokeRef.current;
      ctx.strokeStyle = active.color;
      ctx.lineWidth = active.size;
      ctx.beginPath();
      ctx.moveTo(active.points[0].x, active.points[0].y);
      for (let i = 1; i < active.points.length; i++) {
        const prev = active.points[i - 1];
        const curr = active.points[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      ctx.stroke();
    }

    ctx.restore();

    // ==========================================
    // LAYER 3: Official Hospital Letterhead, Patient Details & Prescribed Medicines
    // Rendered ON TOP - completely protected from any eraser!
    // ==========================================
    ctx.save();

    // Solid white background for the header banner and medicines to ensure 100% clean opacity
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, effectiveHeaderHeight);

    // Top colored brand line
    ctx.fillStyle = hospProfile?.primary_color || "#0284c7";
    ctx.fillRect(0, 0, canvas.width, 6);

    // Actual registered hospital name
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 20px 'Segoe UI', Roboto, sans-serif";
    const displayName = hospitalName.trim() || "CAREFLOW HOSPITAL";
    ctx.fillText(displayName.toUpperCase(), 35, 36);

    // Tagline & Hospital Contact
    ctx.fillStyle = "#64748b";
    ctx.font = "11px 'Segoe UI', Roboto, sans-serif";
    const tagline =
      myHospital?.city && myHospital?.state
        ? `${myHospital.city}, ${myHospital.state}`
        : hospProfile?.tagline || "Multi-Speciality Healthcare & Research Centre";
    ctx.fillText(tagline, 35, 52);

    const contactStr = [
      myHospital?.address || hospProfile?.address,
      myHospital?.phone ? `Ph: ${myHospital.phone}` : hospProfile?.phone ? `Ph: ${hospProfile.phone}` : null,
      myHospital?.email || hospProfile?.email,
    ]
      .filter(Boolean)
      .join("  |  ");

    if (contactStr) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(contactStr, 35, 68);
    }

    // Top right: Official Clinical Record Tag
    ctx.fillStyle = "#0369a1";
    ctx.font = "bold 13px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${department} CLINICAL RECORD`, canvas.width - 35, 36);

    ctx.fillStyle = "#64748b";
    ctx.font = "10px monospace";
    ctx.fillText(`Date: ${format(new Date(), "dd-MMM-yyyy HH:mm")}`, canvas.width - 35, 52);
    if (docName) {
      ctx.fillText(`Dr: ${docName}`, canvas.width - 35, 68);
    }
    ctx.textAlign = "left";

    // Header divider line
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(35, 78);
    ctx.lineTo(canvas.width - 35, 78);
    ctx.stroke();

    // Patient Demographics Banner Box
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(35, 86, canvas.width - 70, 56);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(35, 86, canvas.width - 70, 56);

    // Patient info text
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`Patient: ${patient.full_name || "Unknown"}`, 50, 108);

    ctx.fillStyle = "#475569";
    ctx.font = "11px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(
      `UHID: ${patient.uhid || "—"}   |   Age/Sex: ${patientAge} / ${patient.gender || "—"}   |   Blood: ${patient.blood_group || "—"}`,
      50,
      128
    );

    // Department Badge inside the patient box
    ctx.fillStyle = "#e0f2fe";
    ctx.fillRect(canvas.width - 150, 94, 100, 24);
    ctx.fillStyle = "#0369a1";
    ctx.font = "bold 11px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${department} PAGE`, canvas.width - 100, 110);
    ctx.textAlign = "left";

    // ==========================================
    // RENDER PRESCRIBED MEDICINES DIRECTLY ON THE PAGE CANVAS
    // ==========================================
    const boxTop = 150;
    const boxLeft = 35;
    const boxWidth = canvas.width - 70; // 730px wide

    if (medicines.length === 0) {
      // Classic ℞ Symbol & placeholder notice
      ctx.fillStyle = "#0284c7";
      ctx.font = "bold italic 22px 'Times New Roman', serif";
      ctx.fillText("℞", boxLeft + 10, boxTop + 24);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "italic 11px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(
        "Prescription (℞) • Added medicines will render directly on this page",
        boxLeft + 42,
        boxTop + 21
      );

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(boxLeft, boxTop + 34);
      ctx.lineTo(boxLeft + boxWidth, boxTop + 34);
      ctx.stroke();
    } else {
      const titleH = 26;
      const colHeaderH = 22;
      const rowH = 28;
      const tableHeight = titleH + colHeaderH + medicines.length * rowH;

      // 1. Table Background & Outer Border
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(boxLeft, boxTop, boxWidth, tableHeight);

      // 2. Title Bar (℞ PRESCRIBED MEDICINES)
      ctx.fillStyle = "#f0f9ff"; // soft sky tint
      ctx.fillRect(boxLeft, boxTop, boxWidth, titleH);

      ctx.fillStyle = "#0284c7";
      ctx.font = "bold italic 18px 'Times New Roman', serif";
      ctx.fillText("℞", boxLeft + 10, boxTop + 18);

      ctx.fillStyle = "#0369a1";
      ctx.font = "bold 11px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("PRESCRIBED MEDICINES", boxLeft + 32, boxTop + 17);

      // Item count badge
      ctx.fillStyle = "#bae6fd";
      ctx.fillRect(boxLeft + 175, boxTop + 5, 55, 16);
      ctx.fillStyle = "#0369a1";
      ctx.font = "bold 9.5px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${medicines.length} ITEMS`, boxLeft + 202, boxTop + 16.5);
      ctx.textAlign = "left";

      // Status on right
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("Rendered on Prescription Sheet", boxLeft + boxWidth - 12, boxTop + 17);
      ctx.textAlign = "left";

      // 3. Column Header Row
      const colHeaderY = boxTop + titleH;
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(boxLeft, colHeaderY, boxWidth, colHeaderH);

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(boxLeft, colHeaderY);
      ctx.lineTo(boxLeft + boxWidth, colHeaderY);
      ctx.moveTo(boxLeft, colHeaderY + colHeaderH);
      ctx.lineTo(boxLeft + boxWidth, colHeaderY + colHeaderH);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 9.5px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("#", boxLeft + 12, colHeaderY + 15);
      ctx.fillText("MEDICINE NAME & STRENGTH", boxLeft + 38, colHeaderY + 15);
      ctx.fillText("DOSAGE", boxLeft + 385, colHeaderY + 15);
      ctx.fillText("DURATION", boxLeft + 490, colHeaderY + 15);
      ctx.fillText("INSTRUCTIONS", boxLeft + 575, colHeaderY + 15);

      // 4. Medicine Rows
      for (let i = 0; i < medicines.length; i++) {
        const med = medicines[i];
        const rowY = colHeaderY + colHeaderH + i * rowH;

        // Alternating row background
        ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#fafcfd";
        ctx.fillRect(boxLeft, rowY, boxWidth, rowH);

        // Row bottom divider
        ctx.strokeStyle = "#f1f5f9";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(boxLeft, rowY + rowH);
        ctx.lineTo(boxLeft + boxWidth, rowY + rowH);
        ctx.stroke();

        // 1. Number
        ctx.fillStyle = "#0284c7";
        ctx.font = "bold 11px 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(`${i + 1}.`, boxLeft + 12, rowY + 18);

        // 2. Medicine Name
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px 'Segoe UI', Roboto, sans-serif";
        const maxMedLen = 42;
        const displayName = med.name.length > maxMedLen ? `${med.name.slice(0, 40)}...` : med.name;
        ctx.fillText(displayName, boxLeft + 38, rowY + 18);

        // 3. Dosage Pill Badge
        const doseStr = med.dosage || "1-0-1";
        const doseW = 72;
        const doseH = 18;
        const doseX = boxLeft + 382;
        const doseY = rowY + 5;

        ctx.fillStyle = "#e0f2fe";
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(doseX, doseY, doseW, doseH, 8);
        } else {
          ctx.rect(doseX, doseY, doseW, doseH);
        }
        ctx.fill();

        ctx.strokeStyle = "#bae6fd";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#0369a1";
        ctx.font = "bold 10px 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(doseStr, doseX + doseW / 2, doseY + 12.5);
        ctx.textAlign = "left";

        // 4. Duration
        ctx.fillStyle = "#334155";
        ctx.font = "11px 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(med.duration || "5d", boxLeft + 490, rowY + 18);

        // 5. Instructions
        ctx.fillStyle = "#475569";
        ctx.font = "11px 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(med.instructions || "After meals", boxLeft + 575, rowY + 18);

        // 6. Delete (✕) Icon Button on page
        const delCenterX = boxLeft + boxWidth - 18;
        const delCenterY = rowY + 14;

        ctx.fillStyle = "#fee2e2";
        ctx.beginPath();
        ctx.arc(delCenterX, delCenterY, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("✕", delCenterX, delCenterY + 3.5);
        ctx.textAlign = "left";
      }

      // Outer border of table
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(boxLeft, boxTop, boxWidth, tableHeight);

      // 5. Section Divider for Handwritten Notes below
      const notesDividerY = boxTop + tableHeight + 14;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 9px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("✎ DOCTOR'S CLINICAL OBSERVATIONS & HANDWRITTEN NOTES", boxLeft + 5, notesDividerY);

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(boxLeft + 300, notesDividerY - 3);
      ctx.lineTo(boxLeft + boxWidth, notesDividerY - 3);
      ctx.stroke();
    }

    // ==========================================
    // LAYER 4: Eraser Visual Cursor (when active)
    // ==========================================
    if (activeTool === "eraser" && eraserCursorPosRef.current) {
      const { x, y } = eraserCursorPosRef.current;
      if (y >= effectiveHeaderHeight) {
        ctx.save();
        ctx.strokeStyle = "#ef4444";
        ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(16, penSize * 4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
        ctx.restore();
      }
    }

    // ==========================================
    // LAYER 5: Footer Page Number & Confidential Stamp
    // ==========================================
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Digitally handwritten clinical record • Confidential", 40, canvas.height - 10);
    ctx.textAlign = "right";
    ctx.fillText("Page 1 of 1", canvas.width - 40, canvas.height - 10);
    ctx.restore();
  }, [
    hospitalName,
    myHospital,
    hospProfile,
    department,
    patient,
    patientAge,
    docName,
    paperPattern,
    strokes,
    activeTool,
    penSize,
    medicines,
    effectiveHeaderHeight,
  ]);

  // Initial and subsequent redraws
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Helper to convert screen pointer to canvas coordinates
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure && e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  // Erase strokes intersecting with coordinates (TRUE STROKE ERASING)
  // Only deletes user pen strokes — NEVER touches the header, patient details, or medicines!
  const eraseStrokesAt = (coords: StrokePoint) => {
    if (coords.y < effectiveHeaderHeight) return; // Header & medicines are strictly protected

    const eraseRadius = Math.max(16, penSize * 4);
    const erased: DrawingStroke[] = [];
    const remaining: DrawingStroke[] = [];

    for (const stroke of strokes) {
      const hit = stroke.points.some(
        (pt) => Math.hypot(pt.x - coords.x, pt.y - coords.y) <= eraseRadius
      );
      if (hit) {
        erased.push(stroke);
      } else {
        remaining.push(stroke);
      }
    }

    if (erased.length > 0) {
      setStrokes(remaining);
      setRedoStack((prev) => [...erased, ...prev]);
    }
  };

  // Pointer event handlers for drawing (works seamlessly with pen, stylus, finger touch, mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const coords = getCanvasCoords(e);

    // 1. Check if clicking on the remove button (✕) of any medicine row directly on the page
    if (medicines.length > 0 && coords.x >= CANVAS_WIDTH - 65 && coords.x <= CANVAS_WIDTH - 25) {
      const boxTop = 150;
      const titleH = 26;
      const colHeaderH = 22;
      const rowH = 28;
      for (let i = 0; i < medicines.length; i++) {
        const rowY = boxTop + titleH + colHeaderH + i * rowH;
        if (coords.y >= rowY && coords.y <= rowY + rowH) {
          handleRemoveMedicine(i);
          return;
        }
      }
    }

    // 2. If touching the protected header & medicine area, do not start drawing or erasing!
    if (coords.y <= effectiveHeaderHeight + 2) {
      return;
    }

    isDrawingRef.current = true;

    if (activeTool === "eraser") {
      eraserCursorPosRef.current = { x: coords.x, y: coords.y };
      eraseStrokesAt(coords);
    } else {
      currentStrokeRef.current = {
        points: [coords],
        color: penColor,
        size: penSize,
        isEraser: false,
      };
    }

    redrawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    if (activeTool === "eraser") {
      eraserCursorPosRef.current = { x: coords.x, y: coords.y };
      if (isDrawingRef.current) {
        eraseStrokesAt(coords);
      }
      redrawCanvas();
      return;
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    e.preventDefault();

    // Prevent pen from drawing into the header and medicine area
    if (coords.y < effectiveHeaderHeight + 2) {
      coords.y = effectiveHeaderHeight + 2;
    }

    currentStrokeRef.current.points.push(coords);
    redrawCanvas();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === "eraser") {
      isDrawingRef.current = false;
      return;
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    e.preventDefault();

    isDrawingRef.current = false;
    const finishedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (finishedStroke.points.length > 0) {
      setStrokes((prev) => [...prev, finishedStroke]);
      setRedoStack([]); // Clear redo stack on new stroke
    }

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerLeave = () => {
    eraserCursorPosRef.current = null;
    redrawCanvas();
  };

  // Tool actions
  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [last, ...prev]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((prev) => prev.slice(1));
    setStrokes((prev) => [...prev, next]);
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    if (window.confirm("Clear all handwriting on this page? (Header and patient data remain untouched)")) {
      setRedoStack((prev) => [...strokes, ...prev]);
      setStrokes([]);
      toast.info("Pen strokes cleared");
    }
  };

  // Add medicine to page list
  const handleAddMedicine = (medName?: string) => {
    const nameToAdd = (medName || medicineQuery).trim();
    if (!nameToAdd) {
      toast.warning("Please enter or select a medicine name");
      return;
    }

    const newItem: MedicineItem = {
      id: crypto.randomUUID(),
      name: nameToAdd,
      dosage: medicineDosage,
      duration: `${medicineDuration}d`,
      instructions: "After meals",
    };

    setMedicines((prev) => [...prev, newItem]);
    setMedicineQuery("");
    setShowMedicineDropdown(false);
    toast.success(`"${nameToAdd}" rendered on prescription page`);
  };

  const handleRemoveMedicine = (idx: number) => {
    setMedicines((prev) => {
      const removed = prev[idx];
      if (removed) {
        toast.info(`"${removed.name}" removed from page`);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Save the complete page
  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      // Generate full resolution PNG data URL
      const imageData = canvas.toDataURL("image/png", 0.95);

      const saved = await savePatientTabNote({
        id: initialNote?.id,
        patient_id: patient.id,
        department,
        context_id: contextId || null,
        title: title.trim() || `${department} Note`,
        hospital_name: hospitalName.trim() || null,
        doctor_name: docName.trim() || null,
        notes: clinicalNotes.trim() || null,
        medicines,
        background_pattern: paperPattern,
        strokes,
        image_data: imageData,
        canvas_width: CANVAS_WIDTH,
        canvas_height: CANVAS_HEIGHT,
        created_at: initialNote?.created_at,
      });

      toast.success(initialNote ? "Handwritten page updated" : "New page saved to patient record");
      if (onSaved) onSaved(saved);
    } catch (err: any) {
      console.error("[tab-note save error]", err);
      toast.error(err.message || "Failed to save page");
    } finally {
      setSaving(false);
    }
  };

  // Print current page
  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageData = canvas.toDataURL("image/png");

    printTabNote({
      id: initialNote?.id || "temp",
      patient_id: patient.id,
      department,
      title,
      hospital_name: hospitalName,
      doctor_name: docName,
      medicines,
      background_pattern: paperPattern,
      strokes,
      image_data: imageData,
      canvas_width: CANVAS_WIDTH,
      canvas_height: CANVAS_HEIGHT,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  // Download high-resolution PNG
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${patient.full_name || "Patient"}_${department}_TabNote_${format(new Date(), "yyyyMMdd_HHmm")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Page downloaded as PNG");
  };

  // Filtered medicine suggestions
  const filteredSuggestions = useMemo(() => {
    if (!medicineQuery.trim()) return suggestions.slice(0, 8);
    const q = medicineQuery.toLowerCase();
    return suggestions
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [suggestions, medicineQuery]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-background transition-all duration-150 w-full ${
        activeFullscreen ? "space-y-3 p-1 md:p-2" : "space-y-4"
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-card p-2.5 md:p-3 rounded-xl border shadow-sm w-full">
        {/* Left: Title + Department + Hospital */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileSignature className="size-4" />
          </div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 font-semibold text-xs md:text-sm w-44 md:w-56 bg-transparent border-dashed hover:border-solid focus:border-solid shrink-0"
            placeholder="Page Title"
          />
          <Badge variant="outline" className="text-[11px] bg-primary/5 text-primary border-primary/20 shrink-0">
            {department} Tab
          </Badge>

          {/* Hospital Name Editor Field */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border bg-muted/40 shrink-0">
            <Building2 className="size-3 text-primary shrink-0" />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Hospital:</span>
            <Input
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              placeholder="Registered Hospital Name"
              className="h-6 text-[11px] font-medium w-36 md:w-52 bg-background border-muted px-1.5 py-0"
            />
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0 flex-wrap">
          <Button
            type="button"
            variant={activeFullscreen ? "default" : "outline"}
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 text-xs shrink-0"
            title="Toggle Fullscreen"
          >
            {activeFullscreen ? <Minimize2 className="size-3.5 mr-1" /> : <Maximize2 className="size-3.5 mr-1" />}
            {activeFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={handleDownload} className="h-8 text-xs shrink-0">
            <Download className="size-3.5 mr-1" />
            Download
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs shrink-0">
            <Printer className="size-3.5 mr-1" />
            Print
          </Button>

          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8 text-xs shrink-0">
              Cancel
            </Button>
          )}

          <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs font-semibold shrink-0">
            <Save className="size-3.5 mr-1" />
            {saving ? "Saving..." : initialNote ? "Update Page" : "Save Page"}
          </Button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Toolbar / Medicine Selector Column */}
        <div className="lg:col-span-4 space-y-4">
          {/* Tab Pen & Stylus Controls Card */}
          <Card className="p-4 space-y-4 shadow-sm border">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PenTool className="size-3.5 text-primary" />
                Pen & Page Tools
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {activeTool === "pen" ? "Pen Active" : "Ink Eraser Active"}
              </Badge>
            </div>

            {/* Mode: Pen vs Eraser */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={activeTool === "pen" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTool("pen")}
                className="h-9 justify-center gap-2 font-medium"
              >
                <PenTool className="size-4" />
                Pen Mode
              </Button>
              <Button
                type="button"
                variant={activeTool === "eraser" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setActiveTool("eraser")}
                className="h-9 justify-center gap-2 font-medium"
                title="Erases only drawn pen strokes — header & patient data are completely protected"
              >
                <Eraser className="size-4" />
                Erase Ink
              </Button>
            </div>

            {activeTool === "eraser" && (
              <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300">
                Touch/drag the pen over any drawn stroke to erase it. The hospital letterhead and patient details are permanently protected.
              </div>
            )}

            {/* Pen Stroke Colors */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ink Color</Label>
              <div className="flex items-center gap-2">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setPenColor(c.value);
                      setActiveTool("pen");
                    }}
                    className={`size-7 rounded-full border-2 transition-all flex items-center justify-center ${
                      penColor === c.value && activeTool === "pen"
                        ? "border-primary scale-110 shadow-sm"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {penColor === c.value && activeTool === "pen" && <Check className="size-3 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Pen Stroke Sizes */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Stroke / Eraser Thickness</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {PEN_SIZES.map((s) => (
                  <Button
                    key={s.value}
                    type="button"
                    variant={penSize === s.value ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setPenSize(s.value)}
                    className={`h-7 text-xs ${penSize === s.value ? "font-semibold border" : ""}`}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Undo, Redo, Clear */}
            <div className="flex items-center gap-2 pt-1 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="flex-1 h-8 text-xs"
                title="Undo last stroke"
              >
                <Undo2 className="size-3.5 mr-1" />
                Undo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="flex-1 h-8 text-xs"
                title="Redo stroke"
              >
                <Redo2 className="size-3.5 mr-1" />
                Redo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={strokes.length === 0}
                className="h-8 text-xs text-destructive hover:bg-destructive/10"
                title="Clear Page Canvas"
              >
                <Trash2 className="size-3.5 mr-1" />
                Clear
              </Button>
            </div>

            {/* Paper Ruling / Pattern */}
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs text-muted-foreground">Paper Background Style</Label>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  type="button"
                  variant={paperPattern === "ruled" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPaperPattern("ruled")}
                  className="h-7 text-xs"
                >
                  <AlignJustify className="size-3 mr-1" />
                  Ruled
                </Button>
                <Button
                  type="button"
                  variant={paperPattern === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPaperPattern("grid")}
                  className="h-7 text-xs"
                >
                  <Grid className="size-3 mr-1" />
                  Grid
                </Button>
                <Button
                  type="button"
                  variant={paperPattern === "plain" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPaperPattern("plain")}
                  className="h-7 text-xs"
                >
                  <Square className="size-3 mr-1" />
                  Plain
                </Button>
              </div>
            </div>
          </Card>

          {/* Medicine Name Section Card */}
          <Card className="p-4 space-y-3 shadow-sm border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Pill className="size-4 text-primary" />
                <h3 className="font-semibold text-xs uppercase tracking-wide">Add Medicines to Page (℞)</h3>
              </div>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                {medicines.length} On Page
              </Badge>
            </div>

            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 text-[11px] text-sky-800 dark:text-sky-300 flex items-center gap-2">
              <Sparkles className="size-3.5 text-sky-600 shrink-0" />
              <span>Medicines render directly on the prescription sheet.</span>
            </div>

            {/* Medicine Name Autocomplete Input */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={medicineQuery}
                  onChange={(e) => {
                    setMedicineQuery(e.target.value);
                    setShowMedicineDropdown(true);
                  }}
                  onFocus={() => setShowMedicineDropdown(true)}
                  placeholder="Type or select medicine name..."
                  className="h-9 pl-8 text-xs"
                />
                {medicineQuery && (
                  <button
                    type="button"
                    onClick={() => setMedicineQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showMedicineDropdown && filteredSuggestions.length > 0 && (
                <div className="rounded-lg border bg-popover text-popover-foreground shadow-md p-1 max-h-40 overflow-y-auto space-y-0.5">
                  {filteredSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddMedicine(s.name)}
                      className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted flex items-center justify-between group"
                    >
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground group-hover:text-primary">
                        + Render on Page
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Frequency Quick Selectors */}
              <div className="flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground shrink-0">Dose:</Label>
                <div className="flex gap-1 overflow-x-auto py-0.5">
                  {COMMON_FREQUENCIES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setMedicineDosage(f)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        medicineDosage === f
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Add Button */}
              {medicineQuery && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAddMedicine()}
                  className="w-full h-8 text-xs"
                >
                  <Plus className="size-3.5 mr-1" />
                  Add "{medicineQuery}" to Page
                </Button>
              )}
            </div>

            {/* Prescribed Medicines List */}
            {medicines.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                <div className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center justify-between">
                  <span>Rendered on Page:</span>
                  <span className="text-[9px] text-primary">Live on sheet</span>
                </div>
                {medicines.map((med, i) => (
                  <div
                    key={med.id || i}
                    className="p-2 rounded-lg border bg-muted/30 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate text-foreground">{med.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {med.dosage || "1-0-1"} • {med.duration || "5d"} • {med.instructions}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="secondary" className="text-[9px] h-5 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-200">
                        On Page
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleRemoveMedicine(i)}
                        className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove from page"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center py-2 italic">
                No medicines added yet. Type or choose a medicine above to render it on the page.
              </p>
            )}
          </Card>

          {/* Clinical Notes / Doctor Advice */}
          <Card className="p-4 space-y-2 shadow-sm border">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" />
              Typed Notes / Advice
            </Label>
            <Textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Optional typed notes or clinical findings alongside handwriting..."
              rows={3}
              className="text-xs resize-none"
            />
          </Card>
        </div>

        {/* Right Canvas Column (The Hospital Letterhead Page) */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center">
          <div className="w-full flex items-center justify-between px-2 pb-1 text-xs text-muted-foreground">
            <span>
              Writing area: below header • <strong className="text-foreground">{activeTool === "pen" ? "PEN" : "ERASER"}</strong> active
            </span>
            <span className="text-[11px]">Protected Hospital Letterhead Header</span>
          </div>

          {/* The Page Container with Realistic Paper Shadow */}
          <div className="relative w-full max-w-[800px] shadow-2xl rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-white">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              style={{
                touchAction: "none",
                cursor: activeTool === "eraser" ? "crosshair" : "crosshair",
              }}
              className="w-full h-auto block select-none bg-white"
            />
          </div>

          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Writing with pen or stylus is performed in the page area. The eraser only deletes your drawn strokes — the hospital header and patient details are permanently preserved.
          </p>
        </div>
      </div>
    </div>
  );
}
