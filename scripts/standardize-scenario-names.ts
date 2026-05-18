import prisma from "../src/db/prisma.js";

/**
 * Standardize scenario name casing
 * Convert "STOCK:" to "Stock:" and keep "ETF:" consistent
 */

async function main() {
  console.log("Standardizing scenario name casing...\n");

  try {
    // Find all scenarios with STOCK: prefix
    const stockScenarios = await prisma.exitScenario.findMany({
      where: {
        name: {
          startsWith: "STOCK:",
        },
      },
    });

    console.log(`Found ${stockScenarios.length} scenarios with "STOCK:" prefix`);

    for (const scenario of stockScenarios) {
      const newName = scenario.name.replace("STOCK:", "Stock:");
      await prisma.exitScenario.update({
        where: { id: scenario.id },
        data: { name: newName },
      });
      console.log(`  ✓ Renamed: "${scenario.name}" → "${newName}"`);
    }

    // Verify all scenario names now have consistent casing
    const allScenarios = await prisma.exitScenario.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    console.log(`\n✅ Standardization complete!`);
    console.log(`\nAll ${allScenarios.length} active scenarios:`);
    allScenarios.forEach((s) => {
      console.log(`  - ${s.name}`);
    });
  } catch (error) {
    console.error("Standardization failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
