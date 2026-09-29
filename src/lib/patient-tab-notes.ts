import { supabase } from "@/integrations/supabase/client";

export interface MedicineItem {
  id?: string;
  name: string;
  strength?: string;
  dosage?: string; // frequency e.g. "1-0-1"
  food_instruction?: string;
  duration?: string;
  instructions?: string;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface DrawingStroke {
  points: StrokePoint[];
  color: string;
  size: number;
  isEraser?: boolean;
}

export interface PatientTabNote {
  id: string;
  patient_id: string;
  department: "OPD" | "IPD" | "OT";
  context_id?: string | null;
  title: string;
  hospital_name?: string | null;
  doctor_name?: string | null;
  notes?: string | null;
  medicines: MedicineItem[];
  background_pattern: "ruled" | "grid" | "plain";
  strokes: DrawingStroke[];
  image_data: string; // Base64 PNG data URL of the complete page
  canvas_width: number;
  canvas_height: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

const LOCAL_STORAGE_KEY_PREFIX = "cf_tab_notes_patient_";

function getLocalNotes(patientId: string): PatientTabNote[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${patientId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[patient-tab-notes] local read error:", err);
    return [];
  }
}

function saveLocalNotes(patientId: string, notes: PatientTabNote[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${patientId}`, JSON.stringify(notes));
  } catch (err) {
    console.warn("[patient-tab-notes] local write error:", err);
  }
}

/**
 * Fetch all tab notes for a specific patient, optionally filtered by department.
 */
export async function getPatientTabNotes(
  patientId: string,
  department?: "OPD" | "IPD" | "OT"
): Promise<PatientTabNote[]> {
  if (!patientId) return [];

  // Try Supabase first
  try {
    let query = (supabase as any)
      .from("patient_tab_notes")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (department) {
      query = query.eq("department", department);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      // Merge with local storage cache to ensure all recent saves are retained
      const local = getLocalNotes(patientId);
      const remoteIds = new Set(data.map((d: any) => d.id));
      const filteredLocal = local.filter(
        (l) => !remoteIds.has(l.id) && (!department || l.department === department)
      );

      const merged = [...data, ...filteredLocal].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      saveLocalNotes(patientId, merged);
      return merged;
    }
  } catch (err) {
    console.debug("[patient-tab-notes] remote fetch fallback to local:", err);
  }

  // Fallback to local storage
  const local = getLocalNotes(patientId);
  if (department) {
    return local.filter((n) => n.department === department);
  }
  return local;
}

/**
 * Get a single tab note by ID
 */
export async function getPatientTabNoteById(
  id: string,
  patientId?: string
): Promise<PatientTabNote | null> {
  if (patientId) {
    const local = getLocalNotes(patientId);
    const found = local.find((n) => n.id === id);
    if (found) return found;
  }

  try {
    const { data, error } = await (supabase as any)
      .from("patient_tab_notes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) return data as PatientTabNote;
  } catch {
    // fallback
  }

  return null;
}

/**
 * Save or update a patient tab note.
 */
export async function savePatientTabNote(
  noteInput: Omit<PatientTabNote, "id" | "created_at" | "updated_at"> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
  }
): Promise<PatientTabNote> {
  const now = new Date().toISOString();
  const id = noteInput.id || crypto.randomUUID();
  const fullNote: PatientTabNote = {
    ...noteInput,
    id,
    medicines: noteInput.medicines || [],
    strokes: noteInput.strokes || [],
    background_pattern: noteInput.background_pattern || "ruled",
    canvas_width: noteInput.canvas_width || 800,
    canvas_height: noteInput.canvas_height || 1050,
    created_at: noteInput.created_at || now,
    updated_at: now,
  };

  // 1. Immediately update Local Storage so UI updates without lag
  const localNotes = getLocalNotes(fullNote.patient_id);
  const existingIdx = localNotes.findIndex((n) => n.id === id);
  if (existingIdx >= 0) {
    localNotes[existingIdx] = fullNote;
  } else {
    localNotes.unshift(fullNote);
  }
  saveLocalNotes(fullNote.patient_id, localNotes);

  // 2. Persist to Supabase patient_tab_notes table
  try {
    const payload = {
      id: fullNote.id,
      patient_id: fullNote.patient_id,
      department: fullNote.department,
      context_id: fullNote.context_id || null,
      title: fullNote.title,
      hospital_name: fullNote.hospital_name || null,
      doctor_name: fullNote.doctor_name || null,
      notes: fullNote.notes || null,
      medicines: fullNote.medicines,
      background_pattern: fullNote.background_pattern,
      strokes: fullNote.strokes,
      image_data: fullNote.image_data,
      canvas_width: fullNote.canvas_width,
      canvas_height: fullNote.canvas_height,
      created_by: fullNote.created_by || null,
      created_at: fullNote.created_at,
      updated_at: fullNote.updated_at,
    };

    const { error } = await (supabase as any)
      .from("patient_tab_notes")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.warn("[patient-tab-notes] remote upsert warning:", error.message);
    }
  } catch (err) {
    console.warn("[patient-tab-notes] remote save caught error:", err);
  }

  return fullNote;
}

/**
 * Delete a tab note by ID
 */
export async function deletePatientTabNote(id: string, patientId: string): Promise<boolean> {
  // Remove from local storage
  const localNotes = getLocalNotes(patientId);
  const filtered = localNotes.filter((n) => n.id !== id);
  saveLocalNotes(patientId, filtered);

  // Remove from Supabase
  try {
    const { error } = await (supabase as any)
      .from("patient_tab_notes")
      .delete()
      .eq("id", id);
    if (error) {
      console.warn("[patient-tab-notes] remote delete warning:", error.message);
    }
  } catch (err) {
    console.warn("[patient-tab-notes] remote delete caught error:", err);
  }

  return true;
}

/**
 * Trigger print dialog with hospital letterhead and the tab note drawing
 */
export function printTabNote(note: PatientTabNote) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${note.title} - Patient Note</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #111827;
            background: #fff;
          }
          .page-container {
            max-width: 800px;
            margin: 0 auto;
          }
          img.note-image {
            width: 100%;
            height: auto;
            display: block;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <img class="note-image" src="${note.image_data}" alt="${note.title}" />
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
