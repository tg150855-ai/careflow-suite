import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export type AppLanguage = "en" | "hi" | "mr";

export const LANGUAGES: { code: AppLanguage; label: string; native: string; flag: string }[] = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "hi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "mr", label: "Marathi", native: "मराठी", flag: "🇮🇳" },
];

const LS_KEY = "sbg.language";

// Centralized keys. Add new strings here; every screen resolves via t().
const en = {
  nav: {
    groups: {
      clinical: "Clinical", operations: "Operations", documents: "Documents",
      finance: "Finance", hr: "HR", admin: "Admin",
    },
    items: {
      dashboard: "Dashboard", emergency: "Emergency", patients: "Patients", opd: "OPD",
      ipd: "IPD", discharge: "Discharge", billing_center: "Billing", ot: "OT / Surgery",
      nurse_station: "Nurse Station", icu: "ICU / Critical Care",
      laboratory: "Laboratory", radiology: "Radiology", blood_bank: "Blood Bank",
      dialysis: "Dialysis", bed_management: "Bed Management",
      death_register: "Death Register", birth_register: "Birth Register",
      ambulance: "Ambulance", assets: "Assets", vendors: "Vendors",
      procurement: "Procurement", biomedical: "Biomedical",
      documents: "Documents",
      billing: "Billing", pharmacy: "Pharmacy", insurance: "Insurance",
      accounts: "Accounts", revenue_reports: "Revenue Reports", bi: "BI Dashboard",
      employees: "Employees", attendance: "Attendance", leave: "Leave Management",
      payroll: "Payroll", shift_staffing: "Shift / Staffing", performance: "Performance",
      user_management: "User Management", roles_permissions: "Roles & Permissions",
      branches: "Branch Management", hospital_settings: "Hospital Settings",
      backups: "Backup & Restore", audit_logs: "Audit Logs", audit_trail: "Audit Trail",
      security_center: "Security Center", api_gateway: "API Gateway",
      mobile_api: "Mobile API & Push",
    },
    collapse: "Collapse", sign_out: "Sign out",
  },
  common: {
    save: "Save", edit: "Edit", delete: "Delete", print: "Print", export: "Export",
    import: "Import", search: "Search", cancel: "Cancel", update: "Update",
    add: "Add", close: "Close", view: "View", loading: "Loading…", saved: "Saved",
    yes: "Yes", no: "No", all: "All", today: "Today", week: "Week", month: "Month",
    year: "Year", status: "Status", actions: "Actions", back: "Back",
    read_only: "Read-only",
  },
  settings: {
    title: "Hospital Settings",
    subtitle: "Manage hospital identity, branding, and operational defaults.",
    tabs: {
      profile: "Profile", logo: "Logo", branding: "Branding", departments: "Departments",
      prescription: "Prescription", billing: "Billing", printers: "Printers",
      messaging: "WhatsApp/SMS", security: "Security", language: "Language",
    },
    language: {
      heading: "System language",
      description:
        "Choose the default language for the entire HMIS interface. Applies to sidebar, buttons, forms, dashboards and reports. Patient names, doctor notes and other user-entered data are never translated.",
      default_label: "Default system language",
      save: "Save language",
      applied: "Language updated. The interface will refresh in the selected language.",
    },
  },
};

const hi: typeof en = {
  nav: {
    groups: {
      clinical: "चिकित्सा", operations: "संचालन", documents: "दस्तावेज़",
      finance: "वित्त", hr: "मानव संसाधन", admin: "प्रशासन",
    },
    items: {
      dashboard: "डैशबोर्ड", emergency: "आपातकाल", patients: "मरीज़", opd: "ओपीडी",
      ipd: "आईपीडी", discharge: "छुट्टी", billing_center: "बिलिंग", ot: "ओटी / सर्जरी",
      nurse_station: "नर्स स्टेशन", icu: "आईसीयू / गहन चिकित्सा",
      laboratory: "प्रयोगशाला", radiology: "रेडियोलॉजी", blood_bank: "ब्लड बैंक",
      dialysis: "डायलिसिस", bed_management: "बेड प्रबंधन",
      death_register: "मृत्यु रजिस्टर", birth_register: "जन्म रजिस्टर",
      ambulance: "एम्बुलेंस", assets: "संपत्ति", vendors: "विक्रेता",
      procurement: "खरीद", biomedical: "बायोमेडिकल",
      documents: "दस्तावेज़",
      billing: "बिलिंग", pharmacy: "फार्मेसी", insurance: "बीमा",
      accounts: "खाते", revenue_reports: "राजस्व रिपोर्ट", bi: "बीआई डैशबोर्ड",
      employees: "कर्मचारी", attendance: "उपस्थिति", leave: "अवकाश प्रबंधन",
      payroll: "वेतन", shift_staffing: "शिफ्ट / स्टाफिंग", performance: "प्रदर्शन",
      user_management: "उपयोगकर्ता प्रबंधन", roles_permissions: "भूमिकाएँ और अनुमतियाँ",
      branches: "शाखा प्रबंधन", hospital_settings: "अस्पताल सेटिंग्स",
      backups: "बैकअप और पुनर्स्थापना", audit_logs: "ऑडिट लॉग", audit_trail: "ऑडिट ट्रेल",
      security_center: "सुरक्षा केंद्र", api_gateway: "एपीआई गेटवे",
      mobile_api: "मोबाइल एपीआई और पुश",
    },
    collapse: "छोटा करें", sign_out: "साइन आउट",
  },
  common: {
    save: "सहेजें", edit: "संपादित करें", delete: "हटाएं", print: "प्रिंट",
    export: "निर्यात", import: "आयात", search: "खोजें", cancel: "रद्द करें",
    update: "अपडेट", add: "जोड़ें", close: "बंद करें", view: "देखें",
    loading: "लोड हो रहा है…", saved: "सहेजा गया", yes: "हाँ", no: "नहीं",
    all: "सभी", today: "आज", week: "सप्ताह", month: "महीना", year: "वर्ष",
    status: "स्थिति", actions: "कार्रवाई", back: "वापस", read_only: "केवल पढ़ने योग्य",
  },
  settings: {
    title: "अस्पताल सेटिंग्स",
    subtitle: "अस्पताल की पहचान, ब्रांडिंग और संचालन डिफ़ॉल्ट प्रबंधित करें।",
    tabs: {
      profile: "प्रोफ़ाइल", logo: "लोगो", branding: "ब्रांडिंग", departments: "विभाग",
      prescription: "नुस्खा", billing: "बिलिंग", printers: "प्रिंटर",
      messaging: "व्हाट्सएप/एसएमएस", security: "सुरक्षा", language: "भाषा",
    },
    language: {
      heading: "सिस्टम भाषा",
      description:
        "पूरे एचएमआईएस इंटरफ़ेस के लिए डिफ़ॉल्ट भाषा चुनें। यह साइडबार, बटन, फ़ॉर्म, डैशबोर्ड और रिपोर्ट पर लागू होती है। मरीज़ के नाम, डॉक्टर के नोट्स और उपयोगकर्ता द्वारा दर्ज डेटा का अनुवाद नहीं किया जाता।",
      default_label: "डिफ़ॉल्ट सिस्टम भाषा",
      save: "भाषा सहेजें",
      applied: "भाषा अपडेट की गई। इंटरफ़ेस चयनित भाषा में दिखेगा।",
    },
  },
};

const mr: typeof en = {
  nav: {
    groups: {
      clinical: "वैद्यकीय", operations: "कार्यचालन", documents: "कागदपत्रे",
      finance: "अर्थ", hr: "मानव संसाधन", admin: "प्रशासन",
    },
    items: {
      dashboard: "डॅशबोर्ड", emergency: "आपत्कालीन", patients: "रुग्ण", opd: "ओपीडी",
      ipd: "आयपीडी", discharge: "डिस्चार्ज", billing_center: "बिलिंग", ot: "ओटी / शस्त्रक्रिया",
      nurse_station: "नर्स स्टेशन", icu: "आयसीयू / अतिदक्षता",
      laboratory: "प्रयोगशाळा", radiology: "रेडिओलॉजी", blood_bank: "रक्तपेढी",
      dialysis: "डायलिसिस", bed_management: "खाट व्यवस्थापन",
      death_register: "मृत्यू नोंदवही", birth_register: "जन्म नोंदवही",
      ambulance: "रुग्णवाहिका", assets: "मालमत्ता", vendors: "विक्रेते",
      procurement: "खरेदी", biomedical: "बायोमेडिकल",
      documents: "कागदपत्रे",
      billing: "बिलिंग", pharmacy: "औषधालय", insurance: "विमा",
      accounts: "खाती", revenue_reports: "महसूल अहवाल", bi: "बीआय डॅशबोर्ड",
      employees: "कर्मचारी", attendance: "उपस्थिती", leave: "रजा व्यवस्थापन",
      payroll: "वेतन", shift_staffing: "शिफ्ट / कर्मचारी", performance: "कामगिरी",
      user_management: "वापरकर्ता व्यवस्थापन", roles_permissions: "भूमिका व परवानग्या",
      branches: "शाखा व्यवस्थापन", hospital_settings: "रुग्णालय सेटिंग्ज",
      backups: "बॅकअप व पुनर्संचयन", audit_logs: "ऑडिट लॉग", audit_trail: "ऑडिट ट्रेल",
      security_center: "सुरक्षा केंद्र", api_gateway: "एपीआय गेटवे",
      mobile_api: "मोबाइल एपीआय व पुश",
    },
    collapse: "लहान करा", sign_out: "साइन आऊट",
  },
  common: {
    save: "जतन करा", edit: "संपादन", delete: "हटवा", print: "प्रिंट",
    export: "निर्यात", import: "आयात", search: "शोधा", cancel: "रद्द करा",
    update: "अद्ययावत", add: "जोडा", close: "बंद करा", view: "पहा",
    loading: "लोड होत आहे…", saved: "जतन केले", yes: "होय", no: "नाही",
    all: "सर्व", today: "आज", week: "आठवडा", month: "महिना", year: "वर्ष",
    status: "स्थिती", actions: "क्रिया", back: "मागे", read_only: "फक्त वाचनीय",
  },
  settings: {
    title: "रुग्णालय सेटिंग्ज",
    subtitle: "रुग्णालयाची ओळख, ब्रँडिंग व कार्यचालन डीफॉल्ट व्यवस्थापित करा.",
    tabs: {
      profile: "प्रोफाइल", logo: "लोगो", branding: "ब्रँडिंग", departments: "विभाग",
      prescription: "प्रिस्क्रिप्शन", billing: "बिलिंग", printers: "प्रिंटर",
      messaging: "व्हॉट्सअ‍ॅप/एसएमएस", security: "सुरक्षा", language: "भाषा",
    },
    language: {
      heading: "सिस्टम भाषा",
      description:
        "संपूर्ण एचएमआयएस इंटरफेससाठी डीफॉल्ट भाषा निवडा. साइडबार, बटणे, फॉर्म, डॅशबोर्ड व अहवालांना लागू होते. रुग्णाची नावे, डॉक्टरांच्या नोंदी व वापरकर्त्याने भरलेला डेटा भाषांतरित होत नाही.",
      default_label: "डीफॉल्ट सिस्टम भाषा",
      save: "भाषा जतन करा",
      applied: "भाषा अद्ययावत केली. इंटरफेस निवडलेल्या भाषेत दिसेल.",
    },
  },
};

export function getStoredLanguage(): AppLanguage {
  try {
    const v = localStorage.getItem(LS_KEY) as AppLanguage | null;
    if (v && LANGUAGES.some((l) => l.code === v)) return v;
  } catch { /* noop */ }
  return "en";
}

export function setStoredLanguage(lang: AppLanguage) {
  try { localStorage.setItem(LS_KEY, lang); } catch { /* noop */ }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
    },
    lng: getStoredLanguage(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export async function applyLanguage(lang: AppLanguage) {
  setStoredLanguage(lang);
  await i18n.changeLanguage(lang);
  try { document.documentElement.lang = lang; } catch { /* noop */ }
}

export default i18n;
