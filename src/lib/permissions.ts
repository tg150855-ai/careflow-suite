// Centralized Role → Module/Action permission matrix for SBG Arogya Plus.
// Single source of truth used by the sidebar, route guards, and the
// Authority Matrix visualization. Edit here to change access globally.

import type { AppRole } from "@/lib/auth-context";

export type Action = "view" | "create" | "edit" | "delete" | "approve";

/** Logical modules used across the platform. Keep stable — UI references these keys. */
export const MODULES = [
  "dashboard",
  "patients",
  "appointments",
  "opd",
  "ipd",
  "ot",
  "emergency",
  "nurse_station",
  "pharmacy",
  "laboratory",
  "radiology",
  "pacs",
  "blood_bank",
  "dialysis",
  "icu",
  "billing",
  "insurance",
  "finance",
  "accounts",
  "ambulance",
  "hrms",
  "payroll",
  "inventory",
  "procurement",
  "assets",
  "reports",
  "bi",
  "branches",
  "audit",
  "backups",
  "settings",
  "staff_admin",
  "telemedicine",
  "patient_portal",
  "ai_assistant",
  "whatsapp",
  "crm",
  "emr",
  "ehr",
  "compliance",
  "research",
  "smart_os",
  "iot",
  "security_center",
] as const;
export type Module = (typeof MODULES)[number];

type RolePerms = Partial<Record<Module, Action[]>>;

const ALL: Action[] = ["view", "create", "edit", "delete", "approve"];
const RW: Action[] = ["view", "create", "edit"];
const RO: Action[] = ["view"];

/** Role → module → allowed actions. Missing entry = no access. */
export const PERMISSIONS: Record<AppRole, RolePerms> = {
  super_admin: Object.fromEntries(MODULES.map((m) => [m, ALL])) as RolePerms,

  admin: {
    dashboard: RO, patients: RW, appointments: RW, opd: RW, ipd: RW, ot: RW,
    emergency: RW, nurse_station: RO, pharmacy: RW, laboratory: RW,
    radiology: RW, pacs: RO, blood_bank: RW, dialysis: RW, icu: RW,
    billing: RW, insurance: RW, finance: RO, accounts: RO, ambulance: RW,
    hrms: RW, payroll: RO, inventory: RW, procurement: RW, assets: RW,
    reports: RO, bi: RO, branches: RW, audit: RO, backups: RO,
    settings: RW, staff_admin: RW, telemedicine: RO, patient_portal: RO,
    ai_assistant: RO, whatsapp: RW, crm: RW, emr: RO, ehr: RO,
    compliance: RW, research: RO, smart_os: RO, iot: RO, security_center: RO,
  },

  doctor: {
    dashboard: RO, patients: RW, appointments: RW, opd: RW, ipd: RW,
    emergency: RW, pharmacy: RO, laboratory: RW, radiology: RW, pacs: RO,
    icu: RW, telemedicine: RW, ai_assistant: RO, emr: RW, ehr: RO,
    crm: RO, blood_bank: ["view", "create"],
  },

  surgeon: {
    dashboard: RO, patients: RW, opd: RW, ipd: RW, ot: [...RW, "approve"],
    emergency: RW, icu: RW, laboratory: RW, radiology: RW, pacs: RO,
    emr: RW, ai_assistant: RO,
  },

  nurse: {
    dashboard: RO, patients: RO, ipd: RW, nurse_station: RW, opd: RO,
    emergency: RW, icu: RW, pharmacy: RO, laboratory: RO,
  },

  receptionist: {
    dashboard: RO, patients: RW, appointments: RW, opd: ["view", "create"],
    billing: ["view", "create"], emergency: ["view", "create"],
    ambulance: ["view", "create"],
  },

  pharmacist: {
    dashboard: RO, pharmacy: ALL, inventory: RW, procurement: RW,
    patients: RO,
  },

  lab_tech: {
    dashboard: RO, laboratory: RW, patients: RO,
  },

  accountant: {
    dashboard: RO, billing: RW, finance: RW, accounts: RW, insurance: RO,
    reports: RO, payroll: RO,
  },

  finance_manager: {
    dashboard: RO, billing: RO, finance: [...ALL], accounts: ALL,
    reports: RO, bi: RO, payroll: RO, procurement: RO,
  },

  insurance_officer: {
    dashboard: RO, insurance: ALL, billing: RO, patients: RO, ipd: RO,
  },

  ot_coordinator: {
    dashboard: RO, ot: RW, ipd: RO, patients: RO,
  },

  ambulance_driver: {
    dashboard: RO, ambulance: RW, emergency: RO,
  },

  hr_manager: {
    dashboard: RO, hrms: ALL, payroll: ALL, staff_admin: RW, reports: RO,
  },

  dept_head: {
    dashboard: RO, patients: RO, opd: RO, ipd: RO, reports: RO, bi: RO,
    compliance: RO, hrms: RO,
  },

  procurement_officer: {
    dashboard: RO, procurement: ALL, inventory: RW, assets: RO, reports: RO,
  },

  patient: {
    patient_portal: RW, appointments: ["view", "create"], telemedicine: RW,
    billing: RO,
  },
};

export function can(roles: AppRole[], module: Module, action: Action = "view"): boolean {
  return roles.some((r) => PERMISSIONS[r]?.[module]?.includes(action));
}

/** Human-readable labels for the Authority Matrix UI. */
export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Hospital Admin",
  doctor: "Doctor",
  surgeon: "Surgeon / Senior Consultant",
  nurse: "Nurse",
  receptionist: "Receptionist",
  pharmacist: "Pharmacist",
  lab_tech: "Lab Technician",
  accountant: "Accountant",
  finance_manager: "Finance Manager",
  insurance_officer: "Insurance Officer",
  ot_coordinator: "OT Coordinator",
  ambulance_driver: "Ambulance Driver",
  hr_manager: "HR Manager",
  dept_head: "Department Head / Director",
  procurement_officer: "Procurement Officer",
  patient: "Patient",
};

export const MODULE_LABELS: Record<Module, string> = {
  dashboard: "Dashboard", patients: "Patients", appointments: "Appointments",
  opd: "OPD", ipd: "IPD", ot: "OT / Surgery", emergency: "Emergency",
  nurse_station: "Nurse Station", pharmacy: "Pharmacy", laboratory: "Laboratory",
  radiology: "Radiology", pacs: "PACS", blood_bank: "Blood Bank",
  dialysis: "Dialysis", icu: "ICU", billing: "Billing", insurance: "Insurance",
  finance: "Finance", accounts: "Accounts", ambulance: "Ambulance",
  hrms: "HRMS", payroll: "Payroll", inventory: "Inventory",
  procurement: "Procurement", assets: "Assets", reports: "Reports",
  bi: "BI Dashboard", branches: "Branches", audit: "Audit",
  backups: "Backups", settings: "Settings", staff_admin: "Staff Admin",
  telemedicine: "Telemedicine", patient_portal: "Patient Portal",
  ai_assistant: "AI Assistant", whatsapp: "WhatsApp", crm: "CRM",
  emr: "EMR", ehr: "EHR", compliance: "Compliance", research: "Research",
  smart_os: "Smart OS", iot: "IoT Devices", security_center: "Security Center",
};

/** Patient & operational workflows for the Authority page visualization. */
export const WORKFLOWS: { title: string; steps: { label: string; owner: AppRole[] }[] }[] = [
  {
    title: "OPD Patient Journey",
    steps: [
      { label: "Patient Registration", owner: ["receptionist"] },
      { label: "Appointment & Token", owner: ["receptionist"] },
      { label: "Doctor Consultation", owner: ["doctor"] },
      { label: "Lab / Radiology Orders", owner: ["doctor"] },
      { label: "Sample / Scan", owner: ["lab_tech"] },
      { label: "Prescription", owner: ["doctor"] },
      { label: "Billing", owner: ["accountant", "receptionist"] },
      { label: "Pharmacy Dispense", owner: ["pharmacist"] },
      { label: "Follow-up Scheduling", owner: ["receptionist"] },
    ],
  },
  {
    title: "IPD Admission Journey",
    steps: [
      { label: "Admission Recommendation", owner: ["doctor"] },
      { label: "Bed Allocation", owner: ["admin", "nurse"] },
      { label: "Nursing Care & Vitals", owner: ["nurse"] },
      { label: "Doctor Rounds", owner: ["doctor"] },
      { label: "Investigations", owner: ["lab_tech"] },
      { label: "OT / Surgery (optional)", owner: ["surgeon", "ot_coordinator"] },
      { label: "Insurance Claim", owner: ["insurance_officer"] },
      { label: "Discharge Summary", owner: ["doctor"] },
      { label: "Final Billing", owner: ["accountant"] },
    ],
  },
  {
    title: "Emergency Workflow",
    steps: [
      { label: "Ambulance Dispatch", owner: ["ambulance_driver", "receptionist"] },
      { label: "Triage", owner: ["nurse", "doctor"] },
      { label: "Resuscitation / Stabilize", owner: ["doctor", "nurse"] },
      { label: "ICU / IPD Transfer", owner: ["doctor", "admin"] },
    ],
  },
];
