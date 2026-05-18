import prisma from "../src/db/prisma.js";

/**
 * Migrate v1 scenarios to asset-type scoped variants
 *
 * Problem: v1 scenarios have assetTypeScope = NULL (run on all 162 trades)
 * while v2 scenarios have specific scopes (102 ETF, 60 STOCK trades).
 * This makes results incomparable in rankings.
 *
 * Solution: Deactivate unscoped v1 scenarios, create ETF/STOCK variants.
 */

const V1_SCENARIOS = [
  { name: "Fixed +1% Target", targetPct: 0.01, targetIsHardExit: true },
  { name: "Fixed -1.5% Stop", stopPct: -0.015 },
  { name: "Trail 0.5% (activate at +0.5%)", targetPct: 0.005, targetIsHardExit: false, trailingStopPct: -0.005 },
  { name: "Trail 1% (activate at +1%)", targetPct: 0.01, targetIsHardExit: false, trailingStopPct: -0.01 },
  { name: "+1% Target OR Trail 0.5%", targetPct: 0.01, targetIsHardExit: false, trailingStopPct: -0.005 },
  { name: "1 Day Max Hold", maxHoldBars: 78 },
];

async function main() {
  console.log("Migrating v1 scenarios to asset-type scoped variants...\n");

  try {
    // Find unscoped v1 scenarios
    const unscopedScenarios = await prisma.exitScenario.findMany({
      where: {
        name: {
          in: V1_SCENARIOS.map((s) => s.name),
        },
        assetTypeScope: null,
      },
    });

    console.log(`Found ${unscopedScenarios.length} unscoped v1 scenarios to migrate`);

    for (const oldScenario of unscopedScenarios) {
      console.log(`\n  Migrating: ${oldScenario.name}`);

      // Create ETF variant
      const etfScenario = await prisma.exitScenario.upsert({
        where: { name: `ETF: ${oldScenario.name}` },
        update: {
          assetTypeScope: "ETF",
          targetPct: oldScenario.targetPct,
          targetIsHardExit: oldScenario.targetIsHardExit,
          stopPct: oldScenario.stopPct,
          trailingStopPct: oldScenario.trailingStopPct,
          trailActivateAfterPct: oldScenario.trailActivateAfterPct,
          maxHoldBars: oldScenario.maxHoldBars,
        },
        create: {
          name: `ETF: ${oldScenario.name}`,
          assetTypeScope: "ETF",
          targetPct: oldScenario.targetPct,
          targetIsHardExit: oldScenario.targetIsHardExit,
          stopPct: oldScenario.stopPct,
          trailingStopPct: oldScenario.trailingStopPct,
          trailActivateAfterPct: oldScenario.trailActivateAfterPct,
          maxHoldBars: oldScenario.maxHoldBars,
        },
      });
      console.log(`    ✓ Created ETF variant (ID: ${etfScenario.id})`);

      // Create STOCK variant
      const stockScenario = await prisma.exitScenario.upsert({
        where: { name: `STOCK: ${oldScenario.name}` },
        update: {
          assetTypeScope: "STOCK",
          targetPct: oldScenario.targetPct,
          targetIsHardExit: oldScenario.targetIsHardExit,
          stopPct: oldScenario.stopPct,
          trailingStopPct: oldScenario.trailingStopPct,
          trailActivateAfterPct: oldScenario.trailActivateAfterPct,
          maxHoldBars: oldScenario.maxHoldBars,
        },
        create: {
          name: `STOCK: ${oldScenario.name}`,
          assetTypeScope: "STOCK",
          targetPct: oldScenario.targetPct,
          targetIsHardExit: oldScenario.targetIsHardExit,
          stopPct: oldScenario.stopPct,
          trailingStopPct: oldScenario.trailingStopPct,
          trailActivateAfterPct: oldScenario.trailActivateAfterPct,
          maxHoldBars: oldScenario.maxHoldBars,
        },
      });
      console.log(`    ✓ Created STOCK variant (ID: ${stockScenario.id})`);

      // Deactivate unscoped original
      await prisma.exitScenario.update({
        where: { id: oldScenario.id },
        data: { active: false },
      });
      console.log(`    ✓ Deactivated unscoped original (ID: ${oldScenario.id})`);
    }

    // Summary
    const finalCount = await prisma.exitScenario.count({
      where: { active: true },
    });
    const etfCount = await prisma.exitScenario.count({
      where: { active: true, assetTypeScope: "ETF" },
    });
    const stockCount = await prisma.exitScenario.count({
      where: { active: true, assetTypeScope: "STOCK" },
    });

    console.log(`\n✅ Migration complete!`);
    console.log(`\nFinal scenario counts (active only):`);
    console.log(`  Total: ${finalCount}`);
    console.log(`  ETF-scoped: ${etfCount}`);
    console.log(`  STOCK-scoped: ${stockCount}`);
    console.log(
      `\nAll active scenarios now have asset-type scoping.`
    );
    console.log(`Next backtest run will use properly scoped scenarios.`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
