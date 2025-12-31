import { z } from "zod";

// ============================================
// SHULS
// ============================================

export const shulSchema = z.object({
  businessId: z.number().int().positive("Business is required"),
  rabbi: z.string().max(200).optional().nullable(),
  denomination: z.string().max(50).optional().nullable(),
  nusach: z.string().max(50).optional().nullable(),
  hasMinyan: z.boolean(),
});

export type ShulFormData = z.infer<typeof shulSchema>;

// ============================================
// DAVENING SCHEDULES
// ============================================

export const daveningScheduleSchema = z.object({
  shulId: z.number().int().positive("Shul is required"),
  tefilahType: z.enum(["shacharis", "mincha", "maariv"]),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(), // 0=Sun, 6=Sat, null=daily
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  notes: z.string().max(200).optional().nullable(),
  isWinter: z.boolean(),
  isSummer: z.boolean(),
  isShabbos: z.boolean(),
});

export type DaveningScheduleFormData = z.infer<typeof daveningScheduleSchema>;

// ============================================
// EVENTS
// ============================================

export const eventSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  startTime: z.string().datetime({ message: "Valid start time is required" }),
  endTime: z.string().datetime().optional().nullable(),
  isAllDay: z.boolean(),
  eventType: z.enum(["community", "shul", "shiur"]).optional().nullable(),
  shulId: z.number().int().positive().optional().nullable(),
  contactName: z.string().max(100).optional().nullable(),
  contactEmail: z.string().email().max(255).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  cost: z.string().max(150).optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable(),
});

export type EventFormData = z.infer<typeof eventSchema>;

// ============================================
// SHIURIM
// ============================================

// Schedule entry for each day
const scheduleEntrySchema = z.object({
  start: z.string().optional().nullable(),
  end: z.string().optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
});

export const shiurSchema = z.object({
  // Teacher info
  teacherTitle: z.string().max(20).optional().nullable(),
  teacherFirstName: z.string().max(100).optional().nullable(),
  teacherLastName: z.string().max(100).optional().nullable(),
  // Basic info
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional().nullable(),
  // Location - either shul or custom
  shulId: z.number().int().positive().optional().nullable(),
  locationName: z.string().max(200).optional().nullable(),
  locationAddress: z.string().max(500).optional().nullable(),
  locationPostalCode: z.string().max(20).optional().nullable(),
  locationArea: z.string().max(50).optional().nullable(),
  // Schedule - JSON object with day keys (0-6)
  schedule: z.record(z.string(), scheduleEntrySchema).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  // Classification
  category: z.string().max(100).optional().nullable(),
  classType: z.string().max(50).optional().nullable(),
  level: z.string().max(50).optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  // Contact info
  contactName: z.string().max(100).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  contactEmail: z.string().email().max(255).optional().nullable().or(z.literal("")),
  website: z.string().max(255).optional().nullable(),
  // Additional
  cost: z.string().max(100).optional().nullable(),
  projectOf: z.string().max(200).optional().nullable(),
  submitterEmail: z.string().email().max(255).optional().nullable().or(z.literal("")),
  isOnHold: z.boolean(),
});

export type ShiurFormData = z.infer<typeof shiurSchema>;

// ============================================
// HELPER CONSTANTS
// ============================================

export const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Shabbos" },
];

export const TEFILAH_TYPES = [
  { value: "shacharis", label: "Shacharis" },
  { value: "mincha", label: "Mincha" },
  { value: "maariv", label: "Maariv" },
];

export const EVENT_TYPES = [
  { value: "community", label: "Community Event" },
  { value: "shul", label: "Shul Event" },
  { value: "shiur", label: "Shiur/Class" },
];

export const SHIUR_LEVELS = [
  { value: "all", label: "All" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export const SHIUR_GENDERS = [
  { value: "everyone", label: "Everyone" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
];

export const TEACHER_TITLES = [
  { value: "rabbi", label: "Rabbi" },
  { value: "harav", label: "Harav" },
  { value: "rav", label: "Rav" },
  { value: "haham", label: "Haham" },
  { value: "mr", label: "Mr." },
  { value: "dr", label: "Dr." },
  { value: "prof", label: "Prof." },
  { value: "rebbetzin", label: "Rebbetzin" },
  { value: "mrs", label: "Mrs." },
  { value: "ms", label: "Ms." },
  { value: "miss", label: "Miss" },
];

export const SHIUR_CATEGORIES = [
  { value: "amud-yomi", label: "Amud Yomi" },
  { value: "beis-medrash", label: "Beis Medrash Program" },
  { value: "challah-baking", label: "Challoh Baking" },
  { value: "campus-shiurim", label: "Campus Shiurim" },
  { value: "daf-yomi", label: "Daf Yomi" },
  { value: "halacha", label: "Halacha" },
  { value: "hashkafa", label: "Hashkafa" },
  { value: "hebrew", label: "Hebrew" },
  { value: "judaism", label: "Judaism" },
  { value: "kollel", label: "Kollel" },
  { value: "kollel-morning", label: "Kollel - Morning" },
  { value: "kollel-afternoon", label: "Kollel - Afternoon" },
  { value: "kollel-night", label: "Kollel - Night" },
  { value: "mishnayos", label: "Mishnayos" },
  { value: "mussar", label: "Mussar" },
  { value: "parsha", label: "Parsha" },
  { value: "pirkei-avos", label: "Pirkei Avos" },
  { value: "prayer", label: "Prayer" },
  { value: "relationships", label: "Relationships" },
  { value: "tanach", label: "Tanach" },
  { value: "talmud", label: "Talmud" },
];

export const SHIUR_CLASS_TYPES = [
  { value: "shiur", label: "Shiur" },
  { value: "lecture", label: "Lecture" },
  { value: "group", label: "Group" },
  { value: "chavrusa", label: "Chavrusa" },
];

export const LOCATION_AREAS = [
  { value: "downtown", label: "Down Town" },
  { value: "bathurst-eglinton", label: "Bathurst & Eglinton" },
  { value: "bathurst-lawrence", label: "Bathurst & Lawrence" },
  { value: "bathurst-wilson", label: "Bathurst & Wilson" },
  { value: "bathurst-sheppard", label: "Bathurst & Sheppard" },
  { value: "bathurst-finch", label: "Bathurst & Finch" },
  { value: "bathurst-steeles", label: "Bathurst & Steeles" },
  { value: "bathurst-clark", label: "Bathurst & Clark" },
  { value: "bathurst-centre", label: "Bathurst & Centre" },
  { value: "north-hwy-7", label: "North of Hwy 7" },
  { value: "gta", label: "GTA" },
  { value: "other", label: "Other" },
];

export const ORGANIZATIONS = [
  { value: "kollel-toronto", label: "Kollel Toronto" },
  { value: "bayt", label: "Beth Avraham Yoseph of Toronto" },
  { value: "aish-thornhill", label: "Aish HaTorah - Thornhill" },
  { value: "aish-downtown", label: "Aish HaTorah - Downtown" },
  { value: "chabad", label: "Chabad" },
  { value: "clanton-park", label: "Clanton Park Synagogue" },
  { value: "shaarei-shomayim", label: "Shaarei Shomayim" },
  { value: "shomrai-shabbos", label: "Shomrai Shabbos Chevra Mishnayos" },
  { value: "bnei-akiva", label: "Bnei Akiva" },
  { value: "ncsy", label: "NCSY" },
  { value: "jli", label: "JLI" },
  { value: "partners-in-torah", label: "Partners in Torah" },
  { value: "ohr-somayach", label: "Ohr Somayach" },
  { value: "other", label: "Other" },
];

export const DENOMINATIONS = [
  { value: "orthodox", label: "Orthodox" },
  { value: "modern-orthodox", label: "Modern Orthodox" },
  { value: "chabad", label: "Chabad" },
  { value: "yeshivish", label: "Yeshivish" },
  { value: "chassidish", label: "Chassidish" },
  { value: "sephardic", label: "Sephardic" },
];

export const NUSACH_OPTIONS = [
  { value: "ashkenaz", label: "Ashkenaz" },
  { value: "sefard", label: "Sefard" },
  { value: "ari", label: "Ari (Chabad)" },
  { value: "edot-hamizrach", label: "Edot HaMizrach" },
  { value: "teiman", label: "Teimani" },
];
