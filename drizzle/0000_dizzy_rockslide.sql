CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"alert_type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"urgency" varchar(20) DEFAULT 'normal',
	"is_pinned" boolean DEFAULT false,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ask_the_rabbi" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_number" integer,
	"title" varchar(255) NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"category" varchar(100),
	"answered_by" varchar(200) DEFAULT 'Hagaon Rav Shlomo Miller Shlit''a',
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"view_count" integer DEFAULT 0,
	"old_blog_entry_id" integer,
	CONSTRAINT "ask_the_rabbi_question_number_unique" UNIQUE("question_number")
);
--> statement-breakpoint
CREATE TABLE "business_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"parent_id" integer,
	"description" text,
	"icon" varchar(50),
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"old_id" integer,
	CONSTRAINT "business_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "business_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer,
	"photo_url" varchar(500) NOT NULL,
	"caption" varchar(200),
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "business_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer,
	"plan_id" integer,
	"stripe_subscription_id" varchar(100),
	"stripe_customer_id" varchar(100),
	"status" varchar(20) DEFAULT 'active',
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"category_id" integer,
	"description" text,
	"address" varchar(500),
	"city" varchar(100) DEFAULT 'Toronto',
	"postal_code" varchar(20),
	"phone" varchar(40),
	"email" varchar(255),
	"website" varchar(255),
	"logo_url" varchar(500),
	"hours" jsonb,
	"social_links" jsonb,
	"is_kosher" boolean DEFAULT false,
	"kosher_certification" varchar(100),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"approval_status" varchar(20) DEFAULT 'pending',
	"is_featured" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"old_id" integer,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "classified_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"display_order" integer DEFAULT 0,
	"old_id" integer,
	CONSTRAINT "classified_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "classifieds" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"category_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"price" numeric(10, 2),
	"price_type" varchar(20),
	"contact_name" varchar(100),
	"contact_email" varchar(255),
	"contact_phone" varchar(40),
	"location" varchar(200),
	"image_url" varchar(500),
	"is_special" boolean DEFAULT false,
	"expires_at" timestamp,
	"approval_status" varchar(20) DEFAULT 'pending',
	"view_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"old_id" integer
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(40),
	"subject" varchar(200),
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'new',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "davening_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"shul_id" integer,
	"tefilah_type" varchar(50),
	"day_of_week" integer,
	"time" time NOT NULL,
	"notes" varchar(200),
	"is_winter" boolean DEFAULT true,
	"is_summer" boolean DEFAULT true,
	"is_shabbos" boolean DEFAULT false,
	"old_id" integer
);
--> statement-breakpoint
CREATE TABLE "email_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(50),
	"last_name" varchar(50),
	"kosher_alerts" boolean DEFAULT false,
	"eruv_status" boolean DEFAULT false,
	"simchas" boolean DEFAULT false,
	"shiva" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"old_member_id" integer,
	CONSTRAINT "email_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "eruv_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"status_date" date NOT NULL,
	"is_up" boolean NOT NULL,
	"message" varchar(500),
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "eruv_status_status_date_unique" UNIQUE("status_date")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"shul_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" varchar(500),
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"is_all_day" boolean DEFAULT false,
	"event_type" varchar(50),
	"contact_name" varchar(100),
	"contact_email" varchar(255),
	"contact_phone" varchar(40),
	"cost" varchar(150),
	"image_url" varchar(500),
	"approval_status" varchar(20) DEFAULT 'approved',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"old_id" integer
);
--> statement-breakpoint
CREATE TABLE "important_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(100),
	"name" varchar(200) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"description" varchar(500),
	"is_emergency" boolean DEFAULT false,
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "kosher_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"brand" varchar(200),
	"alert_type" varchar(50),
	"description" text NOT NULL,
	"certifying_agency" varchar(200),
	"effective_date" date,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "shiurim" (
	"id" serial PRIMARY KEY NOT NULL,
	"shul_id" integer,
	"teacher_name" varchar(200) NOT NULL,
	"title" varchar(255) NOT NULL,
	"topic" varchar(200),
	"description" text,
	"location" varchar(500),
	"day_of_week" integer NOT NULL,
	"time" time NOT NULL,
	"duration" integer,
	"level" varchar(50),
	"gender" varchar(20),
	"cost" varchar(100),
	"contact_phone" varchar(40),
	"contact_email" varchar(255),
	"is_active" boolean DEFAULT true,
	"old_id" integer
);
--> statement-breakpoint
CREATE TABLE "shiva_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"niftar_name" varchar(200) NOT NULL,
	"niftar_name_hebrew" varchar(200),
	"mourner_names" jsonb,
	"shiva_address" varchar(500),
	"shiva_start" date NOT NULL,
	"shiva_end" date NOT NULL,
	"shiva_hours" varchar(200),
	"meal_info" text,
	"donation_info" text,
	"contact_phone" varchar(40),
	"approval_status" varchar(20) DEFAULT 'approved',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shuls" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer,
	"rabbi" varchar(200),
	"denomination" varchar(50),
	"nusach" varchar(50),
	"has_minyan" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "simcha_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"display_order" integer,
	CONSTRAINT "simcha_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "simchas" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type_id" integer,
	"family_name" varchar(200) NOT NULL,
	"announcement" text NOT NULL,
	"event_date" date,
	"location" varchar(200),
	"photo_url" varchar(500),
	"approval_status" varchar(20) DEFAULT 'pending',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" text,
	"price_monthly" numeric(10, 2),
	"price_yearly" numeric(10, 2),
	"max_listings" integer DEFAULT 1,
	"max_photos" integer DEFAULT 5,
	"is_featured" boolean DEFAULT false,
	"stripe_price_monthly" varchar(100),
	"stripe_price_yearly" varchar(100),
	"is_active" boolean DEFAULT true,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tehillim_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"hebrew_name" varchar(200) NOT NULL,
	"english_name" varchar(200),
	"mother_hebrew_name" varchar(200),
	"reason" varchar(200),
	"is_active" boolean DEFAULT true,
	"expires_at" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone" varchar(20),
	"image" varchar(500),
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"email_verified" timestamp,
	"is_active" boolean DEFAULT true,
	"is_trusted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_categories" ADD CONSTRAINT "business_categories_parent_id_business_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."business_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_photos" ADD CONSTRAINT "business_photos_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_category_id_business_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."business_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifieds" ADD CONSTRAINT "classifieds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifieds" ADD CONSTRAINT "classifieds_category_id_classified_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."classified_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "davening_schedules" ADD CONSTRAINT "davening_schedules_shul_id_shuls_id_fk" FOREIGN KEY ("shul_id") REFERENCES "public"."shuls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eruv_status" ADD CONSTRAINT "eruv_status_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_shul_id_shuls_id_fk" FOREIGN KEY ("shul_id") REFERENCES "public"."shuls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiurim" ADD CONSTRAINT "shiurim_shul_id_shuls_id_fk" FOREIGN KEY ("shul_id") REFERENCES "public"."shuls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiva_notifications" ADD CONSTRAINT "shiva_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuls" ADD CONSTRAINT "shuls_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simchas" ADD CONSTRAINT "simchas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simchas" ADD CONSTRAINT "simchas_type_id_simcha_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."simcha_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tehillim_list" ADD CONSTRAINT "tehillim_list_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_provider_account_id" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "idx_ask_rabbi_number" ON "ask_the_rabbi" USING btree ("question_number");--> statement-breakpoint
CREATE INDEX "idx_businesses_category" ON "businesses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_businesses_approval" ON "businesses" USING btree ("approval_status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_businesses_slug" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_classifieds_category" ON "classifieds" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_davening_shul" ON "davening_schedules" USING btree ("shul_id");--> statement-breakpoint
CREATE INDEX "idx_events_start" ON "events" USING btree ("start_time");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_tokens_identifier_token" ON "verification_tokens" USING btree ("identifier","token");