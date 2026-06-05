import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { loginSchema } from "@/src/features/auth/schemas";
import { rateLimit } from "@/lib/redis";
import * as Sentry from "@sentry/nextjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 Days
  },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID || "MOCK_CLIENT_ID",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "MOCK_CLIENT_SECRET",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Email", type: "email", placeholder: "email@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("Credentials received:", credentials);
        // 1. ZOD ENFORCER
        const parsedCredentials = loginSchema.safeParse(credentials);
        
        if (!parsedCredentials.success) {
          Sentry.captureMessage(`[SECURITY] Zod Login Validation Failed for: ${credentials?.username}`, "warning");
          throw new Error("Kredensial tidak valid.");
        }

        const { username, password } = parsedCredentials.data;
        console.log("Zod parsed successfully. Email:", username);

        // 2. IP-BASED RATE LIMITING
        const headerStore = await headers();
        const ip = headerStore.get("x-forwarded-for")?.split(",")[0] || "unknown-ip";
        console.log("Rate limiting IP:", ip);

        let rateLimitSuccess = true;
        try {
          const res = await rateLimit.limit(`login_ip_${ip}`);
          rateLimitSuccess = res.success;
        } catch (redisError) {
          Sentry.captureException(redisError);
        }

        if (!rateLimitSuccess) {
          throw new Error("Terlalu banyak percobaan. Silakan coba lagi nanti.");
        }
        console.log("Rate limit passed or bypassed.");

        const user = await prisma.user.findUnique({
          where: { email: username },
        });
        console.log("User found in DB:", !!user);

        // 3. OPAQUE ERRORS & BAN CHECK
        if (!user || user.isDeleted || !user.passwordHash) {
          console.log("User missing or no password hash.");
          throw new Error("Email atau Sandi tidak valid.");
        }

        if (user.isBanned) {
          Sentry.captureMessage(`[SECURITY] Banned user attempted login: ${user.email}`, "warning");
          throw new Error("Akun Anda telah ditangguhkan. Hubungi admin.");
        }

        // 4. BCRYPT VERIFICATION
        let isPasswordValid = false;
        try {
          if (user.passwordHash.startsWith("$argon2")) {
            throw new Error("Sistem keamanan telah ditingkatkan. Silakan lakukan 'Lupa Sandi' untuk mengatur ulang akses Anda.");
          } else {
            isPasswordValid = await bcrypt.compare(password, user.passwordHash);
          }
        } catch (error) {
          Sentry.captureException(error);
          throw new Error("Email atau Sandi tidak valid.");
        }

        if (!isPasswordValid) {
          throw new Error("Email atau Sandi tidak valid.");
        }

        return { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role,
          isBanned: user.isBanned,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.isBanned = (user as any).isBanned;
      }
      if ((!token.role || token.isBanned === undefined) && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, id: true, isBanned: true, name: true, image: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.id = dbUser.id;
          token.isBanned = dbUser.isBanned;
          if (dbUser.name) token.name = dbUser.name;
          if (dbUser.image) token.picture = dbUser.image;
        }
      }
      if (trigger === "update" && session) {
        if (session.role) token.role = session.role;
        if (session.name) token.name = session.name;
        if (session.image) token.picture = session.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.role = (token.role as Role) || "CUSTOMER";
        session.user.isBanned = token.isBanned as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/member-login",
  },
  secret: process.env.NEXTAUTH_SECRET || "default_secret_key_change_me_in_production",
  debug: false, 
  logger: {
    error(error) {
      console.error("[NEXTAUTH SECURITY ERROR]:", error);
    },
    warn(code) {
      console.warn("[NEXTAUTH WARN]:", code);
    },
    debug(code) {}
  }
});
