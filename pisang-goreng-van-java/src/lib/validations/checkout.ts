import { z } from "zod";

// =========================================================================
// 1. ZOD SCHEMA (BAJU ZIRAH KEAMANAN)
// =========================================================================
export const checkoutSchema = z.object({
  nama: z
    .string()
    .min(3, { message: "Nama minimal harus 3 karakter ya." })
    .max(50, { message: "Nama maksimal 50 karakter." })
    .regex(/^[A-Za-z\s]+$/, { message: "Hanya boleh berisi huruf dan spasi." }), // Mencegah XSS via nama
  whatsapp: z
    .string()
    .min(10, { message: "Nomor WA terlalu pendek." })
    .max(15, { message: "Nomor WA terlalu panjang." })
    .regex(/^[0-9]+$/, { message: "Hanya boleh berisi angka, tanpa spasi atau +." }),
  catatan: z
    .string()
    .max(100, { message: "Catatan maksimal 100 karakter." })
    .optional(),
}).strict(); // MUTLAK: Menolak injeksi properti liar dari peretas

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
