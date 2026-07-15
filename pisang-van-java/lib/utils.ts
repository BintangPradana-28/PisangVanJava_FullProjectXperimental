// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatPrice = (price: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(price)

export const formatPriceShort = (price: number): string => `${price / 1000}K`

export function buildWhatsAppUrl(message: string): string {
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || '6285773728748'
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
}

export function buildOrderMessage(
  flavorName: string,
  baseLabel: string,
  toppingName?: string,
  total?: number
): string {
  const topping = toppingName ? `\n• Topping: ${toppingName} (+Rp 2.000)` : ''
  const totalLine = total ? `\n• Total: ${formatPrice(total)}` : ''
  return `Halo Pisang Goreng Van Java! 🍌\n\nSaya ingin memesan:\n• Rasa: ${flavorName}\n• Tipe: ${baseLabel}${topping}${totalLine}\n\nMohon konfirmasi ketersediaan. Terima kasih! 🙏`
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.slice(0, length)}...` : str
}

export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = `62${cleaned.slice(1)}`
  }
  return cleaned
}

export const getFallbackImage = (name: string): string => {
  const n = name.toLowerCase()
  if (n.includes('matcha')) return '/images/flavors/matcha.png'
  if (n.includes('taro')) return '/images/flavors/taro.png'
  if (n.includes('blueberry') || n.includes('bluberi')) return '/images/flavors/blueberry.png'
  if (n.includes('strawberry') || n.includes('stroberi')) return '/images/flavors/strawberry.png'
  if (n.includes('cokelat') || n.includes('coklat')) return '/images/flavors/chocolate.png'
  if (n.includes('keju')) return '/images/flavors/cheese.png'
  if (n.includes('vanilla') || n.includes('vanila')) return '/images/flavors/vanilla.png'
  return '/kitchen.png' // Default local fallback
}

export const getFlavorDescriptionKey = (flavorName: string): string | null => {
  const lower = flavorName.toLowerCase()
  if (lower.includes('cokelat') || lower.includes('coklat')) return 'menu_desc_cokelat'
  if (lower.includes('matcha')) return 'menu_desc_matcha'
  if (lower.includes('strawberry') || lower.includes('stroberi')) return 'menu_desc_strawberry'
  if (lower.includes('blueberry') || lower.includes('bluberi')) return 'menu_desc_blueberry'
  if (lower.includes('taro')) return 'menu_desc_taro'
  if (lower.includes('tiramisu')) return 'menu_desc_tiramisu'
  if (lower.includes('keju')) return 'menu_desc_keju'
  if (lower.includes('susu')) return 'menu_desc_susu'
  if (lower.includes('original')) return 'menu_desc_original'
  if (lower.includes('milky')) return 'menu_desc_milky'
  return null
}
