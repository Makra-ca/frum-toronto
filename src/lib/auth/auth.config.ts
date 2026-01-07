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

      console.log("[AUTH DEBUG] middleware authorized - path:", nextUrl.pathname);
      console.log("[AUTH DEBUG] middleware authorized - isLoggedIn:", isLoggedIn);
      console.log("[AUTH DEBUG] middleware authorized - auth?.user:", JSON.stringify(auth?.user));
      console.log("[AUTH DEBUG] middleware authorized - user.role:", auth?.user?.role);

      if (isAdminRoute) {
        if (!isLoggedIn) {
          console.log("[AUTH DEBUG] middleware - admin route, not logged in, returning false");
          return false;
        }
        // Check if user is admin
        const isAdmin = auth?.user?.role === "admin";
        console.log("[AUTH DEBUG] middleware - admin route, isAdmin:", isAdmin);
        return isAdmin;
      }

      if (isDashboardRoute) {
        return isLoggedIn;
      }

      return true;
    },
  },
  providers: [], // Providers are added in auth.ts
} satisfies NextAuthConfig;
