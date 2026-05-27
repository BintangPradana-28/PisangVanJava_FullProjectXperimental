const { PrismaClient } = require('@prisma/client');
const { PrismaAdapter } = require('@auth/prisma-adapter');

const prisma = new PrismaClient();
const adapter = PrismaAdapter(prisma);

async function testAdapterNextAuth() {
  try {
    console.log("Testing Adapter...");
    const user = await adapter.createUser({
      name: "Test Auth User",
      email: "test.adapter@example.com",
      image: "test",
      emailVerified: new Date(),
    });
    console.log("Created user:", user.id);

    await adapter.linkAccount({
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: "123456789",
      access_token: "test_token",
      expires_at: Math.floor(Date.now() / 1000)
    });
    console.log("Linked account.");

    const foundUser = await adapter.getUserByAccount({
      provider: "google",
      providerAccountId: "123456789"
    });
    console.log("Found user by account:", foundUser?.id);

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
