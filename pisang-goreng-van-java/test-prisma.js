const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log("Testing database connection...");
    const user = await prisma.user.findFirst();
    console.log("User:", user?.email);

    // Try to create a dummy account for this user
    if (user) {
      console.log("Trying to insert dummy account...");
      const account = await prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: "google_test",
          providerAccountId: "test_123",
          access_token: "test",
          id_token: "test",
          expires_at: Math.floor(Date.now() / 1000)
        }
      });
      console.log("Dummy account created successfully!", account.id);
      await prisma.account.delete({ where: { id: account.id } });
      console.log("Dummy account deleted.");
    }
  } catch (err) {
    console.error("PRISMA ERROR:");
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
