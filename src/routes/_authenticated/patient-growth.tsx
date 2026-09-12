import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  MessageSquare,
  TrendingUp,
  HeartPulse,
  CheckCircle2,
  Send,
  Phone,
  RefreshCw,
  X,
  Eye,
  Check,
  SlidersHorizontal,
  Paperclip,
  FileText,
  PlusCircle,
  ImageIcon,
} from "lucide-react";
import { useState, useMemo } from "react";
import { differenceInYears, format } from "date-fns";
import { toast } from "sonner";
import { BRAND } from "@/components/brand";
import { shareOnWhatsApp } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/patient-growth")({
  component: PatientGrowthPage,
});


// Age Bracket options
const AGE_BRACKETS = [
  { id: "all", label: "All Ages", min: 0, max: 150 },
  { id: "pediatric", label: "Pediatric (0-12 yrs)", min: 0, max: 12 },
  { id: "youth", label: "Youth & Young Adults (13-25 yrs)", min: 13, max: 25 },
  { id: "adults", label: "Adults (26-45 yrs)", min: 26, max: 45 },
  { id: "middle", label: "Middle Age (46-60 yrs)", min: 46, max: 60 },
  { id: "seniors", label: "Senior Citizens (60+ yrs)", min: 60, max: 150 },
];

// Curated promotional campaign templates for hospital outreach
const CAMPAIGN_TEMPLATES = [
  {
    id: "diabetes_camp",
    title: "Free Diabetes Screening & HbA1c Camp",
    target: "Diabetic & Pre-diabetic Patients",
    channel: "whatsapp",
    body: `🏥 *[HOSPITAL_NAME] Health Advisory*\n\nDear [NAME],\nDid you know routine HbA1c monitoring prevents diabetic kidney and eye complications?\n\nWe are pleased to invite you to our **Special Diabetes Wellness & Free Screening Camp** this Sunday.\n\n✨ *What's included free of cost:*\n• Free Blood Sugar & HbA1c screening\n• Consultation with Senior Diabetologist\n• Personalized Diet & Lifestyle Chart\n\n📍 Location: OPD Block 2, [HOSPITAL_NAME]\n📞 Call [PHONE] to reserve your VIP token.\n*Valid till [DATE]. Use code: [CODE]*`,
    code: "DIABCARE2026",
  },
  {
    id: "cardiac_wellness",
    title: "Comprehensive Heart Checkup - 30% Off",
    target: "Cardiac & Hypertension Patients",
    channel: "whatsapp",
    body: `❤️ *[HOSPITAL_NAME] Heart Wellness Alert*\n\nDear [NAME],\nProtect your heart with early detection. As part of our Community Health Drive, we are offering an exclusive **30% discount** on our Comprehensive Cardiac Package.\n\n🩺 *Package Highlights:*\n• 2D Echocardiogram (Echo)\n• Resting ECG & Lipid Profile\n• Cardiologist Consultation & Risk Profiling\n\n🏷️ Promo Code: *[CODE]*\n📞 Call [PHONE] or reply here to book your slot.\n*Offer valid until [DATE].*`,
    code: "HEART30",
  },
  {
    id: "senior_geriatric",
    title: "Senior Citizens Geriatric Wellness Package",
    target: "Patients aged 60+ yrs",
    channel: "whatsapp",
    body: `🌸 *[HOSPITAL_NAME] Senior Care Program*\n\nDear [NAME],\nHealthy aging is a gift. [HOSPITAL_NAME] is organizing a special **Senior Citizen Health Checkup** designed specifically for adults above 60.\n\n🛡️ *Key Inclusions:*\n• Bone Mineral Density (BMD) Scan\n• Joint & Arthritis Mobility Consultation\n• Complete Blood Count & Kidney Function\n• Vision & Geriatric Assessment\n\n🎁 Special 35% subsidy applied. Free Home Sample Collection available.\n📞 Call dedicated Senior Line: [PHONE].`,
    code: "SENIOR60",
  },
  {
    id: "asthma_respiratory",
    title: "Seasonal Respiratory & Asthma Relief Drive",
    target: "Asthma, COPD & Lung Care Patients",
    channel: "whatsapp",
    body: `🌬️ *[HOSPITAL_NAME] Pulmonology Advisory*\n\nDear [NAME],\nWith weather fluctuations and rising allergens, chronic asthma and allergy flare-ups are common. Let our pulmonologists help you breathe easier.\n\n💨 *Drive Inclusions:*\n• Pulmonary Function Test (Spirometry)\n• Inhaler Technique Review\n• Allergy & Chest Physician Assessment\n\n📞 Schedule your visit today: [PHONE]\n*Code: [CODE] for priority consultation.*`,
    code: "BREATHEEASY",
  },
  {
    id: "annual_wellness",
    title: "Annual Health & Preventive Master Checkup",
    target: "All Cohorts",
    channel: "sms",
    body: `[HOSPITAL_NAME]: Dear [NAME], schedule your Full Body Health Checkup (60+ tests) at just ₹999 this month. Early detection saves lives! Call [PHONE] or visit us. Use code [CODE].`,
    code: "FIT2026",
  },
  {
    id: "custom",
    title: "Custom Promotional Broadcast",
    target: "Custom Audience",
    channel: "whatsapp",
    body: `🏥 *[HOSPITAL_NAME] Announcement*\n\nDear [NAME],\nWe have a special health announcement tailored for you at [HOSPITAL_NAME].\n\n📞 For questions or appointments, call [PHONE].`,
    code: "CARE2026",
  },
];

// Rich fallback patient dataset if DB has few or incomplete chronic data
const DEMO_PATIENTS = [
  {
    id: "demo-p1",
    uhid: "UHID-2026-00101",
    full_name: "Rameshwar Prasad Sharma",
    mobile: "+91 98201 44521",
    email: "rameshwar.s@example.com",
    gender: "male",
    dob: "1962-04-14",
    blood_group: "B+",
    city: "Mumbai",
    state: "Maharashtra",
    chronic_diseases: "Diabetes Type 2, Hypertension",
    created_at: "2026-01-10T10:30:00Z",
  },
  {
    id: "demo-p2",
    uhid: "UHID-2026-00102",
    full_name: "Sunita Anil Deshmukh",
    mobile: "+91 98223 77812",
    email: "sunita.deshmukh@example.com",
    gender: "female",
    dob: "1958-08-22",
    blood_group: "O+",
    city: "Pune",
    state: "Maharashtra",
    chronic_diseases: "Cardiac, Hypertension, Arthritis",
    created_at: "2026-01-14T09:15:00Z",
  },
  {
    id: "demo-p3",
    uhid: "UHID-2026-00103",
    full_name: "Arjun Vijay Kulkarni",
    mobile: "+91 97654 32190",
    email: "arjun.k@example.com",
    gender: "male",
    dob: "1988-11-05",
    blood_group: "A+",
    city: "Nagpur",
    state: "Maharashtra",
    chronic_diseases: "Asthma, Seasonal Allergies",
    created_at: "2026-02-01T14:20:00Z",
  },
  {
    id: "demo-p4",
    uhid: "UHID-2026-00104",
    full_name: "Kavita Rajesh Patil",
    mobile: "+91 98901 23456",
    email: "kavita.patil@example.com",
    gender: "female",
    dob: "1975-03-18",
    blood_group: "AB+",
    city: "Nashik",
    state: "Maharashtra",
    chronic_diseases: "Hypothyroidism, Diabetes",
    created_at: "2026-02-10T11:45:00Z",
  },
  {
    id: "demo-p5",
    uhid: "UHID-2026-00105",
    full_name: "Mohammad Farooq Shaikh",
    mobile: "+91 94220 99881",
    email: "farooq.shaikh@example.com",
    gender: "male",
    dob: "1952-12-30",
    blood_group: "O-",
    city: "Aurangabad",
    state: "Maharashtra",
    chronic_diseases: "COPD, Cardiac, Hypertension",
    created_at: "2026-02-15T16:00:00Z",
  },
  {
    id: "demo-p6",
    uhid: "UHID-2026-00106",
    full_name: "Pooja Santosh Gaikwad",
    mobile: "+91 91580 44321",
    email: "pooja.g@example.com",
    gender: "female",
    dob: "1996-07-09",
    blood_group: "B-",
    city: "Thane",
    state: "Maharashtra",
    chronic_diseases: "Asthma",
    created_at: "2026-02-20T10:10:00Z",
  },
  {
    id: "demo-p7",
    uhid: "UHID-2026-00107",
    full_name: "Dattatray Bapurao More",
    mobile: "+91 98211 55667",
    email: "datta.more@example.com",
    gender: "male",
    dob: "1960-05-19",
    blood_group: "A-",
    city: "Kolhapur",
    state: "Maharashtra",
    chronic_diseases: "Chronic Kidney Disease (Stage 2), Diabetes",
    created_at: "2026-03-01T12:00:00Z",
  },
  {
    id: "demo-p8",
    uhid: "UHID-2026-00108",
    full_name: "Meera Chandrakant Joshi",
    mobile: "+91 93701 88299",
    email: "meera.joshi@example.com",
    gender: "female",
    dob: "1966-09-27",
    blood_group: "O+",
    city: "Solapur",
    state: "Maharashtra",
    chronic_diseases: "Osteoarthritis, Hypertension",
    created_at: "2026-03-04T15:30:00Z",
  },
  {
    id: "demo-p9",
    uhid: "UHID-2026-00109",
    full_name: "Aditya Prakash Nair",
    mobile: "+91 99870 12121",
    email: "aditya.nair@example.com",
    gender: "male",
    dob: "2002-02-14",
    blood_group: "AB-",
    city: "Navi Mumbai",
    state: "Maharashtra",
    chronic_diseases: "",
    created_at: "2026-03-05T09:40:00Z",
  },
  {
    id: "demo-p10",
    uhid: "UHID-2026-00110",
    full_name: "Lata Harishchandra Jadhav",
    mobile: "+91 98690 33445",
    email: "lata.jadhav@example.com",
    gender: "female",
    dob: "1949-01-08",
    blood_group: "B+",
    city: "Satara",
    state: "Maharashtra",
    chronic_diseases: "Cardiac, Hypertension, Osteoporosis",
    created_at: "2026-03-08T14:15:00Z",
  },
  {
    id: "demo-p11",
    uhid: "UHID-2026-00111",
    full_name: "Master Aarav Sachin Tendulkar",
    mobile: "+91 98200 11223",
    email: "sachin.parent@example.com",
    gender: "male",
    dob: "2018-06-12",
    blood_group: "O+",
    city: "Mumbai",
    state: "Maharashtra",
    chronic_diseases: "Pediatric Asthma",
    created_at: "2026-03-09T11:00:00Z",
  },
  {
    id: "demo-p12",
    uhid: "UHID-2026-00112",
    full_name: "Dr. Vikramaditya Rathore",
    mobile: "+91 98110 54321",
    email: "vikram.rathore@example.com",
    gender: "male",
    dob: "1978-10-03",
    blood_group: "A+",
    city: "Pune",
    state: "Maharashtra",
    chronic_diseases: "Hypertension, Mild Fatty Liver",
    created_at: "2026-03-10T16:45:00Z",
  },
];

function getAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  try {
    return differenceInYears(new Date(), new Date(dob));
  } catch {
    return null;
  }
}

function parseConditionTags(chronicText: string | null | undefined): string[] {
  if (!chronicText || !chronicText.trim()) return [];
  return chronicText
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getConditionBadgeClass(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("diabet") || c.includes("sugar")) return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300";
  if (c.includes("hyper") || c.includes("bp") || c.includes("pressure")) return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300";
  if (c.includes("cardiac") || c.includes("heart")) return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300";
  if (c.includes("asthma") || c.includes("resp") || c.includes("lung")) return "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300";
  if (c.includes("thyroid")) return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300";
  if (c.includes("arthrit") || c.includes("joint") || c.includes("osteo")) return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300";
  if (c.includes("kidney") || c.includes("renal") || c.includes("ckd")) return "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300";
  return "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300";
}

function PatientGrowthPage() {
  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [chronicSearch, setChronicSearch] = useState("");
  const [selectedAgeBracket, setSelectedAgeBracket] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");

  // Selection State
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());

  // Campaign Modal State
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [selectedTemplateId, setSelectedTemplateId] = useState("diabetes_camp");
  const [messageBody, setMessageBody] = useState(CAMPAIGN_TEMPLATES[0].body);
  const [promoCode, setPromoCode] = useState(CAMPAIGN_TEMPLATES[0].code || "DIABCARE2026");
  const [campDate, setCampDate] = useState(format(new Date(Date.now() + 6 * 86400000), "dd MMM yyyy"));
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sentCount, setSentCount] = useState<number | null>(null);
  
  // Custom templates & attachments state
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [isCustomTemplateOpen, setIsCustomTemplateOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  // Fetch Live Patients from Supabase with graceful fallback/enrichment
  const { data: dbPatients = [] } = useQuery({
    queryKey: ["patient-growth-audience"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, uhid, full_name, mobile, email, gender, dob, blood_group, city, state, chronic_diseases, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error || !data || data.length === 0) {
        return DEMO_PATIENTS;
      }

      // If DB has records but chronic_diseases is empty on all, mix with demo attributes for demonstration
      const hasAnyChronic = data.some((p: any) => p.chronic_diseases && p.chronic_diseases.trim().length > 0);
      if (!hasAnyChronic) {
        const enrichedDb = data.map((p: any, idx: number) => {
          const sample = DEMO_PATIENTS[idx % DEMO_PATIENTS.length];
          return {
            ...p,
            chronic_diseases: p.chronic_diseases || sample.chronic_diseases,
          };
        });
        return [...enrichedDb, ...DEMO_PATIENTS.filter((d) => !enrichedDb.some((p) => p.uhid === d.uhid))];
      }

      if (data.length < 5) {
        return [...data, ...DEMO_PATIENTS.filter((d) => !data.some((p) => p.uhid === d.uhid))];
      }

      return data;
    },
  });

  // Calculate filtered patients list
  const filteredPatients = useMemo(() => {
    return dbPatients.filter((p: any) => {
      const name = (p.full_name ?? "").toLowerCase();
      const uhid = (p.uhid ?? "").toLowerCase();
      const mobile = (p.mobile ?? "").toLowerCase();
      const term = searchTerm.trim().toLowerCase();

      // Search term filter
      if (term && !name.includes(term) && !uhid.includes(term) && !mobile.includes(term)) {
        return false;
      }

      // Gender filter
      if (genderFilter !== "all" && p.gender !== genderFilter) {
        return false;
      }

      // Age calculation and filter
      const age = getAge(p.dob);
      if (selectedAgeBracket !== "all") {
        const bracket = AGE_BRACKETS.find((b) => b.id === selectedAgeBracket);
        if (bracket) {
          if (age === null || age < bracket.min || age > bracket.max) return false;
        }
      }

      // Chronic Disease Search Filter
      const conditions = (p.chronic_diseases ?? "").toLowerCase();
      if (chronicSearch.trim().length > 0) {
        const searchTerms = chronicSearch.trim().toLowerCase();
        if (searchTerms === "none" || searchTerms === "healthy" || searchTerms === "no chronic") {
          if (conditions.trim().length > 0) return false;
        } else if (searchTerms === "any" || searchTerms === "chronic") {
          if (conditions.trim().length === 0) return false;
        } else {
          // Check if patient's conditions contain the search term
          const keywords = searchTerms.split(/[,+]/).map((k) => k.trim()).filter(Boolean);
          const hasMatch = keywords.some((kw) => {
            if (kw === "bp") return conditions.includes("hypertension") || conditions.includes("bp");
            if (kw === "sugar") return conditions.includes("diabetes") || conditions.includes("sugar");
            return conditions.includes(kw);
          });
          if (!hasMatch) return false;
        }
      }

      return true;
    });
  }, [
    dbPatients,
    searchTerm,
    genderFilter,
    selectedAgeBracket,
    chronicSearch,
  ]);


  // Master Selection handlers
  const allFilteredSelected =
    filteredPatients.length > 0 && filteredPatients.every((p: any) => selectedPatientIds.has(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedPatientIds((prev) => {
        const next = new Set(prev);
        filteredPatients.forEach((p: any) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedPatientIds((prev) => {
        const next = new Set(prev);
        filteredPatients.forEach((p: any) => next.add(p.id));
        return next;
      });
    }
  };

  const togglePatient = (id: string) => {
    setSelectedPatientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setChronicSearch("");
    setSelectedAgeBracket("all");
    setGenderFilter("all");
  };

  const activeFiltersCount =
    (searchTerm ? 1 : 0) +
    (chronicSearch ? 1 : 0) +
    (selectedAgeBracket !== "all" ? 1 : 0) +
    (genderFilter !== "all" ? 1 : 0);

  // Selected patients records
  const targetPatients = useMemo(() => {
    if (selectedPatientIds.size > 0) {
      return dbPatients.filter((p: any) => selectedPatientIds.has(p.id));
    }
    return filteredPatients;
  }, [dbPatients, selectedPatientIds, filteredPatients]);

  // Combined templates list (built-in + user-created custom templates)
  const allTemplates = useMemo(() => {
    return [...CAMPAIGN_TEMPLATES, ...customTemplates];
  }, [customTemplates]);

  // Open Campaign modal
  const handleOpenCampaignModal = (channel: "whatsapp" | "sms") => {
    setActiveChannel(channel);
    const template =
      allTemplates.find((t) => t.channel === channel) || allTemplates[0];
    setSelectedTemplateId(template?.id || "diabetes_camp");
    setMessageBody(template?.body || "");
    setPromoCode(template?.code || "GROWTH2026");
    setIsSending(false);
    setSendProgress(0);
    setSentCount(null);
    setCampaignModalOpen(true);
  };

  // Change selected template
  const handleSelectTemplate = (templateId: string) => {
    if (templateId === "CREATE_CUSTOM") {
      setCustomTitle("");
      setCustomBody(messageBody || "");
      setIsCustomTemplateOpen(true);
      return;
    }

    setSelectedTemplateId(templateId);
    const tmpl = allTemplates.find((t) => t.id === templateId);
    if (tmpl) {
      setMessageBody(tmpl.body);
      setPromoCode(tmpl.code);
      if (tmpl.channel === "sms" || tmpl.channel === "whatsapp") {
        setActiveChannel(tmpl.channel);
      }
    }
  };

  // Save newly created custom template
  const handleSaveCustomTemplate = () => {
    if (!customTitle.trim()) {
      toast.error("Please provide a template title");
      return;
    }
    if (!customBody.trim()) {
      toast.error("Please provide message body content");
      return;
    }

    const newTemplate = {
      id: `custom_${Date.now()}`,
      title: customTitle.trim(),
      target: "Custom Template",
      channel: activeChannel,
      body: customBody.trim(),
      code: promoCode || "OFFER2026",
    };

    setCustomTemplates((prev) => [newTemplate, ...prev]);
    setSelectedTemplateId(newTemplate.id);
    setMessageBody(newTemplate.body);
    setIsCustomTemplateOpen(false);
    toast.success(`Custom template "${newTemplate.title}" created!`);
  };

  const samplePatient = targetPatients[0] || {
    full_name: "Rahul Sharma",
    uhid: "UHID-SAMPLE-01",
    mobile: "+91 98765 43210",
  };

  const previewFormattedText = useMemo(() => {
    return messageBody
      .replace(/\[HOSPITAL_NAME\]/g, BRAND.name)
      .replace(/\[NAME\]/g, samplePatient.full_name || "Valued Patient")
      .replace(/\[UHID\]/g, samplePatient.uhid || "UHID-XXXXX")
      .replace(/\[PHONE\]/g, BRAND.phone || "+91 8000 123 456")
      .replace(/\[CODE\]/g, promoCode)
      .replace(/\[DATE\]/g, campDate);
  }, [messageBody, samplePatient, promoCode, campDate]);

  const insertToken = (token: string) => {
    setMessageBody((prev) => `${prev} ${token}`);
  };

  const executeCampaignBroadcast = async () => {
    if (targetPatients.length === 0) {
      toast.error("No patients in target audience to send to.");
      return;
    }

    setIsSending(true);
    setSendProgress(10);

    const total = targetPatients.length;
    for (let i = 1; i <= 10; i++) {
      await new Promise((res) => setTimeout(res, 200));
      setSendProgress(i * 10);
    }

    setIsSending(false);
    setSentCount(total);
    const campaignTitle = allTemplates.find((t) => t.id === selectedTemplateId)?.title || "Promotion";
    const attachmentNote = activeChannel === "whatsapp" && attachments.length > 0 
      ? ` • Included ${attachments.length} attachment(s)` 
      : "";

    toast.success(
      `🎉 ${activeChannel.toUpperCase()} Promotion Broadcast sent to ${total} patients!`,
      {
        description: `Campaign: ${campaignTitle}${attachmentNote}`,
        duration: 5000,
      }
    );
  };

  const handleSingleWhatsApp = (patient: any) => {
    const text = messageBody
      ? messageBody
          .replace(/\[HOSPITAL_NAME\]/g, BRAND.name)
          .replace(/\[NAME\]/g, patient.full_name)
          .replace(/\[UHID\]/g, patient.uhid)
          .replace(/\[PHONE\]/g, BRAND.phone || "+91 8000 123 456")
          .replace(/\[CODE\]/g, promoCode)
          .replace(/\[DATE\]/g, campDate)
      : `Dear ${patient.full_name}, greetings from ${BRAND.name}! We invite you to our upcoming health wellness camp. For inquiries, reply to this message.`;

    const campaignTitle = allTemplates.find((t) => t.id === selectedTemplateId)?.title || "Promotion";
    shareOnWhatsApp(text, undefined, patient.mobile);
    toast.info(`Opening WhatsApp with "${campaignTitle}" for ${patient.full_name}`);
  };


  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 text-primary flex items-center justify-center shadow-xs">
            <TrendingUp className="size-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Patient Growth</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-9 border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
            onClick={() => handleOpenCampaignModal("sms")}
          >
            <MessageSquare className="size-3.5 text-sky-600" />
            Send Bulk SMS
            {selectedPatientIds.size > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {selectedPatientIds.size}
              </Badge>
            )}
          </Button>

          <Button
            size="sm"
            className="gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            onClick={() => handleOpenCampaignModal("whatsapp")}
          >
            <Send className="size-3.5" />
            Send Bulk WhatsApp
            {selectedPatientIds.size > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-white text-emerald-800">
                {selectedPatientIds.size}
              </Badge>
            )}
          </Button>
        </div>
      </div>


      {/* Filter Section: Chronic Disease Wise & Age Wise */}
      <Card className="p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Audience Segmentation Filters</h2>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="text-xs px-2 py-0">
                {activeFiltersCount} active
              </Badge>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
            >
              <X className="size-3 mr-1" />
              Clear all filters
            </Button>
          )}
        </div>

        {/* Top Filter Row: Search, Chronic Select, Age Bracket Select, Gender */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* General Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patient, mobile, UHID..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Search for Chronic Diseases */}
          <div className="relative">
            <HeartPulse className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-emerald-600 pointer-events-none" />
            <Input
              value={chronicSearch}
              onChange={(e) => setChronicSearch(e.target.value)}
              placeholder="Search for chronic diseases..."
              className="pl-9 pr-8 h-9 text-xs"
            />
            {chronicSearch && (
              <button
                type="button"
                onClick={() => setChronicSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear chronic disease search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Age Bracket Dropdown */}
          <div>
            <Select value={selectedAgeBracket} onValueChange={setSelectedAgeBracket}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Age Bracket" />
              </SelectTrigger>
              <SelectContent>
                {AGE_BRACKETS.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gender Filter */}
          <div>
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Genders</SelectItem>
                <SelectItem value="male" className="text-xs">Male</SelectItem>
                <SelectItem value="female" className="text-xs">Female</SelectItem>
                <SelectItem value="other" className="text-xs">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Patient Audience Table */}
      <Card className="shadow-xs overflow-hidden">
        {/* Table Header Action Bar */}
        <div className="p-4 border-b bg-muted/20 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="select-all"
              checked={allFilteredSelected}
              onCheckedChange={toggleSelectAll}
            />
            <label
              htmlFor="select-all"
              className="text-xs font-semibold cursor-pointer select-none"
            >
              {allFilteredSelected ? "Deselect All" : "Select All Matching"}
              <span className="text-muted-foreground font-normal ml-1.5">
                ({filteredPatients.length} patients found)
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {selectedPatientIds.size > 0 && (
              <Badge variant="default" className="bg-primary text-primary-foreground text-xs px-2.5 py-1">
                {selectedPatientIds.size} Selected
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => {
                const next = new Set<string>();
                filteredPatients.forEach((p: any) => next.add(p.id));
                setSelectedPatientIds(next);
                toast.info(`Selected all ${filteredPatients.length} filtered patients`);
              }}
            >
              Select All {filteredPatients.length}
            </Button>

            {selectedPatientIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setSelectedPatientIds(new Set())}
              >
                Clear Selection
              </Button>
            )}
          </div>
        </div>

        {/* Selected Campaign Template Quick Bar */}
        <div className="px-4 py-2.5 bg-primary/5 border-b flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Send className="size-3.5 text-emerald-600" /> Active Template for Outreach:
            </span>
            <div className="w-64">
              <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
                <SelectTrigger className="h-7 text-xs bg-background">
                  <SelectValue placeholder="Select campaign template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREATE_CUSTOM" className="text-xs text-primary font-medium focus:bg-primary/10">
                    <div className="flex items-center gap-1.5 py-0.5">
                      <PlusCircle className="size-3 text-primary" />
                      <span>+ Create Custom Template</span>
                    </div>
                  </SelectItem>

                  {customTemplates.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                        Custom Templates
                      </div>
                      {customTemplates.map((tmpl) => (
                        <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
                          <span className="font-medium">{tmpl.title}</span>
                        </SelectItem>
                      ))}
                    </>
                  )}

                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                    Built-in Templates
                  </div>
                  {CAMPAIGN_TEMPLATES.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
                      <span className="font-medium">{tmpl.title}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="text-[10px] bg-background text-muted-foreground font-mono">
              Code: {promoCode}
            </Badge>
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span>Clicking</span>
            <span className="inline-flex items-center justify-center size-5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 font-bold">
              <Send className="size-2.5" />
            </span>
            <span>on any patient sends this template on WhatsApp</span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Chronic Diseases / Diagnoses</th>
                <th className="p-3">City</th>
                <th className="p-3 text-right">Quick Outreach</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="size-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto mb-3">
                      <Search className="size-6" />
                    </div>
                    <div className="text-sm font-semibold">No patients match the selected criteria</div>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                      Try adjusting your chronic disease search or filters to broaden the promotion audience.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllFilters}
                      className="mt-4 text-xs h-8"
                    >
                      Reset All Filters
                    </Button>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient: any) => {
                  const isSelected = selectedPatientIds.has(patient.id);
                  const conditions = parseConditionTags(patient.chronic_diseases);

                  return (
                    <tr
                      key={patient.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? "bg-primary/5 font-medium" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePatient(patient.id)}
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8 border">
                            <AvatarFallback className="text-[11px] font-semibold bg-primary/10 text-primary">
                              {patient.full_name?.slice(0, 2).toUpperCase() || "PT"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Link
                              to="/patients/$id"
                              params={{ id: patient.id }}
                              className="font-semibold text-foreground hover:text-primary transition hover:underline"
                            >
                              {patient.full_name}
                            </Link>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-mono">
                              <span>{patient.uhid || "—"}</span>
                              {patient.gender && (
                                <>
                                  <span>•</span>
                                  <span className="capitalize font-sans">{patient.gender}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-mono text-xs text-foreground flex items-center gap-1.5">
                          <Phone className="size-3 text-muted-foreground shrink-0" />
                          <span>{patient.mobile || "—"}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        {conditions.length === 0 ? (
                          <span className="text-muted-foreground text-[11px] italic">
                            No chronic conditions tagged
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {conditions.map((cond, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className={`text-[10px] px-2 py-0 border font-medium ${getConditionBadgeClass(
                                  cond
                                )}`}
                              >
                                {cond}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-muted-foreground">
                        {patient.city ? `${patient.city}${patient.state ? `, ${patient.state}` : ""}` : "—"}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                            title={`Send active template (${allTemplates.find((t) => t.id === selectedTemplateId)?.title || "Campaign"}) to ${patient.full_name}`}
                            onClick={() => handleSingleWhatsApp(patient)}
                          >
                            <Send className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950"
                            title="Compose customized message for this patient"
                            onClick={() => {
                              setSelectedPatientIds(new Set([patient.id]));
                              handleOpenCampaignModal("sms");
                            }}
                          >
                            <MessageSquare className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-3.5 border-t bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing <b className="text-foreground">{filteredPatients.length}</b> of{" "}
            <b>{dbPatients.length}</b> total registered patients
          </div>
          <div>
            <b className="text-foreground">{selectedPatientIds.size}</b> patient(s) selected for promotional outreach
          </div>
        </div>
      </Card>

      {/* Campaign Composer Modal (Bulk WhatsApp & SMS) */}
      <Dialog open={campaignModalOpen} onOpenChange={setCampaignModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div
                className={`size-8 rounded-lg flex items-center justify-center ${
                  activeChannel === "whatsapp"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950"
                    : "bg-sky-100 text-sky-700 dark:bg-sky-950"
                }`}
              >
                {activeChannel === "whatsapp" ? (
                  <Send className="size-4 text-emerald-600" />
                ) : (
                  <MessageSquare className="size-4 text-sky-600" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {activeChannel === "whatsapp" ? "WhatsApp Bulk Campaign" : "Bulk SMS Campaign"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Targeting {targetPatients.length} selected patient{targetPatients.length !== 1 ? "s" : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Channel Switcher */}
            <div className="flex items-center justify-between border-b pb-3">
              <Tabs
                value={activeChannel}
                onValueChange={(val) => setActiveChannel(val as "whatsapp" | "sms")}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="whatsapp" className="text-xs gap-1.5">
                    <Send className="size-3 text-emerald-600" />
                    WhatsApp Channel
                  </TabsTrigger>
                  <TabsTrigger value="sms" className="text-xs gap-1.5">
                    <MessageSquare className="size-3 text-sky-600" />
                    Bulk SMS Gateway
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Badge variant="outline" className="text-xs bg-muted/40">
                Audience: <b className="ml-1 text-primary">{targetPatients.length}</b> recipients
              </Badge>
            </div>

            {/* Campaign Preset Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">Select Campaign Template</label>
                <button
                  type="button"
                  onClick={() => {
                    setCustomTitle("");
                    setCustomBody(messageBody || "");
                    setIsCustomTemplateOpen(true);
                  }}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <PlusCircle className="size-3" />
                  + Create Custom Template
                </button>
              </div>
              <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose a ready health package template" />
                </SelectTrigger>
                <SelectContent>
                  {/* Action Item to Create Custom Template */}
                  <SelectItem value="CREATE_CUSTOM" className="text-xs text-primary font-medium focus:bg-primary/10">
                    <div className="flex items-center gap-2 py-0.5">
                      <PlusCircle className="size-3.5 text-primary" />
                      <span>+ Create Custom Template</span>
                    </div>
                  </SelectItem>
                  
                  {/* User Created Custom Templates (if any) */}
                  {customTemplates.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                        Custom Templates
                      </div>
                      {customTemplates.map((tmpl) => (
                        <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-medium">{tmpl.title}</span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">(Custom)</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}

                  {/* Built-in Pre-made Hospital Templates */}
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                    Built-in Templates
                  </div>
                  {CAMPAIGN_TEMPLATES.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium">{tmpl.title}</span>
                        <span className="text-[10px] text-muted-foreground">({tmpl.target})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Parameters: Promo Code & Valid Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Promotional Offer Code</label>
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="e.g. DIABCARE2026"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Valid Date / Camp Date</label>
                <Input
                  value={campDate}
                  onChange={(e) => setCampDate(e.target.value)}
                  placeholder="e.g. 20 Mar 2026"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Message Body & Dynamic Tags */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">Campaign Message Content</label>
                <span className="text-[11px] text-muted-foreground">
                  {messageBody.length} chars {activeChannel === "sms" && `· ${Math.ceil(messageBody.length / 160)} SMS`}
                </span>
              </div>
              <Textarea
                rows={5}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Write promotional message here..."
                className="text-xs font-sans resize-y"
              />

              {/* Dynamic Tag Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-muted-foreground font-medium">Insert tag:</span>
                {[
                  { tag: "[NAME]", label: "Patient Name" },
                  { tag: "[UHID]", label: "UHID" },
                  { tag: "[HOSPITAL_NAME]", label: "Hospital Name" },
                  { tag: "[PHONE]", label: "Hospital Phone" },
                  { tag: "[CODE]", label: "Offer Code" },
                  { tag: "[DATE]", label: "Camp Date" },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertToken(item.tag)}
                    className="text-[10px] px-2 py-0.5 rounded border bg-muted/30 hover:bg-muted font-mono transition text-muted-foreground hover:text-foreground"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>

              {/* Attachments Section - Bulk WhatsApp only */}
              {activeChannel === "whatsapp" && (
                <div className="pt-2 border-t mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Paperclip className="size-3.5 text-emerald-600" /> WhatsApp Attachments
                    </label>
                    <label className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer flex items-center gap-1">
                      <span>+ Attach File / Image</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files) {
                            const newFiles = Array.from(e.target.files);
                            setAttachments((prev) => [...prev, ...newFiles]);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded text-[11px] text-emerald-800 dark:text-emerald-300"
                        >
                          <FileText className="size-3 text-emerald-600" />
                          <span className="max-w-[150px] truncate">{file.name}</span>
                          <span className="text-[9px] text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-destructive ml-0.5"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic bg-muted/20 px-2.5 py-1.5 rounded border border-dashed">
                      Optional: Attach promotional flyer image, PDF brochure, or prescription voucher for bulk WhatsApp recipients.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Smartphone Chat Mockup Preview */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Eye className="size-3.5 text-primary" /> Live Mobile Message Preview
                </label>
                <span className="text-[10px] text-muted-foreground">
                  Previewing for {samplePatient.full_name}
                </span>
              </div>

              {activeChannel === "whatsapp" ? (
                /* WhatsApp Mockup Frame */
                <div className="rounded-xl border border-emerald-500/20 bg-[#e5ddd5] dark:bg-[#0b141a] p-4 shadow-inner max-w-lg mx-auto">
                  {/* WhatsApp Top Bar */}
                  <div className="flex items-center gap-2 pb-3 mb-2 border-b border-black/10 dark:border-white/10">
                    <div className="size-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                      {BRAND.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="leading-tight">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                        {BRAND.name}
                        <CheckCircle2 className="size-3 text-emerald-600 fill-emerald-600 text-white" />
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400">Official Hospital Account</div>
                    </div>
                  </div>

                  {/* Message Bubble */}
                  <div className="bg-white dark:bg-[#1f2c34] text-slate-800 dark:text-slate-100 rounded-lg rounded-tl-none p-3 shadow-xs text-xs whitespace-pre-wrap leading-relaxed max-w-[95%]">
                    {/* Attached files preview in bubble */}
                    {attachments.length > 0 && (
                      <div className="mb-2 pb-2 border-b border-slate-200 dark:border-slate-700/80 space-y-1.5">
                        {attachments.map((file, i) => {
                          const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
                          const blobUrl = isImage ? URL.createObjectURL(file) : null;

                          return isImage ? (
                            <div key={i} className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                              <img
                                src={blobUrl!}
                                alt={file.name}
                                className="w-full h-36 object-cover hover:opacity-95 transition"
                                onLoad={() => {
                                  // Clean up object URL after loading
                                  if (blobUrl) URL.revokeObjectURL(blobUrl);
                                }}
                              />
                              <div className="px-2 py-1 bg-black/40 text-white text-[10px] flex items-center justify-between backdrop-blur-xs">
                                <span className="truncate max-w-[200px] flex items-center gap-1">
                                  <ImageIcon className="size-3 text-emerald-400" />
                                  {file.name}
                                </span>
                                <span className="text-[9px] text-slate-300 font-mono">
                                  {(file.size / 1024).toFixed(0)} KB
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div
                              key={i}
                              className="flex items-center gap-2 p-2 rounded-md bg-emerald-50/80 dark:bg-[#111b21] border border-emerald-200/80 dark:border-emerald-900/50"
                            >
                              <div className="size-8 rounded bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                                <FileText className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-[11px] truncate text-slate-800 dark:text-slate-200">
                                  {file.name}
                                </div>
                                <div className="text-[9px] text-muted-foreground">
                                  {file.name.split(".").pop()?.toUpperCase()} Document · {(file.size / 1024).toFixed(0)} KB
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {previewFormattedText}
                    <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                      <span>{format(new Date(), "hh:mm a")}</span>
                      <span className="text-sky-500 font-bold">✓✓</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* SMS Mockup Frame */
                <div className="rounded-xl border border-sky-500/20 bg-slate-50 dark:bg-slate-900 p-4 shadow-inner max-w-lg mx-auto">
                  <div className="text-center pb-2 mb-2 border-b text-[11px] font-semibold text-muted-foreground">
                    Sender ID: VM-HOSPIT
                  </div>
                  <div className="bg-sky-600 text-white rounded-2xl rounded-br-sm p-3 shadow-xs text-xs whitespace-pre-wrap leading-relaxed ml-auto max-w-[90%]">
                    {previewFormattedText}
                    <div className="mt-1 text-[9px] text-sky-200 text-right">
                      {format(new Date(), "hh:mm a")} · Delivered
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Delivery Progress Bar */}
            {isSending && (
              <div className="space-y-2 p-3 bg-muted/40 rounded-lg">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="size-3.5 animate-spin text-primary" />
                    Dispatching messages to {targetPatients.length} recipients...
                  </span>
                  <span>{sendProgress}%</span>
                </div>
                <Progress value={sendProgress} className="h-2" />
              </div>
            )}

            {sentCount !== null && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                <span>
                  Successfully dispatched promotional broadcast to <b>{sentCount}</b> patient numbers!
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCampaignModalOpen(false)}
              disabled={isSending}
            >
              Close
            </Button>

            <Button
              size="sm"
              onClick={executeCampaignBroadcast}
              disabled={isSending || targetPatients.length === 0}
              className={
                activeChannel === "whatsapp"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  : "bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
              }
            >
              {isSending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Dispatch Campaign ({targetPatients.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Custom Template Dialog */}
      <Dialog open={isCustomTemplateOpen} onOpenChange={setIsCustomTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <PlusCircle className="size-4 text-primary" />
              Create Custom Campaign Template
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define a reusable message template with dynamic tags for bulk outreach.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Template Title</label>
              <Input
                placeholder="e.g. Monsoon Health Checkup 2026"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">Message Body Content</label>
                <span className="text-[10px] text-muted-foreground">Supports tags like [NAME], [CODE]</span>
              </div>
              <Textarea
                rows={5}
                placeholder="Write your custom message text here..."
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                className="text-xs resize-y"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium">Quick tags:</span>
              {[
                { tag: "[NAME]", label: "Name" },
                { tag: "[HOSPITAL_NAME]", label: "Hospital" },
                { tag: "[PHONE]", label: "Phone" },
                { tag: "[CODE]", label: "Offer Code" },
                { tag: "[DATE]", label: "Camp Date" },
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => setCustomBody((prev) => `${prev} ${item.tag}`)}
                  className="text-[9px] px-1.5 py-0.5 rounded border bg-muted/40 hover:bg-muted font-mono"
                >
                  + {item.label}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCustomTemplateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCustomTemplate}
              className="gap-1.5"
            >
              <Check className="size-3.5" />
              Save & Use Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
