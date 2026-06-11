export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis' // Upstash redis
import { auth } from '@/src/auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const redisKey = `user:cart:${userId}`

    // 1. Coba baca dari Redis (Buffer Layer)
    const cachedCart = await redis.get(redisKey)
    if (cachedCart) {
      return NextResponse.json({
        success: true,
        data: { items: typeof cachedCart === 'string' ? JSON.parse(cachedCart) : cachedCart }
      })
    }

    // 2. Fallback ke PostgreSQL
    const userCart = await prisma.userCart.findUnique({
      where: { userId }
    })

    const items = userCart?.items ? userCart.items : []

    // Cache ulang ke Redis
    if (items !== null) {
      await redis.set(redisKey, JSON.stringify(items), { ex: 60 * 60 * 24 * 7 }) // 7 hari
    }

    return NextResponse.json({
      success: true,
      data: { items }
    })
  } catch (error) {
    console.error('[CART_SYNC_GET]', error)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { items } = body

    if (!Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'Invalid payload format' }, { status: 400 })
    }

    const userId = session.user.id
    const redisKey = `user:cart:${userId}`

    // 🛡️ SECURITY OVERRIDE & PERFORMANCE (NO N+1): Fetch all variants and toppings first
    const variantIds = [
      ...new Set(items.map((i: any) => i.menuVariantId).filter(Boolean))
    ] as string[]
    const toppingIds = [
      ...new Set(
        items
          .flatMap((i: any) => {
            // support backward compatibility if `topping` exists, else `toppings`
            const tops = Array.isArray(i.toppings) ? i.toppings : i.topping ? [i.topping] : []
            return tops.map((t: any) => t?.toppingId)
          })
          .filter(Boolean)
      )
    ] as string[]

    const [variants, toppings] = await Promise.all([
      prisma.menuVariant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          priceKembung: true,
          priceLumpia: true,
          priceKrispy: true,
          flavorName: true
        }
      }),
      prisma.topping.findMany({
        where: { id: { in: toppingIds } },
        select: { id: true, price: true, name: true }
      })
    ])

    const variantMap = new Map<string, any>(variants.map((v: any) => [v.id, v]))
    const toppingMap = new Map<string, any>(toppings.map((t: any) => [t.id, t]))

    // Override basePrice dan toppings.priceAdd dengan harga aktual dari database
    const validatedItems = items.map((item: any) => {
      const variant = variantMap.get(item.menuVariantId)
      if (!variant) return item // Fallback jika variant hilang

      let trueBasePrice = 0
      const baseTypeLower = item.baseType?.toLowerCase() || ''
      if (baseTypeLower.includes('lumpia')) {
        trueBasePrice = variant.priceLumpia
      } else if (baseTypeLower.includes('krispy')) {
        trueBasePrice = variant.priceKrispy
      } else {
        trueBasePrice = variant.priceKembung // Default
      }

      // Handle toppings array
      const rawToppings = Array.isArray(item.toppings)
        ? item.toppings
        : item.topping
          ? [item.topping]
          : []
      const trueToppings = rawToppings
        .map((t: any) => {
          const toppingRecord = toppingMap.get(t?.toppingId)
          if (toppingRecord) {
            return {
              toppingId: t.toppingId,
              name: toppingRecord.name,
              priceAdd: toppingRecord.price
            }
          }
          return t
        })
        .filter(Boolean)

      const { topping, ...restItem } = item // hapus legacy `topping`

      return {
        ...restItem,
        variantName: variant.flavorName,
        basePrice: trueBasePrice,
        toppings: trueToppings
      }
    })

    // 1. Tulis ke Redis (Fast Write / Buffer)
    await redis.set(redisKey, JSON.stringify(validatedItems), { ex: 60 * 60 * 24 * 7 }) // 7 hari

    // 2. Persist ke PostgreSQL
    await prisma.userCart.upsert({
      where: { userId },
      update: { items: validatedItems },
      create: { userId, items: validatedItems }
    })

    return NextResponse.json({ success: true, message: 'Cart synced successfully' })
  } catch (error) {
    console.error('[CART_SYNC_POST]', error)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
