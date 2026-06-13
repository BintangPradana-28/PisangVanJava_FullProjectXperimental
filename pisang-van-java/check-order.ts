import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const order = await prisma.order.findUnique({
    where: { id: 'cmq1toxc100099kd2co0vb7ln' }
  })
  console.log('Order Details:', JSON.stringify(order, null, 2))

  const payment = await prisma.payment.findUnique({
    where: { orderId: 'cmq1toxc100099kd2co0vb7ln' }
  })
  console.log('Payment Details:', JSON.stringify(payment, null, 2))
}

main().finally(() => prisma.$disconnect())


