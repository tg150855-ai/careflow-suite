import { describe, expect, it } from "vitest";
import { evalPolicy, hasDb, policyExpr, sql, STRANGER_UID, userWithRole } from "./db";

/**
 * Automated RBAC access tests against the live row-level-security policies.
 *
 * The predicates are read from the catalog at run time (never hard-coded), so
 * these tests fail the moment a policy is loosened. Nothing is written to the
 * database.
 */
const d = hasDb ? describe : describe.skip;

const HR_ROLES = ["admin", "super_admin", "hr_manager"];
const NON_HR_ROLES = ["receptionist", "doctor", "nurse", "pharmacist", "lab_tech", "accountant"];

/** Resolve a real user for `role`; fall back to a scratch id we grant the role to. */
function uidFor(role: string): { uid: string; real: boolean } {
  const real = userWithRole(role);
  return real ? { uid: real, real: true } : { uid: STRANGER_UID, real: false };
}

d("RLS: employee data is readable by HR/admin only", () => {
  const read = policyExpr("employees", "SELECT");
  const write = policyExpr("employees", "INSERT");
  const docsRead = policyExpr("employee_documents", "SELECT");

  it("employees + employee_documents are never exposed to anonymous visitors", () => {
    expect(read.roles).not.toContain("anon");
    expect(read.roles).not.toContain("public");
    expect(docsRead.roles).not.toContain("anon");
    expect(docsRead.roles).not.toContain("public");
    expect(read.roles).toContain("authenticated");
  });

  it("row-level security is enabled on both tables", () => {
    const rows = sql(
      "SELECT relname || '=' || relrowsecurity FROM pg_class WHERE relname IN ('employees','employee_documents')",
    );
    expect(rows.sort()).toEqual(["employee_documents=true", "employees=true"]);
  });

  for (const role of HR_ROLES) {
    const { uid, real } = uidFor(role);
    const t = real ? it : it.skip;
    t(`allows ${role} to read employees and documents`, () => {
      expect(evalPolicy(read.expr, uid)).toBe(true);
      expect(evalPolicy(docsRead.expr, uid)).toBe(true);
    });
  }

  for (const role of NON_HR_ROLES) {
    const { uid, real } = uidFor(role);
    const t = real ? it : it.skip;
    t(`blocks ${role} from reading employees and documents`, () => {
      expect(evalPolicy(read.expr, uid)).toBe(false);
      expect(evalPolicy(docsRead.expr, uid)).toBe(false);
    });
    t(`blocks ${role} from writing employees`, () => {
      expect(evalPolicy(write.expr, uid)).toBe(false);
    });
  }

  it("blocks a signed-in user holding no role at all", () => {
    expect(evalPolicy(read.expr, STRANGER_UID)).toBe(false);
    expect(evalPolicy(docsRead.expr, STRANGER_UID)).toBe(false);
    expect(evalPolicy(write.expr, STRANGER_UID)).toBe(false);
  });
});

d("RLS: notifications reach only their targeted staff role", () => {
  const read = policyExpr("notifications", "SELECT");

  /** Synthetic notification row the predicate is evaluated against. */
  function row(opts: { targetRole?: string | null; userId?: string | null }) {
    const target = opts.targetRole ? `'${opts.targetRole}'::app_role` : "null::app_role";
    const user = opts.userId ? `'${opts.userId}'::uuid` : "null::uuid";
    return `FROM (VALUES (${target}, ${user})) AS notifications(target_role, user_id)`;
  }

  it("is not readable by anonymous visitors", () => {
    expect(read.roles).not.toContain("anon");
    expect(read.roles).not.toContain("public");
  });

  const reception = userWithRole("receptionist");
  const admin = userWithRole("admin");
  const rt = reception ? it : it.skip;
  const at = admin ? it : it.skip;

  rt("delivers a role-targeted notification to staff holding that role", () => {
    expect(evalPolicy(read.expr, reception!, row({ targetRole: "receptionist" }))).toBe(true);
  });

  rt("hides notifications targeted at a different role", () => {
    for (const other of ["doctor", "nurse", "pharmacist", "hr_manager"]) {
      expect(evalPolicy(read.expr, reception!, row({ targetRole: other }))).toBe(false);
    }
  });

  rt("never broadcasts patient-targeted notifications to staff", () => {
    expect(evalPolicy(read.expr, reception!, row({ targetRole: "patient" }))).toBe(false);
  });

  rt("hides another user's personally addressed notification", () => {
    expect(evalPolicy(read.expr, reception!, row({ userId: STRANGER_UID }))).toBe(false);
  });

  rt("delivers a personally addressed notification to its owner", () => {
    expect(evalPolicy(read.expr, reception!, row({ userId: reception! }))).toBe(true);
  });

  at("lets admin oversee role-targeted notifications", () => {
    expect(evalPolicy(read.expr, admin!, row({ targetRole: "doctor" }))).toBe(true);
  });

  it("hides role-targeted notifications from users with no role", () => {
    for (const target of ["receptionist", "doctor", "patient"]) {
      expect(evalPolicy(read.expr, STRANGER_UID, row({ targetRole: target }))).toBe(false);
    }
  });

  it("hides untargeted notifications from everyone but admins", () => {
    expect(evalPolicy(read.expr, STRANGER_UID, row({}))).toBe(false);
  });
});
