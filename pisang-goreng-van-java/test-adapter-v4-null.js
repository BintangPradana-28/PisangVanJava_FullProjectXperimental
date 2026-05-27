const { PrismaClient } = require('@prisma/client');
const { PrismaAdapter } = require('@auth/prisma-adapter');

const prisma = new PrismaClient();
const adapter = PrismaAdapter(prisma);

async function testAdapterNextAuth() {
  try {
    console.log("Testing Adapter with emailVerified = null...");
    const user = await adapter.createUser({
      name: "Test Null Verified",
      email: "test.null@example.com",
      image: "test",
      emailVerified: null,
    });
    console.log("Created user:", user.id);

    await adapter.deleteUser(user.id);
    console.log("Cleanup completed.");
  } catch (err) {
    console.error("ADAPTER ERROR:");
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

testAdapterNextAuth();
