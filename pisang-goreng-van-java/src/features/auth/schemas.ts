import { z } from "zod";

// ============================================================================
// C-LEVEL SECURITY MANDATE: THE ABSOLUTE QUARANTINE
// All schemas MUST use .strict() to prevent mass assignment and prototype pollution.
// All strings MUST have hard upper limits to prevent Buffer Overflows / ReDoS.
// ============================================================================

export const loginSchema = z.object({
  // Gunakan batas maksimal standar untuk mencegah serangan payload raksasa.
  username: z.string().trim().min(3).max(254).email(),
  password: z.string().min(8).max(128),
}); // Removed .strict() to allow NextAuth internal fields

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80).regex(/^[A-Za-z\s]+$/, "Nama hanya boleh berisi alfabet dan spasi"),
  email: z.string().trim().min(3).max(254).email(),
  whatsapp: z.string().trim().regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, "Format WhatsApp tidak valid"),
  password: z
    .string()
    .min(8, "Sandi minimal 8 karakter")
    .max(128, "Sandi maksimal 128 karakter")
    .regex(/[A-Z]/, "Harus mengandung huruf besar")
    .regex(/[0-9]/, "Harus mengandung angka")
    .regex(/[^A-Za-z0-9]/, "Harus mengandung simbol spesial"),
  consent: z.boolean().refine((val) => val === true, {
    message: "Anda harus menyetujui Kebijakan Privasi",
  }),
}).strict();

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
}).strict();
