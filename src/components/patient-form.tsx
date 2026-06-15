import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const optionalText = (max = 255) => z.string().trim().max(max).optional().or(z.literal(""));

export const patientFormSchema = z
  .object({
    full_name: z.string().trim().min(2, "Full name is required").max(160, "Name is too long"),
    mobile: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{10,18}$/, "Enter a valid mobile number"),
    email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
    gender: z.enum(["male", "female", "other"]),
    dob: optionalText(20),
    age: z.string().trim().optional().or(z.literal("")),
    blood_group: optionalText(8),
    address_line: optionalText(500),
    city: optionalText(120),
    state: optionalText(120),
    pincode: optionalText(20),
    aadhaar: optionalText(32),
    emergency_contact_name: optionalText(160),
    emergency_contact_mobile: optionalText(18),
    allergies: optionalText(1000),
    chronic_diseases: optionalText(1000),
    insurance_company_id: optionalText(64),
    insurance_policy_number: optionalText(120),
    coverage_limit: z.string().trim().optional().or(z.literal("")),
    insurance_valid_from: optionalText(20),
    insurance_valid_to: optionalText(20),
    authorization_number: optionalText(120),
  })
  .superRefine((value, ctx) => {
    if (value.age) {
      const age = Number(value.age);
      if (!Number.isFinite(age) || age < 0 || age > 125) {
        ctx.addIssue({ code: "custom", path: ["age"], message: "Enter age between 0 and 125" });
      }
    }
    if (value.coverage_limit) {
      const amount = Number(value.coverage_limit);
      if (!Number.isFinite(amount) || amount < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["coverage_limit"],
          message: "Enter a valid coverage amount",
        });
      }
    }
  });

export type PatientFormValues = z.infer<typeof patientFormSchema>;

export type InsuranceCompanyOption = {
  id: string;
  name: string;
  policy_type?: string | null;
};

export type PatientSubmission = {
  patient: Record<string, unknown>;
  insurance: Record<string, unknown> | null;
};

type PatientDefaultsSource = Partial<{
  full_name: string | null;
  mobile: string | null;
  email: string | null;
  gender: PatientFormValues["gender"] | null;
  dob: string | null;
  blood_group: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  aadhaar: string | null;
  emergency_contact_name: string | null;
  emergency_contact_mobile: string | null;
  allergies: string | null;
  chronic_diseases: string | null;
}>;

type InsuranceDefaultsSource = Partial<{
  company_id: string | null;
  policy_number: string | null;
  coverage_limit: string | number | null;
  valid_from: string | null;
  valid_to: string | null;
  authorization_number: string | null;
}>;

const EMPTY_VALUES: PatientFormValues = {
  full_name: "",
  mobile: "",
  email: "",
  gender: "male",
  dob: "",
  age: "",
  blood_group: "",
  address_line: "",
  city: "",
  state: "",
  pincode: "",
  aadhaar: "",
  emergency_contact_name: "",
  emergency_contact_mobile: "",
  allergies: "",
  chronic_diseases: "",
  insurance_company_id: "",
  insurance_policy_number: "",
  coverage_limit: "",
  insurance_valid_from: "",
  insurance_valid_to: "",
  authorization_number: "",
};

export function buildPatientSubmission(values: PatientFormValues): PatientSubmission {
  const n = (value?: string | null) => {
    const trimmed = (value ?? "").trim();
    return trimmed.length ? trimmed : null;
  };
  const ageNumber = values.age ? Number(values.age) : null;
  const derivedDob =
    !values.dob && ageNumber !== null && Number.isFinite(ageNumber)
      ? `${new Date().getFullYear() - ageNumber}-01-01`
      : values.dob;

  const patient = {
    full_name: values.full_name.trim(),
    mobile: values.mobile.trim(),
    email: n(values.email),
    gender: values.gender,
    dob: n(derivedDob),
    blood_group: n(values.blood_group),
    address_line: n(values.address_line),
    city: n(values.city),
    state: n(values.state),
    pincode: n(values.pincode),
    aadhaar: n(values.aadhaar),
    emergency_contact_name: n(values.emergency_contact_name),
    emergency_contact_mobile: n(values.emergency_contact_mobile),
    allergies: n(values.allergies),
    chronic_diseases: n(values.chronic_diseases),
  };

  const hasInsurance = !!(
    values.insurance_company_id ||
    values.insurance_policy_number ||
    values.coverage_limit ||
    values.authorization_number
  );
  const insurance = hasInsurance
    ? {
        company_id: n(values.insurance_company_id),
        policy_number: n(values.insurance_policy_number) ?? "Policy pending",
        coverage_limit: values.coverage_limit ? Number(values.coverage_limit) : 0,
        valid_from: n(values.insurance_valid_from),
        valid_to: n(values.insurance_valid_to),
        authorization_number: n(values.authorization_number),
        active: true,
      }
    : null;

  return { patient, insurance };
}

export function patientDefaults(
  patient?: PatientDefaultsSource | null,
  insurance?: InsuranceDefaultsSource | null,
): PatientFormValues {
  return {
    ...EMPTY_VALUES,
    full_name: patient?.full_name ?? "",
    mobile: patient?.mobile ?? "",
    email: patient?.email ?? "",
    gender: patient?.gender ?? "male",
    dob: patient?.dob ?? "",
    blood_group: patient?.blood_group ?? "",
    address_line: patient?.address_line ?? "",
    city: patient?.city ?? "",
    state: patient?.state ?? "",
    pincode: patient?.pincode ?? "",
    aadhaar: patient?.aadhaar ?? "",
    emergency_contact_name: patient?.emergency_contact_name ?? "",
    emergency_contact_mobile: patient?.emergency_contact_mobile ?? "",
    allergies: patient?.allergies ?? "",
    chronic_diseases: patient?.chronic_diseases ?? "",
    insurance_company_id: insurance?.company_id ?? "",
    insurance_policy_number: insurance?.policy_number ?? "",
    coverage_limit: insurance?.coverage_limit != null ? String(insurance.coverage_limit) : "",
    insurance_valid_from: insurance?.valid_from ?? "",
    insurance_valid_to: insurance?.valid_to ?? "",
    authorization_number: insurance?.authorization_number ?? "",
  };
}

export function PatientForm({
  initialPatient,
  initialInsurance,
  insuranceCompanies,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialPatient?: PatientDefaultsSource | null;
  initialInsurance?: InsuranceDefaultsSource | null;
  insuranceCompanies?: InsuranceCompanyOption[];
  submitLabel: string;
  onSubmit: (payload: PatientSubmission) => Promise<void>;
  onCancel?: () => void;
}) {
  const defaultValues = useMemo(
    () => patientDefaults(initialPatient, initialInsurance),
    [initialPatient, initialInsurance],
  );
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues,
    values: defaultValues,
  });

  async function submit(values: PatientFormValues) {
    await onSubmit(buildPatientSubmission(values));
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
      <Card className="p-6 space-y-5">
        <h2 className="font-semibold">Basic information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full name *" error={form.formState.errors.full_name?.message}>
            <Input {...form.register("full_name")} placeholder="Ramesh Kumar" />
          </Field>
          <Field label="Mobile number *" error={form.formState.errors.mobile?.message}>
            <Input {...form.register("mobile")} placeholder="+91 9876543210" />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} placeholder="optional" />
          </Field>
          <Field label="Gender *">
            <Select
              value={form.watch("gender")}
              onValueChange={(v) =>
                form.setValue("gender", v as PatientFormValues["gender"], { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date of birth">
            <Input type="date" {...form.register("dob")} />
          </Field>
          <Field label="Age" error={form.formState.errors.age?.message}>
            <Input
              type="number"
              min={0}
              max={125}
              {...form.register("age")}
              placeholder="Auto-derived if DOB is set"
            />
          </Field>
          <Field label="Blood group">
            <Select
              value={form.watch("blood_group") || "not-recorded"}
              onValueChange={(v) => form.setValue("blood_group", v === "not-recorded" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not-recorded">Not recorded</SelectItem>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <h2 className="font-semibold">Address & identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Address">
            <Input {...form.register("address_line")} />
          </Field>
          <Field label="City">
            <Input {...form.register("city")} />
          </Field>
          <Field label="State">
            <Input {...form.register("state")} />
          </Field>
          <Field label="Pincode">
            <Input {...form.register("pincode")} />
          </Field>
          <Field label="Aadhar / ID number">
            <Input {...form.register("aadhaar")} />
          </Field>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <h2 className="font-semibold">Emergency & medical</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Emergency contact name">
            <Input {...form.register("emergency_contact_name")} />
          </Field>
          <Field label="Emergency contact mobile">
            <Input {...form.register("emergency_contact_mobile")} />
          </Field>
          <Field label="Known allergies">
            <Textarea rows={2} {...form.register("allergies")} />
          </Field>
          <Field label="Chronic diseases">
            <Textarea rows={2} {...form.register("chronic_diseases")} />
          </Field>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <h2 className="font-semibold">Insurance details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Insurance company">
            <Select
              value={form.watch("insurance_company_id") || "none"}
              onValueChange={(v) => form.setValue("insurance_company_id", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No insurance company</SelectItem>
                {(insuranceCompanies ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.policy_type ? ` · ${c.policy_type}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Policy / member number">
            <Input {...form.register("insurance_policy_number")} />
          </Field>
          <Field label="Coverage limit (₹)" error={form.formState.errors.coverage_limit?.message}>
            <Input type="number" min={0} {...form.register("coverage_limit")} />
          </Field>
          <Field label="Authorization number">
            <Input {...form.register("authorization_number")} />
          </Field>
          <Field label="Valid from">
            <Input type="date" {...form.register("insurance_valid_from")} />
          </Field>
          <Field label="Valid to">
            <Input type="date" {...form.register("insurance_valid_to")} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-3 sticky bottom-0 bg-background py-4">
        {onCancel && (
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
