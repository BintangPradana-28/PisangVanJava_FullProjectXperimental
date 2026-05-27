import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

import { NextRequest } from "next/server";
import { globalRateLimit } from "@/lib/redis";

const authMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    const adminPaths = ['/dashboard', '/manage-menu', '/orders', '/reports', '/settings', '/toppings', '/api/admin'];
    const isTryingToAccessAdmin = adminPaths.some(path => req.nextUrl.pathname.startsWith(path));

    if (isTryingToAccessAdmin) {
      if (token?.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/member-login", // Default B2C login, tapi kalau admin ya ke /login
    },
  }
);

export default async function middleware(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1";
    const { success } = await globalRateLimit.limit(`global_${ip}`);
    
    if (!success) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
  } catch (error) {
    // Fail open if Redis is down
    console.error("[SECURITY] Global Rate Limiter failed, bypassing...", error);
  }

  // Pass to NextAuth middleware
  return (authMiddleware as any)(req, null as any);
}

export const config = {
  matcher: [
    // Admin Routes
    "/dashboard/:path*",
    "/manage-menu/:path*",
    "/orders/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/toppings/:path*",
    "/api/admin/:path*",
    
    // Customer Protected Routes
    "/checkout/:path*",
    "/profile/:path*",
    "/track-order/:path*",
    "/api/cart/:path*"
  ],
};
