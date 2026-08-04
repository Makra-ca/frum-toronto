import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loadUserClaims } from "@/lib/auth/user-claims";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";

// Create adapter with type workaround for version mismatch and custom user schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = (DrizzleAdapter as any)(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers, check if existing user is banned
      if (account?.provider && account.provider !== "credentials" && user.email) {
        const [existingUser] = await db
          .select({ isActive: users.isActive })
          .from(users)
          .where(eq(users.email, user.email.toLowerCase()))
          .limit(1);

        // Block if user exists and is banned
        if (existingUser && existingUser.isActive === false) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        // For OAuth users, fetch role from database since profile() always returns "member"
        // For credentials, user.role is already correct from the authorize() callback
        if (user.email) {
          const [dbUser] = await db
            .select({ role: users.role, isTrusted: users.isTrusted, canManageAskTheRabbi: users.canManageAskTheRabbi })
            .from(users)
            .where(eq(users.email, user.email.toLowerCase()))
            .limit(1);
          if (dbUser) {
            token.role = dbUser.role;
            token.isTrusted = dbUser.isTrusted ?? false;
            token.canManageAskTheRabbi = dbUser.canManageAskTheRabbi ?? false;
          } else {
            token.role = user.role;
            token.isTrusted = user.isTrusted;
            token.canManageAskTheRabbi = false;
          }
        } else {
          token.role = user.role;
          token.isTrusted = user.isTrusted;
          token.canManageAskTheRabbi = false;
        }
      }
      // Handle session updates.
      //
      // SECURITY: NextAuth also passes a `session` argument here, holding
      // whatever the CLIENT posted to /api/auth/session. It is deliberately not
      // destructured above — there is no safe use for it. Trusting it
      // let any logged-in account POST {"data":{"role":"admin"}} and become an
      // admin: verified by exploit on 2026-08-04, /admin went 307 -> 200 and
      // /api/admin/users returned 200 for a plain member.
      //
      // So the payload is ignored entirely. An update re-reads the claims from
      // the database, which is what makes update() useful (a role granted while
      // someone is logged in can be picked up without re-authenticating) while
      // making the client's opinion irrelevant.
      if (trigger === "update" && token.id) {
        const claims = await loadUserClaims({ id: token.id });
        if (claims) {
          token.role = claims.role;
          token.isTrusted = claims.isTrusted;
          token.canManageAskTheRabbi = claims.canManageAskTheRabbi;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.isTrusted = token.isTrusted;
        session.user.canManageAskTheRabbi = token.canManageAskTheRabbi;
      }
      return session;
    },
    ...authConfig.callbacks,
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: new Date(), // Google already verified the email
          role: "member",
          isTrusted: false,
        };
      },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Normalize email to lowercase for case-insensitive login
        const normalizedEmail = (credentials.email as string).toLowerCase().trim();

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        if (!user || !user.passwordHash) {
          return null;
        }

        if (!user.isActive) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id.toString(),
          email: user.email,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || null,
          image: user.image,
          role: user.role,
          isTrusted: user.isTrusted ?? false,
        };
      },
    }),
  ],
});
