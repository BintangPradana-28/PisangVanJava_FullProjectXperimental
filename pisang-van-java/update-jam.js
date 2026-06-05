const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateJamOperasional() {
  const newValue = 'Setiap Hari: 10.00–21.00 WIB';
  console.log(`Updating jam_operasional to: ${newValue}`);

  // Update in Settings table
  try {
    await prisma.storeBranch.updateMany({
      data: {
        jam_operasional: newValue,
      }
    });
    console.log('Successfully updated Settings table.');
  } catch (error) {
    console.error('Error updating Settings table:', error);
  }

  // Update in SiteSetting table
  try {
    await prisma.siteSetting.update({
      where: { key: 'jam_operasional' },
      data: { value: newValue }
    });
    console.log('Successfully updated SiteSetting table.');
  } catch (error) {
    console.error('Error updating SiteSetting table:', error);
  }
}

updateJamOperasional()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
