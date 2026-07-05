import { z } from 'zod'

export const bannerSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  subtitle: z.string().max(255).optional().nullable(),
  badge: z.string().max(50).optional().nullable(),
  imageUrl: z.string().url('Invalid image URL').optional().nullable(),
  isActive: z.boolean().default(true),
  linkUrl: z.string().url('Invalid link URL').optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  priority: z.number().int().default(0)
})

export type BannerInput = z.infer<typeof bannerSchema>
