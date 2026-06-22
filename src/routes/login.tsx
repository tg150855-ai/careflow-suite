import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, Activity, Stethoscope } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BRAND, BrandLogo } from "@/components/brand";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Min 6 characters"),
});

export const Route = createFileRoute("/login")({
  component: LoginPage,
  beforeLoad: () => {
    // Allow login page even if authed (so users can switch accounts)
  },
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName || email },
          },
        });
        if (error) throw error;
        toast.success("Account created — signing you in...");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Sign in — SBG Arogya Plus</title>
        <meta name="description" content="Sign in to SBG Arogya Plus, the hospital management workspace for OPD, IPD, pharmacy, lab, and billing." />
        <link rel="canonical" href="https://cura-swift-care.lovable.app/login" />
        <meta property="og:title" content="Sign in — SBG Arogya Plus" />
        <meta property="og:description" content="Sign in to SBG Arogya Plus, the hospital management workspace for OPD, IPD, pharmacy, lab, and billing." />
        <meta property="og:url" content="https://cura-swift-care.lovable.app/login" />
      </Helmet>
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden text-primary-foreground"
           style={{ background: "linear-gradient(135deg, oklch(0.45 0.18 255), oklch(0.4 0.16 200), oklch(0.55 0.16 160))" }}>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white px-5 py-3 shadow-elevated">
            <BrandLogo size={72} />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-6 max-w-md"
        >
          <h1 className="text-4xl xl:text-5xl font-semibold leading-tight tracking-tight">
            Care, clarified.
          </h1>
          <p className="text-base opacity-80 leading-relaxed">
            {BRAND.name} — a single calm workspace for OPD, IPD, pharmacy, lab and billing, built for multi-specialty hospitals.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { icon: Stethoscope, label: "OPD in <2 min" },
              { icon: Activity, label: "Live insights" },
              { icon: ShieldCheck, label: "HIPAA-ready" },
            ].map((it, i) => (
              <motion.div
                key={it.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="rounded-2xl bg-white/10 backdrop-blur p-4"
              >
                <it.icon className="size-5 mb-2 opacity-90" />
                <div className="text-xs leading-tight opacity-90">{it.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="text-xs opacity-60">v1.0.0 · Support: +91 80000 00000</div>

        {/* decorative orbs */}
        <div className="pointer-events-none absolute -bottom-40 -right-32 size-[480px] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-32 -left-24 size-[320px] rounded-full bg-accent/30 blur-3xl" />
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center justify-center mb-8">
            <BrandLogo size={56} />
          </div>

          <h2 className="text-3xl font-semibold tracking-tight">Welcome to {BRAND.name}</h2>
          <p className="text-muted-foreground mt-1">Sign in to your hospital workspace.</p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={onSubmit} className="space-y-4">
                <Field id="email" label="Email" type="email" value={email} onChange={setEmail} placeholder="staff@hospital.com" />
                <Field id="password" label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
                <Button type="submit" size="lg" className="w-full h-11" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={onSubmit} className="space-y-4">
                <Field id="name" label="Full name" type="text" value={fullName} onChange={setFullName} placeholder="Dr. Anjali Sharma" />
                <Field id="email2" label="Email" type="email" value={email} onChange={setEmail} placeholder="staff@hospital.com" />
                <Field id="password2" label="Password" type="password" value={password} onChange={setPassword} placeholder="Min 6 characters" />
                <Button type="submit" size="lg" className="w-full h-11" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Create account
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  The first account becomes the hospital administrator.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-10 text-xs text-muted-foreground text-center">
            By continuing you agree to your hospital's data & privacy policy.
          </p>
        </motion.div>
      </div>
    </div>
    </>
  );
}

function Field({ id, label, type, value, onChange, placeholder }: {
  id: string; label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11" />
    </div>
  );
}
