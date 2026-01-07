import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isDashboardRoute = req.nextUrl.pathname.startsWith("/dashboard");

  // Admin routes require admin role
  if (isAdminRoute) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login?callbackUrl=/admin", req.nextUrl));
    }
    const isAdmin = req.auth?.user?.role === "admin";
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
  }

  // Dashboard routes require authentication
  if (isDashboardRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Only protect admin and dashboard routes - everything else is public
    "/admin/:path*",
    "/dashboard/:path*",
  ],
};
