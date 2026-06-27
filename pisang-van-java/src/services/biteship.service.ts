import { env } from '@/src/env'
import { prisma } from '@/lib/prisma'

const STORE_LAT = -6.3157
const STORE_LNG = 106.9016
const STORE_PHONE = '081234567890'
const STORE_ADDRESS = 'Jl. Raya Cipayung No.34, Cipayung, Jakarta Timur, 13840'

export interface BiteshipOrderResponse {
  success: boolean
  message: string
  data?: {
    id: string
    courier?: {
      company: string
      type: string
      price: number
      waybill_id: string | null
    }
    status: string
  }
}

export interface BiteshipTrackingResponse {
  success: boolean
  data?: {
    id: string
    status: string
    courier: {
      company: string
      waybill_id: string | null
    }
    history: Array<{
      status: string
      note: string
      time: string
    }>
  }
}

function mapCourierToBiteship(courierName: string | null): { company: string; type: string } {
  if (!courierName) {
    return { company: 'gojek', type: 'instant' }
  }
  const lower = courierName.toLowerCase()
  if (lower.includes('gojek')) {
    return { company: 'gojek', type: 'instant' }
  }
  if (lower.includes('grab')) {
    return { company: 'grab', type: 'instant' }
  }
  if (lower.includes('lalamove')) {
    return { company: 'lalamove', type: 'motor' }
  }
  return { company: 'gojek', type: 'instant' }
}

/**
 * Creates an order in Biteship for a given DB order
 */
export async function createBiteshipOrder(orderId: string): Promise<{ success: boolean; data?: { biteshipOrderId: string; waybillId: string | null }; error?: string }> {
  const apiKey = env.BITESHIP_API_KEY?.trim()
  if (!apiKey) {
    console.warn('[BITESHIP] API Key is missing. Skipping API call.')
    return { success: false, error: 'Biteship API Key is not configured.' }
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        address: true,
        items: {
          include: {
            variant: true
          }
        }
      }
    })

    if (!order) {
      return { success: false, error: 'Order not found.' }
    }

    if (order.deliveryMethod !== 'DELIVERY' || !order.address) {
      return { success: false, error: 'Order is not configured for delivery.' }
    }

    const { company, type } = mapCourierToBiteship(order.courierName)
    const totalWeight = order.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity * 200, 0)
    const totalValue = order.items.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice, 0)

    const requestBody = {
      shipper_contact_name: 'Pisang Goreng Van Java',
      shipper_contact_phone: STORE_PHONE,
      origin_contact_name: 'Pisang Goreng Van Java',
      origin_contact_phone: STORE_PHONE,
      origin_address: STORE_ADDRESS,
      origin_coordinate: {
        latitude: STORE_LAT,
        longitude: STORE_LNG
      },
      destination_contact_name: order.customerName,
      destination_contact_phone: order.customerPhone,
      destination_address: order.address.fullAddress,
      destination_coordinate: {
        latitude: order.address.latitude ?? STORE_LAT,
        longitude: order.address.longitude ?? STORE_LNG
      },
      courier_company: company,
      courier_type: type,
      delivery_type: 'now',
      items: [
        {
          name: 'Paket Pisang Goreng',
          description: 'Makanan hangat Pisang Goreng Van Java',
          value: totalValue,
          length: 20,
          width: 20,
          height: 15,
          weight: totalWeight,
          quantity: 1
        }
      ]
    }

    const res = await fetch('https://api.biteship.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[BITESHIP ERROR] Create Order failed: ${res.status} - ${errorText}`)
      return { success: false, error: `Biteship API returned error: ${errorText}` }
    }

    const json = (await res.json()) as BiteshipOrderResponse

    if (!json.success || !json.data) {
      return { success: false, error: json.message || 'Biteship returned success false' }
    }

    const biteshipOrderId = json.data.id
    const waybillId = json.data.courier?.waybill_id || null

    // Update database with the Biteship IDs
    await prisma.order.update({
      where: { id: orderId },
      data: {
        biteshipOrderId,
        waybillId
      }
    })

    return {
      success: true,
      data: { biteshipOrderId, waybillId }
    }
  } catch (error) {
    console.error('[BITESHIP ERROR] createBiteshipOrder exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown exception' }
  }
}

/**
 * Cancels a Biteship order
 */
export async function cancelBiteshipOrder(biteshipOrderId: string, reason = 'Pelanggan membatalkan pesanan'): Promise<{ success: boolean; error?: string }> {
  const apiKey = env.BITESHIP_API_KEY?.trim()
  if (!apiKey) {
    return { success: false, error: 'Biteship API Key is not configured.' }
  }

  try {
    const res = await fetch(`https://api.biteship.com/v1/orders/${biteshipOrderId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[BITESHIP ERROR] Cancel Order failed: ${res.status} - ${errorText}`)
      return { success: false, error: `Biteship API returned error: ${errorText}` }
    }

    const json = (await res.json()) as { success: boolean; message: string }
    return { success: json.success, error: json.success ? undefined : json.message }
  } catch (error) {
    console.error('[BITESHIP ERROR] cancelBiteshipOrder exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown exception' }
  }
}

/**
 * Gets real-time tracking details from Biteship
 */
export async function getBiteshipTracking(biteshipOrderId: string): Promise<{ success: boolean; data?: BiteshipTrackingResponse['data']; error?: string }> {
  const apiKey = env.BITESHIP_API_KEY?.trim()
  if (!apiKey) {
    return { success: false, error: 'Biteship API Key is not configured.' }
  }

  try {
    const res = await fetch(`https://api.biteship.com/v1/trackings/${biteshipOrderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[BITESHIP ERROR] Get Tracking failed: ${res.status} - ${errorText}`)
      return { success: false, error: `Biteship API returned error: ${errorText}` }
    }

    const json = (await res.json()) as BiteshipTrackingResponse
    return { success: json.success, data: json.data, error: json.success ? undefined : 'Biteship failed' }
  } catch (error) {
    console.error('[BITESHIP ERROR] getBiteshipTracking exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown exception' }
  }
}
