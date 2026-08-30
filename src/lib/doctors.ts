import { supabase } from "@/integrations/supabase/client";

export interface DoctorItem {
  id: string;
  name: string;
  specialization?: string | null;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
  consultation_fee?: number | null;
  active?: boolean;
  employee_no?: string | null;
  hospital_id?: string | null;
}

/**
 * Cleanly format doctor display label for all dropdowns and badges
 * e.g. "DR Rayhan Shaikh (EMP-01006 · Doctors)" or "Dr. Sham (Cardiology)"
 */
export function formatDoctorLabel(doc: {
  name?: string | null;
  specialization?: string | null;
  employee_no?: string | null;
  department?: string | null;
}): string {
  const name = (doc.name ?? "Doctor").trim();
  const subParts: string[] = [];
  if (doc.employee_no) subParts.push(doc.employee_no);
  if (doc.specialization) subParts.push(doc.specialization);
  else if (doc.department && doc.department.toLowerCase() !== "doctors") subParts.push(doc.department);

  return subParts.length > 0 ? `${name} (${subParts.join(" · ")})` : name;
}

/**
 * Fetches all doctors from both `doctors` and `employees` tables,
 * ensuring doctors added via HR / Staff are immediately synced and visible in OPD, IPD, and OT.
 */
export async function fetchUnifiedDoctors(hospitalId?: string | null): Promise<DoctorItem[]> {
  try {
    // 1. Fetch doctors table
    let docQuery = (supabase as any)
      .from("doctors")
      .select("id, name, specialization, phone, email, consultation_fee, active, hospital_id")
      .order("name");
    if (hospitalId) docQuery = docQuery.eq("hospital_id", hospitalId);
    const { data: dbDocs = [] } = await docQuery;

    // 2. Fetch doctor employees from HR
    let empQuery = (supabase as any)
      .from("employees")
      .select("id, employee_no, full_name, department, designation, phone, email, status, hospital_id")
      .or("department.ilike.%doctor%,designation.ilike.%doctor%,full_name.ilike.dr %,full_name.ilike.dr.%");
    if (hospitalId) empQuery = empQuery.eq("hospital_id", hospitalId);
    const { data: dbEmps = [] } = await empQuery;

    const list: DoctorItem[] = [];
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();

    // Add existing from doctors table
    for (const d of dbDocs ?? []) {
      if (d.active === false) continue;
      seenIds.add(d.id);
      seenNames.add((d.name ?? "").toLowerCase().trim());
      list.push({
        id: d.id,
        name: d.name,
        specialization: d.specialization ?? "General Medicine",
        department: "OPD / Doctors",
        phone: d.phone,
        email: d.email,
        consultation_fee: d.consultation_fee ?? 0,
        active: d.active ?? true,
        hospital_id: d.hospital_id,
      });
    }

    // Auto-sync & merge HR employees with Doctor department / designation
    for (const emp of dbEmps ?? []) {
      if (emp.status === "inactive" || emp.status === "disabled") continue;
      const cleanName = (emp.full_name ?? "").toLowerCase().trim();
      
      // Match by ID or Name
      const existing = list.find(
        (d) => d.id === emp.id || d.name.toLowerCase().trim() === cleanName
      );

      if (existing) {
        if (emp.employee_no && !existing.employee_no) {
          existing.employee_no = emp.employee_no;
        }
        if (emp.designation && !existing.specialization) {
          existing.specialization = emp.designation;
        }
      } else {
        // Automatically insert into doctors table so FKs and OPD appointment selections are valid
        let targetId = emp.id;
        try {
          const { data: insertedDoc } = await (supabase as any)
            .from("doctors")
            .insert({
              id: emp.id,
              name: emp.full_name,
              specialization: emp.designation ?? "General Medicine",
              phone: emp.phone,
              email: emp.email,
              active: true,
              ...(hospitalId ? { hospital_id: hospitalId } : emp.hospital_id ? { hospital_id: emp.hospital_id } : {}),
            })
            .select("id")
            .maybeSingle();
          if (insertedDoc?.id) targetId = insertedDoc.id;
        } catch {
          // If inserting with specific id fails, try without id
          try {
            const { data: fallbackDoc } = await (supabase as any)
              .from("doctors")
              .insert({
                name: emp.full_name,
                specialization: emp.designation ?? "General Medicine",
                phone: emp.phone,
                email: emp.email,
                active: true,
                ...(hospitalId ? { hospital_id: hospitalId } : {}),
              })
              .select("id")
              .maybeSingle();
            if (fallbackDoc?.id) targetId = fallbackDoc.id;
          } catch {}
        }

        seenIds.add(targetId);
        seenNames.add(cleanName);
        list.push({
          id: targetId,
          name: emp.full_name,
          specialization: emp.designation ?? "General Medicine",
          department: emp.department ?? "Doctors",
          phone: emp.phone,
          email: emp.email,
          employee_no: emp.employee_no,
          active: true,
          hospital_id: emp.hospital_id ?? hospitalId,
        });
      }
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("[fetchUnifiedDoctors] error", err);
    return [];
  }
}

/**
 * Synchronizes an employee to the `doctors` table if their department/designation is Doctor
 */
export async function syncEmployeeToDoctor(emp: {
  id?: string;
  full_name: string;
  department?: string | null;
  designation?: string | null;
  phone?: string | null;
  email?: string | null;
  hospital_id?: string | null;
}) {
  const isDoctor =
    emp.department?.toLowerCase() === "doctors" ||
    emp.designation?.toLowerCase().includes("doctor") ||
    emp.full_name?.toLowerCase().startsWith("dr ") ||
    emp.full_name?.toLowerCase().startsWith("dr.");

  if (!isDoctor) return;

  try {
    const payload = {
      name: emp.full_name,
      specialization: emp.designation ?? "General Medicine",
      phone: emp.phone ?? null,
      email: emp.email ?? null,
      active: true,
      ...(emp.hospital_id ? { hospital_id: emp.hospital_id } : {}),
    };

    // Check if exists
    const { data: existing } = await (supabase as any)
      .from("doctors")
      .select("id")
      .or(`name.eq."${emp.full_name}",id.eq."${emp.id}"`)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await (supabase as any).from("doctors").update(payload).eq("id", existing.id);
    } else {
      await (supabase as any).from("doctors").insert({
        ...(emp.id ? { id: emp.id } : {}),
        ...payload,
      });
    }
  } catch (err) {
    console.warn("[syncEmployeeToDoctor] sync warning", err);
  }
}
