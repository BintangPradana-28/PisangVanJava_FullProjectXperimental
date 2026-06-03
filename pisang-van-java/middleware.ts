import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // Rute-rute yang memerlukan login
        const pathname = req.nextUrl.pathname;
        if (pathname.startsWith("/profil") || pathname.startsWith("/checkout")) {
          return !!token;
        }
        return true;
      },
    },
    pages: {
      signIn: "/member-login", // Redirect ke halaman login kustom
    },
  }
);

export const config = {
  matcher: ["/profil/:path*", "/checkout/:path*"],
};
