import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

const schema = z.object({
  full_name: z.string().min(2, "Required"),
  mobile: z.string().min(10, "Min 10 digits").max(15),
  email: z.string().email().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]),
  dob: z.string().optional(),
  blood_group: z.string().optional(),
  address_line: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  aadhaar: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_mobile: z.string().optional(),
  allergies: z.string().optional(),
  chronic_diseases: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/_authenticated/patients/new")({ component: NewPatient });

function NewPatient() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { gender: "male" },
  });

  async function onSubmit(values: FormValues) {
    const payload = { ...values, email: values.email || null, created_by: user?.id };
    const { data, error } = await supabase.from("patients").insert(payload).select("id, uhid").single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Patient registered · ${data.uhid}`);
    navigate({ to: "/patients/$id", params: { id: data.id } });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/patients"><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New patient registration</h1>
          <p className="text-sm text-muted-foreground">UHID is generated automatically.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <Card className="p-6 space-y-5">
          <h2 className="font-semibold">Basic information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full name *" error={form.formState.errors.full_name?.message}>
              <Input {...form.register("full_name")} placeholder="Ramesh Kumar" />
            </Field>
            <Field label="Mobile *" error={form.formState.errors.mobile?.message}>
              <Input {...form.register("mobile")} placeholder="+91 9876543210" />
            </Field>
            <Field label="Email">
              <Input type="email" {...form.register("email")} placeholder="optional" />
            </Field>
            <Field label="Gender *">
              <Select value={form.watch("gender")} onValueChange={(v) => form.setValue("gender", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date of birth"><Input type="date" {...form.register("dob")} /></Field>
            <Field label="Blood group">
              <Select value={form.watch("blood_group")} onValueChange={(v) => form.setValue("blood_group", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="font-semibold">Address & identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Address"><Input {...form.register("address_line")} /></Field>
            <Field label="City"><Input {...form.register("city")} /></Field>
            <Field label="State"><Input {...form.register("state")} /></Field>
            <Field label="Pincode"><Input {...form.register("pincode")} /></Field>
            <Field label="Aadhaar number"><Input {...form.register("aadhaar")} /></Field>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="font-semibold">Emergency & medical</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Emergency contact name"><Input {...form.register("emergency_contact_name")} /></Field>
            <Field label="Emergency contact mobile"><Input {...form.register("emergency_contact_mobile")} /></Field>
            <Field label="Known allergies"><Textarea rows={2} {...form.register("allergies")} /></Field>
            <Field label="Chronic diseases"><Textarea rows={2} {...form.register("chronic_diseases")} /></Field>
          </div>
        </Card>

        <div className="flex justify-end gap-3 sticky bottom-0 bg-background py-4">
          <Button asChild variant="ghost" type="button"><Link to="/patients">Cancel</Link></Button>
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
            Register patient
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
