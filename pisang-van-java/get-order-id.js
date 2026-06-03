const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getOrderId() {
  const order = await prisma.order.findFirst({
    where: { status: 'pending' },
    select: { id: true }
  });
  if (order) {
    console.log(`ORDER_ID=${order.id}`);
  } else {
    console.log('No pending order found. Getting any order...');
    const anyOrder = await prisma.order.findFirst({ select: { id: true } });
    if (anyOrder) {
      console.log(`ORDER_ID=${anyOrder.id}`);
    } else {
      console.log('No orders exist.');
    }
  }
}

getOrderId()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
