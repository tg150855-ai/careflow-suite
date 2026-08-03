import { describe, expect, it } from "vitest";
import { asUser, hasDb, sql, STRANGER_UID, userWithRole } from "./db";

/**
 * Automated RBAC access tests.
 *
 * These run against the live database through the `authenticated` role with a
 * simulated auth.uid(), so they verify the actual RLS policies (not a mirror
 * of them). Every statement runs inside a transaction that is rolled back.
 */
const d = hasDb ? describe : describe.skip;

const HR_ROLES = ["admin", "super_admin", "hr_manager"];
const NON_HR_ROLES = ["receptionist", "doctor", "nurse", "pharmacist", "lab_tech", "accountant"];

function count(rows: string[]): number {
  return Number(rows[0] ?? "0");
}

d("RLS: employee data is HR/admin only", () => {
  const total = count(sql("SELECT count(*) FROM public.employees"));

  it("has employee rows to test against", () => {
    expect(total).toBeGreaterThan(0);
  });

  for (const role of HR_ROLES) {
    const uid = userWithRole(role);
    const t = uid ? it : it.skip;
    t(`allows ${role} to read employees`, () => {
      const rows = asUser(uid!, "SELECT count(*) FROM public.employees;");
      expect(count(rows)).toBe(total);
    });
    t(`allows ${role} to read employee_documents`, () => {
      expect(() => asUser(uid!, "SELECT count(*) FROM public.employee_documents;")).not.toThrow();
    });
  }

  for (const role of NON_HR_ROLES) {
    const uid = userWithRole(role);
    const t = uid ? it : it.skip;
    t(`blocks ${role} from reading employees`, () => {
      expect(count(asUser(uid!, "SELECT count(*) FROM public.employees;"))).toBe(0);
    });
    t(`blocks ${role} from reading employee_documents`, () => {
      expect(count(asUser(uid!, "SELECT count(*) FROM public.employee_documents;"))).toBe(0);
    });
    t(`blocks ${role} from writing employees`, () => {
      const rows = asUser(
        uid!,
        `SELECT count(*) FROM (
           INSERT INTO public.employees (full_name, department)
           VALUES ('RBAC Test', 'Nursing') RETURNING 1
         ) x;`,
      );
      expect(rows.join("")).toBe("");
    }, 15_000);
  }

  it("blocks a signed-in user with no role at all", () => {
    expect(count(asUser(STRANGER_UID, "SELECT count(*) FROM public.employees;"))).toBe(0);
    expect(count(asUser(STRANGER_UID, "SELECT count(*) FROM public.employee_documents;"))).toBe(0);
  });
});

d("RLS: notifications reach only their targeted staff role", () => {
  // Seed one notification per interesting target inside the rolled-back txn.
  const seed = `
    INSERT INTO public.notifications (title, category, target_role) VALUES
      ('to-receptionist', 'test', 'receptionist'),
      ('to-doctor', 'test', 'doctor'),
      ('to-patient', 'test', 'patient');
  `;

  const reception = userWithRole("receptionist");
  const admin = userWithRole("admin");
  const rt = reception ? it : it.skip;
  const at = admin ? it : it.skip;

  rt("delivers role-targeted notifications to matching staff", () => {
    const rows = asUser(
      reception!,
      "SELECT title FROM public.notifications WHERE category = 'test' ORDER BY title;",
      seed,
    );
    expect(rows).toEqual(["to-receptionist"]);
  });

  rt("does not leak other roles' or patient notifications", () => {
    const rows = asUser(
      reception!,
      "SELECT title FROM public.notifications WHERE category = 'test';",
      seed,
    );
    expect(rows).not.toContain("to-doctor");
    expect(rows).not.toContain("to-patient");
  });

  at("lets admin see role-targeted notifications", () => {
    const rows = asUser(
      admin!,
      "SELECT count(*) FROM public.notifications WHERE category = 'test';",
      seed,
    );
    expect(count(rows)).toBe(3);
  });

  it("hides role-targeted notifications from users without that role", () => {
    const rows = asUser(
      STRANGER_UID,
      "SELECT count(*) FROM public.notifications WHERE category = 'test';",
      seed,
    );
    expect(count(rows)).toBe(0);
  });

  it("delivers a personally addressed notification to its owner only", () => {
    const target = reception ?? STRANGER_UID;
    const personal = `INSERT INTO public.notifications (title, category, user_id)
                      VALUES ('personal', 'test2', '${target}');`;
    expect(
      count(
        asUser(
          target,
          "SELECT count(*) FROM public.notifications WHERE category = 'test2';",
          personal,
        ),
      ),
    ).toBe(1);
    expect(
      count(
        asUser(
          STRANGER_UID,
          "SELECT count(*) FROM public.notifications WHERE category = 'test2';",
          personal,
        ),
      ),
    ).toBe(0);
  });
});
