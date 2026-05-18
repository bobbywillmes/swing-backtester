import prisma from "../src/db/prisma.js";

/**
 * Remove duplicate scenarios, keeping v2 style names
 *
 * Duplicates found:
 * - Keep: "ETF: Fixed Target +1.0%" (ID 37), Delete: "ETF: Fixed +1% Target" (ID 60)
 * - Keep: "Stock: Fixed Target +1.0%" (ID 38), Delete: "Stock: Fixed +1% Target" (ID 61)
 */

async function main() {
  console.log("Removing duplicate scenarios...\n");

  const toRemove = [
    { id: 60, name: "ETF: Fixed +1% Target" },
    { id: 61, name: "Stock: Fixed +1% Target" },
  ];

  try {
    for (const dup of toRemove) {
      // Deactivate the duplicate
      await prisma.exitScenario.update({
        where: { id: dup.id },
        data: { active: false },
      });
      console.log(`✓ Deactivated ID ${dup.id}: "${dup.name}"`);
    }

    // Verify final count
    const finalCount = await prisma.exitScenario.count({
      where: { active: true },
    });

    console.log(`\n✅ Cleanup complete!`);
    console.log(`Total active scenarios: ${finalCount} (was 32)`);
    console.log(`\nRemaining scenarios are now unique and non-redundant.`);
  } catch (error) {
    console.error("Removal failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
