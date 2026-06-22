import prisma from "../src/db/prisma.js";
import { SECURITY_CATALOG } from "../src/data/security-catalog.js";

async function main() {
  console.log("Seeding securities...");

  for (const security of SECURITY_CATALOG) {
    const created = await prisma.security.upsert({
      where: { symbol: security.symbol },
      update: {
        name: security.name,
        assetType: security.assetType,
      },
      create: security,
    });
    console.log(`- ${created.symbol} - ${created.name} (${created.assetType})`);
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
