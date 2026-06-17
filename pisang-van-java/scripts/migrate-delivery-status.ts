import { OrderStatus, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🏁 Starting delivery status data migration...')

  // Find delivery orders with status 'READY' (meaning they were cooked and ready, but under the old system had no OTW/DELIVERED status)
  const readyDeliveryOrders = await prisma.order.findMany({
    where: {
      deliveryMethod: 'DELIVERY',
      status: OrderStatus.READY
    }
  })

  console.log(`🔍 Found ${readyDeliveryOrders.length} active delivery orders in 'READY' status.`)

  if (readyDeliveryOrders.length > 0) {
    console.log('🔄 Reclassifying active READY delivery orders to OUT_FOR_DELIVERY...')
    let count = 0
    for (const order of readyDeliveryOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.OUT_FOR_DELIVERY,
          // Set default fallback values for testing
          courierName: order.courierName || 'Kurir PVJ',
          courierPhone: order.courierPhone || '6281312167554',
          etaMinutes: order.etaMinutes || 25
        }
      })
      count++
    }
    console.log(`✅ Successfully updated ${count} active delivery orders to OUT_FOR_DELIVERY.`)
  }

  // Find all delivery orders that are COMPLETED but don't have proofPhotoUrl/tipAmount set
  const completedDeliveryOrders = await prisma.order.findMany({
    where: {
      deliveryMethod: 'DELIVERY',
      status: OrderStatus.COMPLETED,
      proofPhotoUrl: null
    }
  })

  console.log(`🔍 Found ${completedDeliveryOrders.length} completed delivery orders without proof of delivery.`)

  if (completedDeliveryOrders.length > 0) {
    console.log('🔄 Setting placeholder proof of delivery for historical completed orders...')
    let count = 0
    for (const order of completedDeliveryOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          proofPhotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1626262626/sample.jpg' // Standard Cloudinary demo sample image
        }
      })
      count++
    }
    console.log(`✅ Successfully updated ${count} completed delivery orders with placeholder proof of delivery.`)
  }

  console.log('🎉 Migration completed successfully.')
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
