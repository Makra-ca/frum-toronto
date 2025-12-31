import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/verify-email",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdminRoute = nextUrl.pathname.startsWith("/admin");
      const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");

      if (isAdminRoute) {
        if (!isLoggedIn) return false;
        // Check if user is admin
        return auth?.user?.role === "admin";
      }

      if (isDashboardRoute) {
        return isLoggedIn;
      }

      return true;
    },
  },
  providers: [], // Providers are added in auth.ts
} satisfies NextAuthConfig;
