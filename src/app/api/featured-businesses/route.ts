import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businesses, subscriptionPlans, blogPosts } from "@/lib/db/schema";
import { eq, and, isNotNull, sql, gt } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET - Fetch random featured businesses for homepage ads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placement = searchParams.get("placement"); // "banner" or "sidebar"
    const limit = parseInt(searchParams.get("limit") || "3");
    const include = searchParams.get("include"); // "bloggers" to enable hybrid algorithm

    if (!placement || !["banner", "sidebar"].includes(placement)) {
      return NextResponse.json(
        { error: "Invalid placement. Must be 'banner' or 'sidebar'" },
        { status: 400 }
      );
    }

    // Determine which column to filter on
    const placementColumn =
      placement === "banner"
        ? subscriptionPlans.showInHomepageBanner
        : subscriptionPlans.showInHomepageSidebar;

    // -----------------------------------------------
    // Standard path (no ?include=bloggers)
    // -----------------------------------------------
    if (include !== "bloggers") {
      const featuredBusinesses = await db
        .select({
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          tagline: businesses.tagline,
          bannerImageUrl: businesses.bannerImageUrl,
          logoUrl: businesses.logoUrl,
        })
        .from(businesses)
        .innerJoin(
          subscriptionPlans,
          eq(businesses.subscriptionPlanId, subscriptionPlans.id)
        )
        .where(
          and(
            eq(businesses.approvalStatus, "approved"),
            eq(businesses.isActive, true),
            eq(placementColumn, true),
            isNotNull(businesses.bannerImageUrl)
          )
        )
        .orderBy(sql`RANDOM()`)
        .limit(limit);

      return NextResponse.json({
        businesses: featuredBusinesses,
        placement,
      });
    }

    // -----------------------------------------------
    // Hybrid path (?include=bloggers)
    // 2 paid slots + 1 blog-active slot
    // -----------------------------------------------

    // Step 1: Fetch up to 2 paid businesses
    const paidBusinesses = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        tagline: businesses.tagline,
        bannerImageUrl: businesses.bannerImageUrl,
        logoUrl: businesses.logoUrl,
      })
      .from(businesses)
      .innerJoin(
        subscriptionPlans,
        eq(businesses.subscriptionPlanId, subscriptionPlans.id)
      )
      .where(
        and(
          eq(businesses.approvalStatus, "approved"),
          eq(businesses.isActive, true),
          eq(placementColumn, true),
          isNotNull(businesses.bannerImageUrl)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(2);

    // Step 2: Find most recently blog-active business
    // A business qualifies if its owner published an approved post in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentBloggerRows = await db
      .selectDistinct({ userId: blogPosts.authorId })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.approvalStatus, "approved"),
          eq(blogPosts.isActive, true),
          gt(blogPosts.publishedAt, thirtyDaysAgo)
        )
      );

    type BusinessRow = (typeof paidBusinesses)[0];
    let blogActiveBusiness: BusinessRow | null = null;

    if (recentBloggerRows.length > 0) {
      const bloggerUserIds = recentBloggerRows.map((r) => r.userId);
      const paidIds = paidBusinesses.map((b) => b.id);

      // Build exclusion clause only when there are already-selected paid businesses
      const exclusionClause =
        paidIds.length > 0
          ? sql`${businesses.id} NOT IN (${sql.join(
              paidIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          : sql`true`;

      const [candidate] = await db
        .select({
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          tagline: businesses.tagline,
          bannerImageUrl: businesses.bannerImageUrl,
          logoUrl: businesses.logoUrl,
        })
        .from(businesses)
        .where(
          and(
            eq(businesses.approvalStatus, "approved"),
            eq(businesses.isActive, true),
            isNotNull(businesses.bannerImageUrl),
            sql`${businesses.userId} = ANY(ARRAY[${sql.join(
              bloggerUserIds.map((id) => sql`${id}`),
              sql`, `
            )}]::integer[])`,
            exclusionClause
          )
        )
        .orderBy(sql`RANDOM()`)
        .limit(1);

      blogActiveBusiness = candidate ?? null;
    }

    // Step 3: Assemble final list
    let result: BusinessRow[] = [...paidBusinesses];

    if (blogActiveBusiness) {
      result.push(blogActiveBusiness);
    } else if (result.length < limit) {
      // No blog-active business — fill remaining slots with more paid businesses
      const paidIds = result.map((b) => b.id);
      const exclusionClause =
        paidIds.length > 0
          ? sql`${businesses.id} NOT IN (${sql.join(
              paidIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          : sql`true`;

      const extraPaid = await db
        .select({
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          tagline: businesses.tagline,
          bannerImageUrl: businesses.bannerImageUrl,
          logoUrl: businesses.logoUrl,
        })
        .from(businesses)
        .innerJoin(
          subscriptionPlans,
          eq(businesses.subscriptionPlanId, subscriptionPlans.id)
        )
        .where(
          and(
            eq(businesses.approvalStatus, "approved"),
            eq(businesses.isActive, true),
            eq(placementColumn, true),
            isNotNull(businesses.bannerImageUrl),
            exclusionClause
          )
        )
        .orderBy(sql`RANDOM()`)
        .limit(limit - result.length);

      result = [...result, ...extraPaid];
    }

    // Shuffle so the blog-active slot isn't always last
    result = result.sort(() => Math.random() - 0.5);

    return NextResponse.json({
      businesses: result,
      placement,
      blogger: blogActiveBusiness,
    });
  } catch (error) {
    console.error("Error fetching featured businesses:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured businesses" },
      { status: 500 }
    );
  }
}
