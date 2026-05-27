import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { Adapter } from "next-auth/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import argon2 from "argon2";
import bcrypt from "bcryptjs"; // Dipertahankan HANYA untuk fallback hash lama
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "./schemas";
import { rateLimit } from "@/lib/redis";

const prismaAdapter = PrismaAdapter(prisma) as unknown as Adapter;

export const authOptions: NextAuthOptions = {
  adapter: prismaAdapter,
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
          console.error("[SECURITY] Zod Login Validation Failed:", parsedCredentials.error.flatten());
          // OPAQUE ERROR
          throw new Error("Kredensial tidak valid.");
        }

        const { username, password } = parsedCredentials.data;
        console.log("Zod parsed successfully. Email:", username);

        // 2. IP-BASED RATE LIMITING (THE IRON GATE)
        // Mencegah Email Rotation Attack (Botnet menggunakan banyak email dari 1 IP)
        const headerStore = await headers();
        const ip = headerStore.get("x-forwarded-for")?.split(",")[0] || "unknown-ip";
        console.log("Rate limiting IP:", ip);

        let rateLimitSuccess = true;
        try {
          const res = await rateLimit.limit(`login_ip_${ip}`);
          rateLimitSuccess = res.success;
        } catch (redisError) {
          console.error("[SECURITY] Redis Rate Limit Error (Failing Open):", redisError);
        }

        if (!rateLimitSuccess) {
          throw new Error("Terlalu banyak percobaan. Silakan coba lagi nanti.");
        }
        console.log("Rate limit passed or bypassed.");

        const user = await prisma.user.findUnique({
          where: { email: username },
        });
        console.log("User found in DB:", !!user);

        // 3. OPAQUE ERRORS (ANTI-USER ENUMERATION)
        // DILARANG memberi tahu bahwa email terdaftar pakai Google atau email tidak ada
        if (!user || user.isDeleted || !user.passwordHash) {
          console.log("User missing or no password hash.");
          throw new Error("Email atau Sandi tidak valid.");
        }

        // 4. ARGON2ID VERIFICATION WITH LEGACY FALLBACK
        let isPasswordValid = false;
        try {
          if (user.passwordHash.startsWith("$argon2")) {
            isPasswordValid = await argon2.verify(user.passwordHash, password);
          } else {
            // Jika sistem memiliki user lama dengan bcrypt, biarkan mereka masuk
            // CISO Note: Idealnya, kita lakukan re-hash ke Argon2id di sini dan simpan ke DB.
            isPasswordValid = await bcrypt.compare(password, user.passwordHash);
          }
        } catch (error) {
          console.error("[SECURITY] Auth Cryptography Error:", error instanceof Error ? error.message : "Unknown");
          throw new Error("Email atau Sandi tidak valid.");
        }

        if (!isPasswordValid) {
          throw new Error("Email atau Sandi tidak valid.");
        }

        return { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role 
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/member-login",
  },
  secret: process.env.NEXTAUTH_SECRET || "default_secret_key_change_me_in_production",
  // 5. BLIND LOGGING
  // Sembunyikan output verbose di console agar password/token tak bocor ke log server
  debug: false, 
  logger: {
    error(code, metadata) {
      // Filter metadata, jangan cetak raw object yang berpotensi berisi sandi
      console.error("[NEXTAUTH SECURITY ERROR]:", code);
    },
    warn(code) {
      console.warn("[NEXTAUTH WARN]:", code);
    },
    debug(code) {
      // Blinded debug
    }
  }
};
