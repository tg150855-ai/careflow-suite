import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_DISCHARGE_TEMPLATES,
  fetchDischargeTemplates,
  saveDischargeTemplate,
  deleteDischargeTemplate,
} from "./discharge-templates";

describe("Discharge Templates Library", () => {
  beforeEach(() => {
    if (typeof globalThis.localStorage === "undefined") {
      let store: Record<string, string> = {};
      (globalThis as any).localStorage = {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, val: string) => { store[key] = val; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
      };
    } else {
      localStorage.clear();
    }
  });

  it("should provide default discharge templates for major medical specialties", () => {
    expect(DEFAULT_DISCHARGE_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    const names = DEFAULT_DISCHARGE_TEMPLATES.map((t) => t.name);
    expect(names.some((n) => n.includes("Laparoscopic"))).toBe(true);
    expect(names.some((n) => n.includes("Gastroenteritis"))).toBe(true);
    expect(names.some((n) => n.includes("Pneumonia"))).toBe(true);
    expect(names.some((n) => n.includes("Coronary") || n.includes("Hypertension"))).toBe(true);
    expect(names.some((n) => n.includes("Diabetes"))).toBe(true);
    expect(names.some((n) => n.includes("Fracture") || n.includes("ORIF"))).toBe(true);
    expect(names.some((n) => n.includes("Vaginal Delivery"))).toBe(true);
    expect(names.some((n) => n.includes("Stroke"))).toBe(true);
  });

  it("should contain diagnosis, follow-up, and prescription medicines in each default template", () => {
    DEFAULT_DISCHARGE_TEMPLATES.forEach((tpl) => {
      expect(tpl.primary_diagnosis).toBeTruthy();
      expect(tpl.follow_up_instructions).toBeTruthy();
      expect(tpl.medicines.length).toBeGreaterThan(0);
      tpl.medicines.forEach((med) => {
        expect(med.medicine_name).toBeTruthy();
        expect(med.frequency).toBeTruthy();
      });
    });
  });

  it("fetchDischargeTemplates should return default templates when storage is empty", async () => {
    const list = await fetchDischargeTemplates();
    expect(list.length).toBeGreaterThanOrEqual(DEFAULT_DISCHARGE_TEMPLATES.length);
  });

  it("should save custom discharge template and allow deleting it", async () => {
    const custom = await saveDischargeTemplate({
      name: "Custom Inguinal Hernia Template",
      category: "General Surgery",
      primary_diagnosis: "Right Inguinal Hernia - Post Mesh Hernioplasty",
      secondary_diagnosis: "None",
      doctor_notes: "Wound healthy. Avoid heavy weight lifting.",
      hospital_course: "Elective repair under spinal anesthesia.",
      follow_up_instructions: "Review in 7 days for suture removal.",
      follow_up_days: 7,
      condition_at_discharge: "Stable",
      medicines: [
        { medicine_name: "Tab Cefixime 200mg", dose: "200mg", route: "Oral", frequency: "1-0-1", duration: "5 days", instructions: "After food" },
        { medicine_name: "Tab Paracetamol 650mg", dose: "650mg", route: "Oral", frequency: "1-0-1 SOS", duration: "3 days", instructions: "For pain" },
      ],
    });

    expect(custom.id).toBeDefined();
    expect(custom.name).toBe("Custom Inguinal Hernia Template");

    const templatesAfterSave = await fetchDischargeTemplates();
    expect(templatesAfterSave.some((t) => t.id === custom.id)).toBe(true);

    await deleteDischargeTemplate(custom.id);
    const templatesAfterDelete = await fetchDischargeTemplates();
    expect(templatesAfterDelete.some((t) => t.id === custom.id)).toBe(false);
  });
});
