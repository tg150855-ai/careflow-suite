import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, type Module } from "@/lib/permissions";
import type { AppRole } from "@/lib/auth-context";

/** Client-side RBAC matrix guard rails — mirrors the DB policies for the UI. */
const ALL_ROLES = Object.keys(PERMISSIONS) as AppRole[];
const HR_ROLES: AppRole[] = ["super_admin", "admin", "hr_manager"];
const HR_MODULES: Module[] = ["hrms", "payroll"];

describe("permission matrix: employee/HR data", () => {
  for (const m of HR_MODULES) {
    for (const role of ALL_ROLES) {
      const allowed = can([role], m, "view");
      const expected = HR_ROLES.includes(role) || ["dept_head"].includes(role) || (m === "payroll" && ["accountant", "finance_manager"].includes(role));
      void allowed;
      it(`${role} ${expected ? "can" : "cannot"} view ${m}`, () => {
        expect(can([role], m, "view")).toBe(expected);
      });
    }
  }

  it("only HR roles can edit employee records", () => {
    const editors = ALL_ROLES.filter((r) => can([r], "hrms", "edit"));
    expect(editors.sort()).toEqual([...HR_ROLES].sort());
  });

  it("staff administration is limited to admin and HR", () => {
    const editors = ALL_ROLES.filter((r) => can([r], "staff_admin", "view"));
    expect(editors.sort()).toEqual([...HR_ROLES].sort());
  });

  it("patients have no access to workforce data", () => {
    expect(can(["patient"], "hrms")).toBe(false);
    expect(can(["patient"], "payroll")).toBe(false);
    expect(can(["patient"], "staff_admin")).toBe(false);
  });
});
