import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Only protect admin and dashboard routes - everything else is public
    "/admin/:path*",
    "/dashboard/:path*",
  ],
};
