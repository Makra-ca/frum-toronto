import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
  date,
  time,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// USERS & AUTH
// ============================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }), // Nullable for OAuth users
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  image: varchar("image", { length: 500 }), // OAuth profile picture
  role: varchar("role", { length: 20 }).default("member").notNull(), // admin, business, content_contributor, member
  emailVerified: timestamp("email_verified"), // Changed to timestamp for NextAuth
  isActive: boolean("is_active").default(true),
  isTrusted: boolean("is_trusted").default(false), // Legacy - kept for backwards compatibility
  // Per-field auto-approve permissions
  canAutoApproveShiva: boolean("can_auto_approve_shiva").default(false),
  canAutoApproveTehillim: boolean("can_auto_approve_tehillim").default(false),
  canAutoApproveBusinesses: boolean("can_auto_approve_businesses").default(false),
  canAutoApproveAskTheRabbi: boolean("can_auto_approve_ask_the_rabbi").default(false),
  canAutoApproveKosherAlerts: boolean("can_auto_approve_kosher_alerts").default(false),
  canAutoApproveShuls: boolean("can_auto_approve_shuls").default(false),
  canAutoApproveSimchas: boolean("can_auto_approve_simchas").default(false),
  canAutoApproveEvents: boolean("can_auto_approve_events").default(false),
  canAutoApproveClassifieds: boolean("can_auto_approve_classifieds").default(false),
  canAutoApproveShiurim: boolean("can_auto_approve_shiurim").default(false),
  canPostSpecials: boolean("can_post_specials").default(false), // Verified businesses can post specials/deals
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// NEXTAUTH TABLES
// ============================================

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  id_token: text("id_token"),
  session_state: varchar("session_state", { length: 255 }),
}, (table) => [
  uniqueIndex("accounts_provider_provider_account_id").on(table.provider, table.providerAccountId),
]);

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: varchar("identifier", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
}, (table) => [
  uniqueIndex("verification_tokens_identifier_token").on(table.identifier, table.token),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// BUSINESS DIRECTORY
// ============================================

export const businessCategories = pgTable("business_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  slug: varchar("slug", { length: 150 }).notNull().unique(),
  parentId: integer("parent_id").references((): AnyPgColumn => businessCategories.id),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  imageUrl: varchar("image_url", { length: 500 }), // Category hero image URL
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  oldId: integer("old_id"), // migration mapping
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }),
  // Feature limits
  maxCategories: integer("max_categories").default(1),
  maxPhotos: integer("max_photos").default(0),
  // Feature toggles - what this plan allows
  showDescription: boolean("show_description").default(false),
  showContactName: boolean("show_contact_name").default(false),
  showEmail: boolean("show_email").default(false),
  showWebsite: boolean("show_website").default(false),
  showHours: boolean("show_hours").default(false),
  showMap: boolean("show_map").default(false),
  showLogo: boolean("show_logo").default(false),
  showSocialLinks: boolean("show_social_links").default(false),
  showKosherBadge: boolean("show_kosher_badge").default(false),
  isFeatured: boolean("is_featured").default(false),
  priorityInSearch: boolean("priority_in_search").default(false),
  // PayPal integration - Live
  paypalPlanIdMonthly: varchar("paypal_plan_id_monthly", { length: 100 }),
  paypalPlanIdYearly: varchar("paypal_plan_id_yearly", { length: 100 }),
  // PayPal integration - Sandbox
  paypalPlanIdMonthlySandbox: varchar("paypal_plan_id_monthly_sandbox", { length: 100 }),
  paypalPlanIdYearlySandbox: varchar("paypal_plan_id_yearly_sandbox", { length: 100 }),
  // Display order for pricing page
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  subscriptionPlanId: integer("subscription_plan_id").references(() => subscriptionPlans.id),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  categoryId: integer("category_id").references(() => businessCategories.id),
  // Additional categories for paid plans (JSONB array of category IDs)
  additionalCategoryIds: jsonb("additional_category_ids"),
  description: text("description"),
  contactName: varchar("contact_name", { length: 100 }),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }).default("Toronto"),
  postalCode: varchar("postal_code", { length: 20 }),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  hours: jsonb("hours"), // {monday: {open: "9:00", close: "17:00"}, ...}
  socialLinks: jsonb("social_links"),
  isKosher: boolean("is_kosher").default(false),
  kosherCertification: varchar("kosher_certification", { length: 100 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  approvalStatus: varchar("approval_status", { length: 20 }).default("pending"),
  isFeatured: boolean("is_featured").default(false),
  viewCount: integer("view_count").default(0),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  oldId: integer("old_id"), // migration mapping
}, (table) => [
  index("idx_businesses_category").on(table.categoryId),
  index("idx_businesses_approval").on(table.approvalStatus),
  index("idx_businesses_subscription").on(table.subscriptionPlanId),
  uniqueIndex("idx_businesses_slug").on(table.slug),
]);

export const businessPhotos = pgTable("business_photos", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id, { onDelete: "cascade" }),
  photoUrl: varchar("photo_url", { length: 500 }).notNull(),
  caption: varchar("caption", { length: 200 }),
  displayOrder: integer("display_order").default(0),
});

export const businessSubscriptions = pgTable("business_subscriptions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id, { onDelete: "cascade" }),
  planId: integer("plan_id").references(() => subscriptionPlans.id),
  // PayPal subscription details
  paypalSubscriptionId: varchar("paypal_subscription_id", { length: 100 }),
  paypalPayerId: varchar("paypal_payer_id", { length: 100 }),
  billingCycle: varchar("billing_cycle", { length: 20 }).default("monthly"), // monthly or yearly
  // Subscription status
  status: varchar("status", { length: 20 }).default("pending"), // pending, active, cancelled, expired
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// SHULS
// ============================================

export const shuls = pgTable("shuls", {
  id: serial("id").primaryKey(),
  // Core fields (replaces businessId dependency)
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  description: text("description"),
  // Location
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }).default("Toronto"),
  postalCode: varchar("postal_code", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  // Contact
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  // Shul-specific
  rabbi: varchar("rabbi", { length: 200 }),
  denomination: varchar("denomination", { length: 50 }), // Orthodox, Modern Orthodox, Chabad, etc.
  nusach: varchar("nusach", { length: 50 }), // Ashkenaz, Sefard, Ari, etc.
  hasMinyan: boolean("has_minyan").default(true),
  logoUrl: varchar("logo_url", { length: 500 }),
  // Status
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_shuls_slug").on(table.slug),
]);

export const daveningSchedules = pgTable("davening_schedules", {
  id: serial("id").primaryKey(),
  shulId: integer("shul_id").references(() => shuls.id, { onDelete: "cascade" }),
  tefilahType: varchar("tefilah_type", { length: 50 }), // shacharis, mincha, maariv
  dayOfWeek: integer("day_of_week"), // 0=Sun, 6=Sat, NULL=daily
  time: time("time").notNull(),
  notes: varchar("notes", { length: 200 }),
  isWinter: boolean("is_winter").default(true),
  isSummer: boolean("is_summer").default(true),
  isShabbos: boolean("is_shabbos").default(false),
  oldId: integer("old_id"),
}, (table) => [
  index("idx_davening_shul").on(table.shulId),
]);

// User-Shul assignments (for shul managers)
export const userShuls = pgTable("user_shuls", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shulId: integer("shul_id").notNull().references(() => shuls.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: integer("assigned_by").references(() => users.id),
}, (table) => [
  uniqueIndex("idx_user_shuls_unique").on(table.userId, table.shulId),
  index("idx_user_shuls_user").on(table.userId),
  index("idx_user_shuls_shul").on(table.shulId),
]);

// Shul registration requests (users requesting to manage shuls)
export const shulRegistrationRequests = pgTable("shul_registration_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shulId: integer("shul_id").notNull().references(() => shuls.id, { onDelete: "cascade" }),
  message: text("message"), // Optional message from user explaining their connection
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, approved, rejected
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_shul_requests_status").on(table.status),
  index("idx_shul_requests_user").on(table.userId),
]);

// ============================================
// CLASSIFIEDS
// ============================================

export const classifiedCategories = pgTable("classified_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  slug: varchar("slug", { length: 150 }).notNull().unique(),
  displayOrder: integer("display_order").default(0),
  oldId: integer("old_id"),
});

export const classifieds = pgTable("classifieds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  categoryId: integer("category_id").references(() => classifiedCategories.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  priceType: varchar("price_type", { length: 20 }), // fixed, negotiable, free
  contactName: varchar("contact_name", { length: 100 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 40 }),
  location: varchar("location", { length: 200 }),
  imageUrl: varchar("image_url", { length: 500 }),
  isSpecial: boolean("is_special").default(false),
  expiresAt: timestamp("expires_at"),
  approvalStatus: varchar("approval_status", { length: 20 }).default("pending"),
  viewCount: integer("view_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  oldId: integer("old_id"),
}, (table) => [
  index("idx_classifieds_category").on(table.categoryId),
]);

// ============================================
// SPECIALS / DEALS (Business Flyers)
// ============================================

export const specials = pgTable("specials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Who submitted
  businessId: integer("business_id").references(() => businesses.id, { onDelete: "cascade" }), // Associated business
  title: varchar("title", { length: 255 }).notNull(), // e.g., "Weekly Flyer Feb 20-27"
  description: text("description"), // Optional description
  fileUrl: varchar("file_url", { length: 500 }).notNull(), // PDF or image URL
  fileType: varchar("file_type", { length: 20 }).notNull(), // pdf, png, jpg, jpeg
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  approvalStatus: varchar("approval_status", { length: 20 }).default("pending"), // pending, approved, rejected
  viewCount: integer("view_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_specials_business").on(table.businessId),
  index("idx_specials_dates").on(table.startDate, table.endDate),
  index("idx_specials_approval").on(table.approvalStatus),
]);

// ============================================
// EVENTS & SHIURIM
// ============================================

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  shulId: integer("shul_id").references(() => shuls.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 500 }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  isAllDay: boolean("is_all_day").default(false),
  eventType: varchar("event_type", { length: 50 }), // community, shul, shiur
  contactName: varchar("contact_name", { length: 100 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 40 }),
  cost: varchar("cost", { length: 150 }),
  imageUrl: varchar("image_url", { length: 500 }),
  approvalStatus: varchar("approval_status", { length: 20 }).default("approved"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  oldId: integer("old_id"),
}, (table) => [
  index("idx_events_start").on(table.startTime),
]);

export const shiurim = pgTable("shiurim", {
  id: serial("id").primaryKey(),
  // Teacher info
  teacherTitle: varchar("teacher_title", { length: 20 }), // Rabbi, Harav, Rav, etc.
  teacherFirstName: varchar("teacher_first_name", { length: 100 }),
  teacherLastName: varchar("teacher_last_name", { length: 100 }),
  teacherName: varchar("teacher_name", { length: 200 }).notNull(), // Kept for backward compatibility
  // Basic info
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  // Location - either shul reference or custom location
  shulId: integer("shul_id").references(() => shuls.id),
  locationName: varchar("location_name", { length: 200 }), // Custom location name
  locationAddress: varchar("location_address", { length: 500 }),
  locationPostalCode: varchar("location_postal_code", { length: 20 }),
  locationArea: varchar("location_area", { length: 50 }), // Down Town, Bathurst & Eglinton, etc.
  location: varchar("location", { length: 500 }), // Legacy field
  // Schedule
  schedule: jsonb("schedule"), // {0: {start: "09:00", end: "10:00", notes: ""}, 1: {...}, ...}
  startDate: date("start_date"),
  endDate: date("end_date"),
  dayOfWeek: integer("day_of_week"), // Legacy - single day
  time: time("time"), // Legacy - single time
  duration: integer("duration"), // minutes (legacy)
  // Classification
  category: varchar("category", { length: 100 }), // Daf Yomi, Halacha, Parsha, etc.
  classType: varchar("class_type", { length: 50 }), // Shiur, lecture, group, Chavrusa
  level: varchar("level", { length: 50 }), // All, Beginner, Intermediate, Advanced
  gender: varchar("gender", { length: 20 }), // Everyone, Men, Women
  // Contact info
  contactName: varchar("contact_name", { length: 100 }),
  contactPhone: varchar("contact_phone", { length: 40 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  // Additional
  cost: varchar("cost", { length: 100 }),
  projectOf: varchar("project_of", { length: 200 }), // Sponsoring organization
  submitterEmail: varchar("submitter_email", { length: 255 }),
  isOnHold: boolean("is_on_hold").default(false),
  isActive: boolean("is_active").default(true),
  approvalStatus: varchar("approval_status", { length: 20 }).default("approved"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  oldId: integer("old_id"),
});

// ============================================
// ASK THE RABBI
// ============================================

export const askTheRabbi = pgTable("ask_the_rabbi", {
  id: serial("id").primaryKey(),
  questionNumber: integer("question_number").unique(), // #5699
  title: varchar("title", { length: 255 }).notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  category: varchar("category", { length: 100 }),
  answeredBy: varchar("answered_by", { length: 200 }).default("Hagaon Rav Shlomo Miller Shlit'a"),
  imageUrl: varchar("image_url", { length: 500 }),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  viewCount: integer("view_count").default(0),
  oldBlogEntryId: integer("old_blog_entry_id"),
}, (table) => [
  index("idx_ask_rabbi_number").on(table.questionNumber),
]);

// ============================================
// SIMCHAS
// ============================================

export const simchaTypes = pgTable("simcha_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  displayOrder: integer("display_order"),
});

export const simchas = pgTable("simchas", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  typeId: integer("type_id").references(() => simchaTypes.id),
  familyName: varchar("family_name", { length: 200 }).notNull(),
  announcement: text("announcement").notNull(),
  eventDate: date("event_date"),
  location: varchar("location", { length: 200 }),
  photoUrl: varchar("photo_url", { length: 500 }),
  approvalStatus: varchar("approval_status", { length: 20 }).default("pending"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// SHIVA NOTIFICATIONS
// ============================================

export const shivaNotifications = pgTable("shiva_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  niftarName: varchar("niftar_name", { length: 200 }).notNull(),
  niftarNameHebrew: varchar("niftar_name_hebrew", { length: 200 }),
  mournerNames: jsonb("mourner_names"), // array of names
  shivaAddress: varchar("shiva_address", { length: 500 }),
  shivaStart: date("shiva_start").notNull(),
  shivaEnd: date("shiva_end").notNull(),
  shivaHours: varchar("shiva_hours", { length: 200 }),
  mealInfo: text("meal_info"),
  donationInfo: text("donation_info"),
  contactPhone: varchar("contact_phone", { length: 40 }),
  approvalStatus: varchar("approval_status", { length: 20 }).default("approved"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// ALERTS
// ============================================

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  alertType: varchar("alert_type", { length: 50 }).notNull(), // bulletin, kosher, general
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  urgency: varchar("urgency", { length: 20 }).default("normal"),
  isPinned: boolean("is_pinned").default(false),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const kosherAlerts = pgTable("kosher_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Who submitted (null for admin-created)
  productName: varchar("product_name", { length: 200 }).notNull(),
  brand: varchar("brand", { length: 200 }),
  alertType: varchar("alert_type", { length: 50 }), // recall, status_change, warning, update
  description: text("description").notNull(),
  certifyingAgency: varchar("certifying_agency", { length: 200 }),
  effectiveDate: date("effective_date"),
  issueDate: date("issue_date"), // When the issue began
  approvalStatus: varchar("approval_status", { length: 20 }).default("pending"), // pending, approved, rejected
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// TEHILLIM & ERUV
// ============================================

export const tehillimList = pgTable("tehillim_list", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  hebrewName: varchar("hebrew_name", { length: 200 }),
  englishName: varchar("english_name", { length: 200 }),
  motherHebrewName: varchar("mother_hebrew_name", { length: 200 }),
  reason: varchar("reason", { length: 200 }),
  isActive: boolean("is_active").default(true),
  approvalStatus: varchar("approval_status", { length: 20 }).default("pending"),
  expiresAt: date("expires_at"),
  isPermanent: boolean("is_permanent").default(false), // Admin can set to never expire
  createdAt: timestamp("created_at").defaultNow(),
});

export const eruvStatus = pgTable("eruv_status", {
  id: serial("id").primaryKey(),
  statusDate: date("status_date").notNull().unique(),
  isUp: boolean("is_up").notNull(),
  message: varchar("message", { length: 500 }),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// MISC
// ============================================

export const importantNumbers = pgTable("important_numbers", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 100 }),
  name: varchar("name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  description: varchar("description", { length: 500 }),
  isEmergency: boolean("is_emergency").default(false),
  displayOrder: integer("display_order").default(0),
});

export const emailSubscribers = pgTable("email_subscribers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }), // Link to user account
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }),
  kosherAlerts: boolean("kosher_alerts").default(false),
  communityAlerts: boolean("community_alerts").default(false), // General community alerts
  eruvStatus: boolean("eruv_status").default(false),
  simchas: boolean("simchas").default(false),
  shiva: boolean("shiva").default(false),
  tehillim: boolean("tehillim").default(false),
  communityEvents: boolean("community_events").default(false),
  newsletter: boolean("newsletter").default(true), // General newsletter subscription
  isActive: boolean("is_active").default(true),
  unsubscribeToken: varchar("unsubscribe_token", { length: 64 }),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  oldMemberId: integer("old_member_id"),
});

export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  subject: varchar("subject", { length: 200 }),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).default("new"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// NEWSLETTERS
// ============================================

export const newsletters = pgTable("newsletters", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  previewText: varchar("preview_text", { length: 200 }),
  content: text("content").notNull(), // HTML content
  contentJson: jsonb("content_json"), // TipTap JSON for editing
  status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, scheduled, sending, sent, failed
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_newsletters_status").on(table.status),
  index("idx_newsletters_scheduled").on(table.scheduledAt),
]);

export const newsletterSegments = pgTable("newsletter_segments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  filterCriteria: jsonb("filter_criteria"), // {kosherAlerts: true, simchas: false, ...}
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const newsletterSends = pgTable("newsletter_sends", {
  id: serial("id").primaryKey(),
  newsletterId: integer("newsletter_id").notNull().references(() => newsletters.id, { onDelete: "cascade" }),
  segmentId: integer("segment_id").references(() => newsletterSegments.id),
  totalRecipients: integer("total_recipients").default(0),
  sentCount: integer("sent_count").default(0),
  failedCount: integer("failed_count").default(0),
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, processing, completed, failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
}, (table) => [
  index("idx_newsletter_sends_newsletter").on(table.newsletterId),
  index("idx_newsletter_sends_status").on(table.status),
]);

export const newsletterRecipientLogs = pgTable("newsletter_recipient_logs", {
  id: serial("id").primaryKey(),
  sendId: integer("send_id").notNull().references(() => newsletterSends.id, { onDelete: "cascade" }),
  subscriberId: integer("subscriber_id").references(() => emailSubscribers.id),
  email: varchar("email", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, sent, failed, bounced
  resendMessageId: varchar("resend_message_id", { length: 100 }),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
}, (table) => [
  index("idx_recipient_logs_send").on(table.sendId),
  index("idx_recipient_logs_subscriber").on(table.subscriberId),
]);

// ============================================
// FORM EMAIL RECIPIENTS (Admin Config)
// ============================================

export const formEmailRecipients = pgTable("form_email_recipients", {
  id: serial("id").primaryKey(),
  formType: varchar("form_type", { length: 50 }).notNull(), // ask_the_rabbi, contact_form, business_registration, etc.
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 200 }), // Optional display name
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_form_recipients_type").on(table.formType),
]);

// ============================================
// ASK THE RABBI SUBMISSIONS (Pending questions from users)
// ============================================

export const askTheRabbiSubmissions = pgTable("ask_the_rabbi_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  question: text("question").notNull(),
  imageUrl: varchar("image_url", { length: 500 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, reviewed, answered, rejected
  adminNotes: text("admin_notes"),
  publishedQuestionId: integer("published_question_id").references(() => askTheRabbi.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
}, (table) => [
  index("idx_rabbi_submissions_status").on(table.status),
  index("idx_rabbi_submissions_user").on(table.userId),
]);

// ============================================
// SITE SETTINGS
// ============================================

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  description: varchar("description", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  classifieds: many(classifieds),
  events: many(events),
  simchas: many(simchas),
  specials: many(specials),
  accounts: many(accounts),
  sessions: many(sessions),
  managedShuls: many(userShuls),
  shulRequests: many(shulRegistrationRequests),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  user: one(users, { fields: [businesses.userId], references: [users.id] }),
  category: one(businessCategories, { fields: [businesses.categoryId], references: [businessCategories.id] }),
  photos: many(businessPhotos),
  subscriptions: many(businessSubscriptions),
  specials: many(specials),
}));

export const specialsRelations = relations(specials, ({ one }) => ({
  user: one(users, { fields: [specials.userId], references: [users.id] }),
  business: one(businesses, { fields: [specials.businessId], references: [businesses.id] }),
}));

export const shulsRelations = relations(shuls, ({ many }) => ({
  daveningSchedules: many(daveningSchedules),
  shiurim: many(shiurim),
  events: many(events),
  managers: many(userShuls),
  registrationRequests: many(shulRegistrationRequests),
}));

export const userShulsRelations = relations(userShuls, ({ one }) => ({
  user: one(users, { fields: [userShuls.userId], references: [users.id] }),
  shul: one(shuls, { fields: [userShuls.shulId], references: [shuls.id] }),
  assignedByUser: one(users, { fields: [userShuls.assignedBy], references: [users.id] }),
}));

export const shulRegistrationRequestsRelations = relations(shulRegistrationRequests, ({ one }) => ({
  user: one(users, { fields: [shulRegistrationRequests.userId], references: [users.id] }),
  shul: one(shuls, { fields: [shulRegistrationRequests.shulId], references: [shuls.id] }),
  reviewer: one(users, { fields: [shulRegistrationRequests.reviewedBy], references: [users.id] }),
}));

// Newsletter relations
export const newslettersRelations = relations(newsletters, ({ one, many }) => ({
  createdByUser: one(users, { fields: [newsletters.createdBy], references: [users.id] }),
  sends: many(newsletterSends),
}));

export const newsletterSegmentsRelations = relations(newsletterSegments, ({ many }) => ({
  sends: many(newsletterSends),
}));

export const newsletterSendsRelations = relations(newsletterSends, ({ one, many }) => ({
  newsletter: one(newsletters, { fields: [newsletterSends.newsletterId], references: [newsletters.id] }),
  segment: one(newsletterSegments, { fields: [newsletterSends.segmentId], references: [newsletterSegments.id] }),
  recipientLogs: many(newsletterRecipientLogs),
}));

export const newsletterRecipientLogsRelations = relations(newsletterRecipientLogs, ({ one }) => ({
  send: one(newsletterSends, { fields: [newsletterRecipientLogs.sendId], references: [newsletterSends.id] }),
  subscriber: one(emailSubscribers, { fields: [newsletterRecipientLogs.subscriberId], references: [emailSubscribers.id] }),
}));

export const emailSubscribersRelations = relations(emailSubscribers, ({ many }) => ({
  recipientLogs: many(newsletterRecipientLogs),
}));
