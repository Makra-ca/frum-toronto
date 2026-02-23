import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function applySchemaChanges() {
  console.log("Applying business subscription schema changes...");

  try {
    // Update subscription_plans table
    console.log("Updating subscription_plans table...");
    await db.execute(sql`
      ALTER TABLE subscription_plans
      ADD COLUMN IF NOT EXISTS max_categories integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS show_description boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS show_contact_name boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS show_email boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS show_website boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS show_hours boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS show_map boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS show_logo boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS show_social_links boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS show_kosher_badge boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS priority_in_search boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS paypal_plan_id_monthly varchar(100),
      ADD COLUMN IF NOT EXISTS paypal_plan_id_yearly varchar(100),
      ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0
    `);

    // Remove old Stripe columns from subscription_plans if they exist
    await db.execute(sql`
      ALTER TABLE subscription_plans
      DROP COLUMN IF EXISTS stripe_price_monthly,
      DROP COLUMN IF EXISTS stripe_price_yearly,
      DROP COLUMN IF EXISTS max_listings
    `);

    // Update businesses table
    console.log("Updating businesses table...");
    await db.execute(sql`
      ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS subscription_plan_id integer REFERENCES subscription_plans(id),
      ADD COLUMN IF NOT EXISTS additional_category_ids jsonb,
      ADD COLUMN IF NOT EXISTS contact_name varchar(100)
    `);

    // Create index on businesses.subscription_plan_id
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_businesses_subscription ON businesses(subscription_plan_id)
    `);

    // Update business_subscriptions table
    console.log("Updating business_subscriptions table...");
    await db.execute(sql`
      ALTER TABLE business_subscriptions
      ADD COLUMN IF NOT EXISTS paypal_subscription_id varchar(100),
      ADD COLUMN IF NOT EXISTS paypal_payer_id varchar(100),
      ADD COLUMN IF NOT EXISTS billing_cycle varchar(20) DEFAULT 'monthly',
      ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()
    `);

    // Remove old Stripe columns from business_subscriptions
    await db.execute(sql`
      ALTER TABLE business_subscriptions
      DROP COLUMN IF EXISTS stripe_subscription_id,
      DROP COLUMN IF EXISTS stripe_customer_id
    `);

    // Insert default subscription plans
    console.log("Inserting default subscription plans...");

    // Check if plans already exist
    const existingPlans = await db.execute(sql`SELECT COUNT(*) as count FROM subscription_plans`);
    const planCount = Number((existingPlans.rows[0] as any).count);

    if (planCount === 0) {
      // Free plan
      await db.execute(sql`
        INSERT INTO subscription_plans (
          name, slug, description, price_monthly, price_yearly,
          max_categories, max_photos,
          show_description, show_contact_name, show_email, show_website,
          show_hours, show_map, show_logo, show_social_links, show_kosher_badge,
          is_featured, priority_in_search, display_order, is_active
        ) VALUES (
          'Free', 'free', 'Basic listing with essential business information',
          0, 0,
          1, 0,
          false, false, false, false,
          false, false, false, false, false,
          false, false, 0, true
        )
      `);

      // Standard plan ($25/mo or $240/yr - 2 months free)
      await db.execute(sql`
        INSERT INTO subscription_plans (
          name, slug, description, price_monthly, price_yearly,
          max_categories, max_photos,
          show_description, show_contact_name, show_email, show_website,
          show_hours, show_map, show_logo, show_social_links, show_kosher_badge,
          is_featured, priority_in_search, display_order, is_active
        ) VALUES (
          'Standard', 'standard', 'Enhanced listing with full contact details and business hours',
          25.00, 240.00,
          3, 3,
          true, true, true, true,
          true, true, true, false, false,
          false, false, 1, true
        )
      `);

      // Premium plan ($65/mo or $650/yr - 2 months free)
      await db.execute(sql`
        INSERT INTO subscription_plans (
          name, slug, description, price_monthly, price_yearly,
          max_categories, max_photos,
          show_description, show_contact_name, show_email, show_website,
          show_hours, show_map, show_logo, show_social_links, show_kosher_badge,
          is_featured, priority_in_search, display_order, is_active
        ) VALUES (
          'Premium', 'premium', 'Featured listing with premium placement and all features',
          65.00, 650.00,
          5, 999,
          true, true, true, true,
          true, true, true, true, true,
          true, true, 2, true
        )
      `);

      console.log("Default plans inserted successfully!");
    } else {
      console.log("Plans already exist, skipping insert.");
    }

    // Set existing businesses to free plan
    console.log("Setting existing businesses to free plan...");
    const freePlan = await db.execute(sql`SELECT id FROM subscription_plans WHERE slug = 'free' LIMIT 1`);
    if (freePlan.rows.length > 0) {
      const freePlanId = (freePlan.rows[0] as any).id;
      await db.execute(sql`
        UPDATE businesses
        SET subscription_plan_id = ${freePlanId}
        WHERE subscription_plan_id IS NULL
      `);
    }

    console.log("Schema changes applied successfully!");
  } catch (error) {
    console.error("Error applying schema changes:", error);
    throw error;
  }
}

applySchemaChanges()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
