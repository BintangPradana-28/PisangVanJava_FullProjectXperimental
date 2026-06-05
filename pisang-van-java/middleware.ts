import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { globalRateLimit, redis } from "@/lib/redis";

// ─── Route definitions ────────────────────────────────────────────────────────

const ADMIN_PATHS = [
  "/dashboard",
  "/manage-menu",
  "/orders",
  "/reports",
  "/settings",
  "/toppings",
  "/api/admin",
];

const CUSTOMER_PROTECTED_PATHS = [
  "/checkout",
  "/profile",
  "/track-order",
  "/api/cart",
];

const EDGE_CONTEXT_PATHS = ["/menu-spesial"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWIBHour(): number {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCHours();
}

function deriveMenuContext(hour: number) {
  return {
    earlyMorning: hour >= 4 && hour < 7,
    lunch:        hour >= 11 && hour < 14,
    lateAfternoon:hour >= 16 && hour < 18,
    evening:      hour >= 18 && hour < 21,
    isLateNight:  hour >= 21 || hour < 4,
  };
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((p) => pathname.startsWith(p));
}

function isCustomerProtectedPath(pathname: string): boolean {
  return CUSTOMER_PROTECTED_PATHS.some((p) => pathname.startsWith(p));
}

function isEdgeContextPath(pathname: string): boolean {
  return EDGE_CONTEXT_PATHS.some((p) => pathname.startsWith(p));
}

// ─── Main middleware (wrapped with Auth.js v5) ───────────────────────────────

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // ── 1. Global rate limiting (runs on all matched routes) ──────────────────
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";
    const { success } = await globalRateLimit.limit(`global_${ip}`);

    if (!success) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Coba lagi sebentar." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch {
    console.error("[SECURITY] Rate limiter unavailable, failing open.");
  }

  // ── 2. Edge context injection for /menu-spesial ───────────────────────────
  if (isEdgeContextPath(pathname)) {
    const hour = getWIBHour();
    const context = deriveMenuContext(hour);
    const contextStr = JSON.stringify(context);
    const existingCookie = req.cookies.get("x-menu-context")?.value;

    const res = NextResponse.next();

    if (existingCookie !== contextStr) {
      res.cookies.set("x-menu-context", contextStr, {
        httpOnly: false,
        maxAge: 1800,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  }

  // ── 3. Auth guard — read JWT token via req.auth ───────────────────────────
  const needsAuth = isAdminPath(pathname) || isCustomerProtectedPath(pathname);

  const token = req.auth?.user;

  // ── 3.5. Banned User Check ────────────────────────────────────────────────
  if (token && needsAuth) {
    let isBanned = token.isBanned;
    
    // Check Redis for immediate revocation if not flagged in JWT yet
    if (!isBanned) {
      try {
        const bannedInRedis = await redis.get(`banned:${token.id}`);
        if (bannedInRedis) isBanned = true;
      } catch (err) {
        console.error("[SECURITY] Redis ban check failed", err);
      }
    }

    if (isBanned) {
      const response = NextResponse.redirect(new URL("/banned", req.url));
      response.cookies.delete("authjs.session-token");
      response.cookies.delete("__Secure-authjs.session-token");
      return response;
    }
  }

  if (!needsAuth) {
    return NextResponse.next();
  }

  // ── 4. Unauthenticated — redirect to correct login page ──────────────────
  if (!token) {
    const loginUrl = isAdminPath(pathname)
      ? new URL("/login", req.url)
      : new URL("/member-login", req.url);

    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // ── 5. Authenticated but wrong role for admin routes ─────────────────────
  if (isAdminPath(pathname) && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

// ─── Route matcher ────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/manage-menu/:path*",
    "/orders/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/toppings/:path*",
    "/api/admin/:path*",
    "/checkout/:path*",
    "/profile/:path*",
    "/track-order/:path*",
    "/api/cart/:path*",
    "/menu-spesial/:path*"
  ],
};
