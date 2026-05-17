import prisma from "../src/db/prisma.js";

async function main() {
  console.log("\n🧹 Cleaning up trade data...\n");

  try {
    // Delete in dependency order (respecting foreign keys)
    console.log("  Deleting backtest trades...");
    const deletedBacktestTrades = await prisma.backtestTrade.deleteMany({});
    console.log(`  ✓ Deleted ${deletedBacktestTrades.count} backtest trades`);

    console.log("  Deleting backtest summaries...");
    const deletedSummaries = await prisma.backtestSummary.deleteMany({});
    console.log(`  ✓ Deleted ${deletedSummaries.count} summaries`);

    console.log("  Deleting backtest run scenarios...");
    const deletedRunScenarios = await prisma.backtestRunScenario.deleteMany({});
    console.log(`  ✓ Deleted ${deletedRunScenarios.count} run scenarios`);

    console.log("  Deleting backtest runs...");
    const deletedRuns = await prisma.backtestRun.deleteMany({});
    console.log(`  ✓ Deleted ${deletedRuns.count} runs`);

    console.log("  Deleting actual orders...");
    const deletedOrders = await prisma.actualOrder.deleteMany({});
    console.log(`  ✓ Deleted ${deletedOrders.count} orders`);

    console.log("  Deleting actual trades...");
    const deletedTrades = await prisma.actualTrade.deleteMany({});
    console.log(`  ✓ Deleted ${deletedTrades.count} actual trades`);

    console.log("\n✓ Cleanup complete!\n");
    console.log("Next steps:");
    console.log("  1. npm run import-trades --file data/orders.csv");
    console.log("  2. npm run run-backtest --name '...' --description '...'\n");
  } catch (error) {
    console.error("\n✗ Cleanup failed:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    } else {
      console.error(`  ${error}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
