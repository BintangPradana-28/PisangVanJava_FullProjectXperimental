// src/lib/wa-link-client.ts
// Client-safe WhatsApp link generator (no server-only imports)
// RAG Source: lib/wa-link.ts (server version with full validation)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WaCartItem {
  name: string
  baseType: string
  quantity: number
  toppings?: string[]
}

// ── Phone normalization ────────────────────────────────────────────────────────

function normalizePhoneForWA(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = `62${cleaned.slice(1)}`
  }
  return cleaned
}

// ── Message builder ────────────────────────────────────────────────────────────

function buildCartMessage(customerName: string, items: WaCartItem[], notes?: string): string {
  const lines: string[] = []

  lines.push('🍌 *PESANAN PISANG VAN JAVA*')
  lines.push('')
  lines.push(`Nama: ${customerName}`)
  lines.push('')
  lines.push('📋 *Detail Pesanan:*')

  for (const item of items) {
    let line = `• ${item.quantity}x ${item.name} (${item.baseType})`
    if (item.toppings && item.toppings.length > 0) {
      line += ` + ${item.toppings.join(', ')}`
    }
    lines.push(line)
  }

  if (notes) {
    lines.push('')
    lines.push(`📝 Catatan: ${notes}`)
  }

  lines.push('')
  lines.push('Mohon dikonfirmasi ya kak! 🙏')

  return lines.join('\n')
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generates a wa.me URL with a pre-filled order message from cart items.
 * Safe to use in client components.
 */
export function generateWaCartLink(
  storePhone: string,
  customerName: string,
  items: WaCartItem[],
  notes?: string
): string {
  if (items.length === 0 || !storePhone || !customerName) {
    return '#'
  }

  const phone = normalizePhoneForWA(storePhone)
  const message = buildCartMessage(customerName, items, notes)

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
