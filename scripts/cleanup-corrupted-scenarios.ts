import prisma from "../src/db/prisma.js";

async function main() {
  console.log("Cleaning up corrupted scenario names...");

  // Find scenarios with corrupted arrow characters
  const allScenarios = await prisma.exitScenario.findMany();

  const corruptedScenarios = allScenarios.filter(s =>
    s.name.includes("â†'") || s.name.includes("â") ||
    (s.name.includes("Unlock") && !s.name.includes("->"))
  );

  if (corruptedScenarios.length === 0) {
    console.log("No corrupted scenarios found.");
    return;
  }

  console.log(`Found ${corruptedScenarios.length} corrupted scenarios:`);
  for (const scenario of corruptedScenarios) {
    console.log(`  - ${scenario.name} (ID: ${scenario.id})`);
  }

  // Delete BacktestTrade records first (they reference ExitScenario)
  console.log("\nRemoving backtest trades with corrupted scenarios...");
  for (const scenario of corruptedScenarios) {
    const deleted = await prisma.backtestTrade.deleteMany({
      where: { scenarioId: scenario.id },
    });
    console.log(`  Removed ${deleted.count} backtest trades for: ${scenario.name}`);
  }

  // Delete BacktestRunScenario references
  console.log("\nRemoving scenario references from backtest runs...");
  for (const scenario of corruptedScenarios) {
    const deleted = await prisma.backtestRunScenario.deleteMany({
      where: { scenarioId: scenario.id },
    });
    console.log(`  Removed ${deleted.count} run references for: ${scenario.name}`);
  }

  // Now delete the corrupted scenarios
  console.log("\nDeleting corrupted scenarios...");
  for (const scenario of corruptedScenarios) {
    await prisma.exitScenario.delete({
      where: { id: scenario.id },
    });
    console.log(`  Deleted: ${scenario.name}`);
  }

  console.log(`\n✅ Cleanup complete. Deleted ${corruptedScenarios.length} corrupted scenarios.`);

  // Final count
  const finalCount = await prisma.exitScenario.count();
  const etfCount = await prisma.exitScenario.count({ where: { assetTypeScope: "ETF" } });
  const stockCount = await prisma.exitScenario.count({ where: { assetTypeScope: "STOCK" } });

  console.log(`\nFinal counts:`);
  console.log(`  Total: ${finalCount}`);
  console.log(`  ETF-scoped: ${etfCount}`);
  console.log(`  Stock-scoped: ${stockCount}`);
}

main()
  .catch((err) => {
    console.error("Error during cleanup:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
