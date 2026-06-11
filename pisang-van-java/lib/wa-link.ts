// lib/wa-link.ts
// WhatsApp Link Generator — generates wa.me deep links for pre-filled order messages
// RAG Source: prisma/schema.prisma (StoreBranch.nomor_wa)
// RAG Source: lib/notifications.ts (WA notification patterns)
// RAG Source: src/features/checkout/service.ts (buildWhatsAppMessage pattern)

import 'server-only'
import { z } from 'zod'

// ── Validation ─────────────────────────────────────────────────────────────────

const phoneSchema = z
  .string()
  .trim()
  .min(9)
  .max(20)
  .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/)

const waLinkItemSchema = z.object({
  name: z.string().min(1).max(120),
  baseType: z.string().min(1).max(30),
  quantity: z.number().int().min(1).max(99),
  toppings: z.array(z.string().max(60)).max(5).optional()
})

const waLinkInputSchema = z
  .object({
    storePhone: phoneSchema,
    customerName: z.string().trim().min(1).max(60),
    items: z.array(waLinkItemSchema).min(1).max(40),
    deliveryMethod: z.enum(['PICKUP', 'DELIVERY']).optional(),
    notes: z.string().trim().max(500).optional()
  })
  .strict()

export type WaLinkItem = z.infer<typeof waLinkItemSchema>
export type WaLinkInput = z.infer<typeof waLinkInputSchema>

// ── Phone normalization ────────────────────────────────────────────────────────

function normalizePhoneForWA(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = `62${cleaned.slice(1)}`
  }
  return cleaned
}

// ── Message builder ────────────────────────────────────────────────────────────

function buildOrderMessage(input: WaLinkInput): string {
  const lines: string[] = []

  lines.push('🍌 *PESANAN PISANG VAN JAVA*')
  lines.push('')
  lines.push(`Nama: ${input.customerName}`)

  if (input.deliveryMethod) {
    lines.push(`Metode: ${input.deliveryMethod === 'DELIVERY' ? '🛵 Delivery' : '🏪 Pickup'}`)
  }

  lines.push('')
  lines.push('📋 *Detail Pesanan:*')

  for (const item of input.items) {
    let line = `• ${item.quantity}x ${item.name} (${item.baseType})`
    if (item.toppings && item.toppings.length > 0) {
      line += ` + ${item.toppings.join(', ')}`
    }
    lines.push(line)
  }

  if (input.notes) {
    lines.push('')
    lines.push(`📝 Catatan: ${input.notes}`)
  }

  lines.push('')
  lines.push('Mohon dikonfirmasi ya kak! 🙏')

  return lines.join('\n')
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generates a wa.me URL with pre-filled order message.
 * Returns null if validation fails.
 */
export function generateWaOrderLink(input: WaLinkInput): string | null {
  const parsed = waLinkInputSchema.safeParse(input)
  if (!parsed.success) {
    console.error('[WA-LINK] Validation failed:', parsed.error.issues)
    return null
  }

  const phone = normalizePhoneForWA(parsed.data.storePhone)
  const message = buildOrderMessage(parsed.data)
  const encodedMessage = encodeURIComponent(message)

  return `https://wa.me/${phone}?text=${encodedMessage}`
}

/**
 * Client-safe version: generates wa.me link from a simple list of items.
 * Used by the WA button on storefront pages.
 */
export function generateSimpleWaLink(
  storePhone: string,
  customerName: string,
  items: WaLinkItem[]
): string | null {
  return generateWaOrderLink({
    storePhone,
    customerName,
    items
  })
}
