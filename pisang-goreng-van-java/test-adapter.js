const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAdapter() {
  try {
    console.log("Testing user creation...");
    // Simulate what NextAuth does when an OAuth user logs in for the first time
    const user = await prisma.user.create({
      data: {
        name: "Test User",
        email: "test.google.login@example.com",
        image: "https://lh3.googleusercontent.com/a/test",
        emailVerified: new Date(),
      }
    });
    console.log("User created successfully:", user.id);

    console.log("Testing account linking...");
    const account = await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: "12345678901234567890",
        access_token: "test_token",
        expires_at: Math.floor(Date.now() / 1000)
      }
    });
    console.log("Account linked successfully:", account.id);

    // Cleanup
    await prisma.user.delete({ where: { id: user.id } });
    console.log("Test cleanup completed.");
  } catch (err) {
    console.error("PRISMA ADAPTER SIMULATION ERROR:");
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

testAdapter();
