// User types
export type UserRole = "admin" | "business" | "member";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type SubscriptionStatus = "active" | "cancelled" | "past_due" | "trialing";

export interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: UserRole;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
}

// Business types
export interface BusinessHours {
  sunday?: { open: string; close: string } | null;
  monday?: { open: string; close: string } | null;
  tuesday?: { open: string; close: string } | null;
  wednesday?: { open: string; close: string } | null;
  thursday?: { open: string; close: string } | null;
  friday?: { open: string; close: string } | null;
  saturday?: { open: string; close: string } | null;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  whatsapp?: string;
}

export interface Business {
  id: number;
  userId: number | null;
  name: string;
  slug: string;
  categoryId: number | null;
  description: string | null;
  address: string | null;
  city: string;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  hours: BusinessHours | null;
  socialLinks: SocialLinks | null;
  isKosher: boolean;
  kosherCertification: string | null;
  latitude: number | null;
  longitude: number | null;
  approvalStatus: ApprovalStatus;
  isFeatured: boolean;
  viewCount: number;
  isActive: boolean;
  createdAt: Date;
}

export interface BusinessCategory {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
}

// Shul types
export type TefilahType = "shacharis" | "mincha" | "maariv";

export interface Shul {
  id: number;
  businessId: number;
  rabbi: string | null;
  denomination: string | null;
  nusach: string | null;
  hasMinyan: boolean;
  business?: Business;
}

export interface DaveningSchedule {
  id: number;
  shulId: number;
  tefilahType: TefilahType;
  dayOfWeek: number | null; // 0=Sun, null=daily
  time: string;
  notes: string | null;
  isWinter: boolean;
  isSummer: boolean;
  isShabbos: boolean;
}

// Classified types
export type PriceType = "fixed" | "negotiable" | "free" | "contact";

export interface Classified {
  id: number;
  userId: number | null;
  categoryId: number | null;
  title: string;
  description: string;
  price: number | null;
  priceType: PriceType | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  location: string | null;
  imageUrl: string | null;
  isSpecial: boolean;
  expiresAt: Date | null;
  approvalStatus: ApprovalStatus;
  viewCount: number;
  isActive: boolean;
  createdAt: Date;
}

export interface ClassifiedCategory {
  id: number;
  name: string;
  slug: string;
  displayOrder: number;
}

// Event types
export type EventType = "community" | "shul" | "shiur" | "special";

export interface Event {
  id: number;
  userId: number | null;
  shulId: number | null;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date | null;
  isAllDay: boolean;
  eventType: EventType | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  cost: string | null;
  imageUrl: string | null;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  createdAt: Date;
}

// Shiur types
export type ShiurLevel = "beginner" | "intermediate" | "advanced";
export type Gender = "men" | "women" | "mixed";

export interface Shiur {
  id: number;
  shulId: number | null;
  teacherName: string;
  title: string;
  topic: string | null;
  description: string | null;
  location: string | null;
  dayOfWeek: number;
  time: string;
  duration: number | null;
  level: ShiurLevel | null;
  gender: Gender | null;
  cost: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
}

// Ask The Rabbi
export interface AskTheRabbi {
  id: number;
  questionNumber: number | null;
  title: string;
  question: string;
  answer: string | null;
  category: string | null;
  answeredBy: string;
  isPublished: boolean;
  publishedAt: Date | null;
  viewCount: number;
}

// Simcha types
export type SimchaTypeName = "birth" | "engagement" | "wedding" | "bar-mitzvah" | "bat-mitzvah";

export interface SimchaType {
  id: number;
  name: string;
  slug: SimchaTypeName;
  displayOrder: number;
}

export interface Simcha {
  id: number;
  userId: number | null;
  typeId: number;
  familyName: string;
  announcement: string;
  eventDate: Date | null;
  location: string | null;
  photoUrl: string | null;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  createdAt: Date;
  type?: SimchaType;
}

// Shiva notification
export interface ShivaNotification {
  id: number;
  userId: number | null;
  niftarName: string;
  niftarNameHebrew: string | null;
  mournerNames: string[];
  shivaAddress: string | null;
  shivaStart: Date;
  shivaEnd: Date;
  shivaHours: string | null;
  mealInfo: string | null;
  donationInfo: string | null;
  contactPhone: string | null;
  approvalStatus: ApprovalStatus;
  createdAt: Date;
}

// Alert types
export type AlertType = "bulletin" | "kosher" | "shiva" | "general";
export type AlertUrgency = "low" | "normal" | "high" | "urgent";

export interface Alert {
  id: number;
  userId: number | null;
  alertType: AlertType;
  title: string;
  content: string;
  urgency: AlertUrgency;
  isPinned: boolean;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface KosherAlert {
  id: number;
  productName: string;
  brand: string | null;
  alertType: string | null;
  description: string;
  certifyingAgency: string | null;
  effectiveDate: Date | null;
  isActive: boolean;
  createdAt: Date;
}

// Tehillim
export interface TehillimEntry {
  id: number;
  userId: number | null;
  hebrewName: string;
  englishName: string | null;
  motherHebrewName: string | null;
  reason: string | null;
  isActive: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

// Eruv
export interface EruvStatus {
  id: number;
  statusDate: Date;
  isUp: boolean;
  message: string | null;
  updatedBy: number | null;
  updatedAt: Date;
}

// Important numbers
export interface ImportantNumber {
  id: number;
  category: string | null;
  name: string;
  phone: string;
  description: string | null;
  isEmergency: boolean;
  displayOrder: number;
}

// Zmanim types
export interface ZmanimData {
  date: string;
  hebrewDate: string;
  parsha: string | null;
  zmanim: {
    alotHaShachar: Date;
    misheyakir: Date;
    sunrise: Date;
    sofZmanShma: Date;
    sofZmanTfilla: Date;
    chatzot: Date;
    minchaGedola: Date;
    minchaKetana: Date;
    plagHaMincha: Date;
    sunset: Date;
    tzait: Date;
    tzait72: Date;
  };
  candleLighting: Date | null;
  havdalah: Date | null;
}

// Subscription types
export interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  maxListings: number;
  maxPhotos: number;
  isFeatured: boolean;
  stripePriceMonthly: string | null;
  stripePriceYearly: string | null;
  isActive: boolean;
}

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}
