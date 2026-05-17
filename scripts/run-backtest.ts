import prisma from "../src/db/prisma.js";
import { runBacktest } from "../src/services/backtest.service.js";
import { getActiveScenarios } from "../src/services/scenario.service.js";

interface Args {
  name: string;
  description?: string;
  tickers?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};
  const tickers: string[] = [];

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    const value = args[i + 1];

    if (key === "ticker") {
      tickers.push(value.toUpperCase());
    } else if (value) {
      params[key] = value;
    }
  }

  if (!params.name) {
    console.error(
      "Usage: npx tsx scripts/run-backtest.ts --name <name> [--description <desc>] [--ticker SPY] [--dateFrom YYYY-MM-DD] [--dateTo YYYY-MM-DD]"
    );
    process.exit(1);
  }

  return {
    name: params.name,
    description: params.description,
    tickers: tickers.length > 0 ? tickers : undefined,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
  };
}

async function main() {
  const args = parseArgs();

  console.log(`\nRunning backtest: ${args.name}`);
  if (args.description) {
    console.log(`  Description: ${args.description}`);
  }
  if (args.tickers) {
    console.log(`  Tickers: ${args.tickers.join(", ")}`);
  }
  if (args.dateFrom) {
    console.log(`  From: ${args.dateFrom.toISOString().split("T")[0]}`);
  }
  if (args.dateTo) {
    console.log(`  To: ${args.dateTo.toISOString().split("T")[0]}`);
  }

  try {
    // Get active scenarios
    const scenarios = await getActiveScenarios();

    if (scenarios.length === 0) {
      console.error("\n✗ No active scenarios found.\n");
      process.exit(1);
    }

    console.log(`\nUsing ${scenarios.length} scenarios`);

    // Create backtest run
    console.log("Creating backtest run...");
    const run = await prisma.backtestRun.create({
      data: {
        name: args.name,
        description: args.description,
        filterTickers: args.tickers ?? [],
        filterDateFrom: args.dateFrom,
        filterDateTo: args.dateTo,
        scenarios: {
          create: scenarios.map((s) => ({
            scenarioId: s.id,
          })),
        },
      },
    });

    console.log(`✓ Run created (ID: ${run.id})`);

    // Run backtest
    console.log("\nRunning backtest simulation...");
    const startTime = Date.now();

    await runBacktest(
      run.id,
      args.tickers,
      args.dateFrom,
      args.dateTo
    );

    const duration = Date.now() - startTime;
    console.log(`✓ Backtest complete (${duration}ms)`);

    // Get and display summaries
    console.log("\n" + "=".repeat(60));
    console.log("RESULTS");
    console.log("=".repeat(60));

    const summaries = await prisma.backtestSummary.findMany({
      where: { runId: run.id },
      include: { run: false },
    });

    for (const summary of summaries) {
      console.log(`\nScenario: ${summary.scenarioId}`);
      console.log(`  Trades: ${summary.totalTrades} (W: ${summary.wins}, L: ${summary.losses}, Open: ${summary.openTrades})`);
      console.log(
        `  Win Rate: ${(summary.winRate * 100).toFixed(1)}%`
      );
      console.log(
        `  Avg PnL: ${(summary.avgPnlPct * 100).toFixed(2)}% | Best: ${(summary.bestTradePct * 100).toFixed(2)}% | Worst: ${(summary.worstTradePct * 100).toFixed(2)}%`
      );
      console.log(
        `  Avg P&L vs Actual: ${(summary.avgPnlVsActualPct * 100).toFixed(2)}% (Improved: ${summary.tradesImproved}, Worse: ${summary.tradesWorse})`
      );
      console.log(
        `  Avg Hold: ${summary.avgBarsInTrade.toFixed(0)} bars (${summary.avgDaysInTrade.toFixed(2)} days)`
      );
    }

    console.log("\n" + "=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n✗ Backtest failed:");
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
