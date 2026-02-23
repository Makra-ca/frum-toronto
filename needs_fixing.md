# Things That Need Fixing

## Business Subscription Perks - Featured on Homepage

### Issue 1: Homepage doesn't filter by isFeatured
**File:** `src/components/home/FeaturedBusinesses.tsx`

The "Featured Businesses" section on the homepage currently shows the top 4 most-viewed businesses regardless of subscription tier. It should only show businesses where `isFeatured = true`.

**Current code (line 29-33):**
```typescript
.where(and(
  eq(businesses.isActive, true),
  eq(businesses.approvalStatus, "approved")
))
.orderBy(desc(businesses.viewCount))
```

**Fix:** Add `eq(businesses.isFeatured, true)` to the where clause.

---

### Issue 2: PayPal webhook doesn't sync isFeatured flag
**File:** `src/app/api/paypal/webhook/route.ts`

When a business subscribes to a Premium plan (which has `isFeatured: true`), the webhook updates `subscriptionPlanId` but never copies the `isFeatured` flag from the plan to the business.

**In `handleSubscriptionActivated` (line 229-235):**
```typescript
await db
  .update(businesses)
  .set({
    subscriptionPlanId: plan.id,
    // MISSING: isFeatured: plan.isFeatured === true
  })
```

**Also need to update:**
- `handleSubscriptionCancelled` - set `isFeatured: false` when downgrading to free
- `handleSubscriptionExpired` - set `isFeatured: false` when downgrading to free

---

## Summary
The "Featured on homepage" perk for Premium subscribers doesn't work because:
1. The flag never gets set when they subscribe
2. The homepage doesn't filter by the flag anyway
