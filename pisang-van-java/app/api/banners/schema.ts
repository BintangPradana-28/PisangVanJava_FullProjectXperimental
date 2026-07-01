import { z } from 'zod'

// SECURITY FIX: linkUrl previously accepted ANY valid URL (z.string().url()), and is
// rendered directly as a <Link href={ctaLink}> in components/user/Hero.tsx. An admin
// account being compromised, or simply a typo'd paste, could point the homepage's main
// CTA at an external phishing domain styled to look identical to this site. linkUrl is
// now restricted to same-site destinations: a relative path ("/menu-spesial") or an
// absolute URL whose origin matches NEXT_PUBLIC_APP_URL. imageUrl is restricted to
// Cloudinary, the only image host this project actually uploads to (see lib/cloudinary.ts
// and app/api/upload/route.ts) — an arbitrary external imageUrl could be used to load a
// tracking pixel on every visitor of the public homepage.
const CLOUDINARY_HOST = 'res.cloudinary.com'

function isSameSiteLink(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return false
  try {
    const target = new URL(value)
    const allowed = new URL(appUrl)
    return target.origin === allowed.origin
  } catch {
    return false
  }
}

const sameSiteLinkSchema = z
  .string()
  .min(1)
  .refine(isSameSiteLink, 'Link harus mengarah ke halaman internal situs ini')
  .optional()
  .nullable()

const cloudinaryImageSchema = z
  .string()
  .url('Invalid image URL')
  .refine((url) => {
    try {
      return new URL(url).hostname === CLOUDINARY_HOST
    } catch {
      return false
    }
  }, 'Gambar harus diunggah melalui Cloudinary')
  .optional()
  .nullable()

export const bannerSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  subtitle: z.string().max(255).optional().nullable(),
  badge: z.string().max(50).optional().nullable(),
  imageUrl: cloudinaryImageSchema,
  isActive: z.boolean().default(true),
  linkUrl: sameSiteLinkSchema,
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  priority: z.number().int().default(0)
})

export type BannerInput = z.infer<typeof bannerSchema>
