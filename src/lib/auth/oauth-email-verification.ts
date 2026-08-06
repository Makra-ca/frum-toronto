import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Records that an OAuth provider vouched for a user's email address.
 *
 * WHY THIS EXISTS
 *
 * The Google provider's `profile()` in auth.ts returns
 * `emailVerified: new Date()`, but Auth.js core discards it —
 * @auth/core/lib/actions/callback/handle-login.js:
 *
 *   user = await createUser({ ...profile, emailVerified: null });
 *
 * Our value goes in with the spread and the explicit null overwrites it, on
 * purpose: to Auth.js, `emailVerified` means "we emailed this address a link
 * and they clicked it", not "an identity provider asserts it is real". It
 * leaves the second decision to us and never signals that it overrode the
 * first.
 *
 * The consequence was not cosmetic. `assertCanPost` (require-verified.ts)
 * refuses every submission from an unverified non-admin, so until this landed
 * anyone who signed up with Google was silently locked out of posting.
 *
 * So the row must be stamped AFTER the adapter has written it. `linkAccount`
 * is the one event that fires on both paths that create a link — a brand new
 * OAuth signup, and an existing session linking a provider — and it fires
 * before the session is issued.
 */
export async function recordOAuthEmailVerification({
  userId,
  provider,
  verifiedAt,
}: {
  userId: string | number;
  provider: string;
  /**
   * When the provider vouched for the address, or null when it did not.
   * Google's OIDC `email_verified` claim can be false; those accounts must
   * still prove the mailbox the normal way rather than walking through the
   * submission gate on an unproven address.
   */
  verifiedAt: Date | null;
}): Promise<boolean> {
  // Password signups prove the mailbox by clicking the link we email them.
  // Nothing about the credentials flow vouches for an address.
  if (provider === "credentials") return false;
  if (!verifiedAt) return false;

  const id = typeof userId === "string" ? Number(userId) : userId;
  if (!Number.isSafeInteger(id)) return false;

  try {
    const updated = await db
      .update(users)
      .set({ emailVerified: verifiedAt })
      // `isNull` is load-bearing: the legacy import stamped ~3,132 accounts
      // with their ORIGINAL signup date, and some of those people later signed
      // in with Google. Overwriting would rewrite history to claim we only
      // learned the address today.
      .where(and(eq(users.id, id), isNull(users.emailVerified)))
      .returning({ id: users.id });

    return updated.length > 0;
  } catch (error) {
    // This runs mid sign-in. A throw here would turn a database update nobody
    // is waiting on into a login outage, so it is logged and swallowed — the
    // user can still fall back to the resend-verification flow.
    console.error("[AUTH] Failed to record OAuth email verification:", error);
    return false;
  }
}
