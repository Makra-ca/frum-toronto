import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
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
          .where(eq(users.email, user.email))
          .limit(1);

        // Block if user exists and is banned
        if (existingUser && existingUser.isActive === false) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      console.log("[AUTH DEBUG] jwt callback - trigger:", trigger, "user:", user?.email, "token.role before:", token.role);
      if (user) {
        token.id = user.id as string;
        // For OAuth users, fetch role from database since profile() always returns "member"
        // For credentials, user.role is already correct from the authorize() callback
        if (user.email) {
          const [dbUser] = await db
            .select({ role: users.role, isTrusted: users.isTrusted })
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);
          console.log("[AUTH DEBUG] jwt callback - dbUser fetched:", dbUser);
          if (dbUser) {
            token.role = dbUser.role;
            token.isTrusted = dbUser.isTrusted ?? false;
          } else {
            token.role = user.role;
            token.isTrusted = user.isTrusted;
          }
        } else {
          token.role = user.role;
          token.isTrusted = user.isTrusted;
        }
      }
      // Handle session updates
      if (trigger === "update" && session) {
        token.role = session.role;
        token.isTrusted = session.isTrusted;
      }
      console.log("[AUTH DEBUG] jwt callback - token.role after:", token.role);
      return token;
    },
    async session({ session, token }) {
      console.log("[AUTH DEBUG] session callback - token.role:", token.role);
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.isTrusted = token.isTrusted;
      }
      console.log("[AUTH DEBUG] session callback - session.user.role:", session.user?.role);
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

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
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
