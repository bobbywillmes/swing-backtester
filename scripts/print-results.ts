import prisma from "../src/db/prisma.js";
import { getBacktestRun, getRunTrades } from "../src/services/results.service.js";
import {
  calculateMetrics,
  formatPercentage,
  formatDollar,
  formatBars,
} from "../src/analysis/metrics.calculator.js";
import { rankScenarios } from "../src/analysis/scenario.ranker.js";

interface Args {
  runId: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    const value = args[i + 1];
    if (value) {
      params[key] = value;
    }
  }

  const runId = parseInt(params.runId || "", 10);
  if (!params.runId || isNaN(runId)) {
    console.error("Usage: npx tsx scripts/print-results.ts --runId <id>");
    console.error("\nExample: npx tsx scripts/print-results.ts --runId 1");
    process.exit(1);
  }

  return { runId };
}

async function main() {
  const args = parseArgs();

  try {
    const run = await getBacktestRun(args.runId);

    if (!run.summaries || run.summaries.length === 0) {
      console.error(`\n✗ No results found for run ${args.runId}\n`);
      process.exit(1);
    }

    console.log("\n" + "=".repeat(80));
    console.log("BACKTEST RESULTS");
    console.log("=".repeat(80));

    console.log(`\nRun: ${run.name}`);
    if (run.description) {
      console.log(`Description: ${run.description}`);
    }
    console.log(`Status: ${run.status}`);
    console.log(`Created: ${run.createdAt.toISOString()}`);
    if (run.completedAt) {
      console.log(`Completed: ${run.completedAt.toISOString()}`);
    }

    if (run.filterTickers && run.filterTickers.length > 0) {
      console.log(`Tickers: ${run.filterTickers.join(", ")}`);
    }
    if (run.filterDateFrom || run.filterDateTo) {
      const from = run.filterDateFrom
        ? run.filterDateFrom.toISOString().split("T")[0]
        : "all";
      const to = run.filterDateTo
        ? run.filterDateTo.toISOString().split("T")[0]
        : "all";
      console.log(`Date Range: ${from} to ${to}`);
    }

    // Calculate metrics for each summary
    const scenariosWithMetrics = run.summaries.map((summary) => ({
      id: summary.scenarioId,
      name: summary.id.toString(), // Will be populated below
      metrics: calculateMetrics({
        totalTrades: summary.totalTrades,
        wins: summary.wins,
        losses: summary.losses,
        openTrades: summary.openTrades,
        winRate: summary.winRate,
        avgPnlPct: summary.avgPnlPct,
        totalPnlPct: summary.totalPnlPct,
        bestTradePct: summary.bestTradePct,
        worstTradePct: summary.worstTradePct,
        avgWinPct: summary.avgWinPct,
        avgLossPct: summary.avgLossPct,
        avgBarsInTrade: summary.avgBarsInTrade,
        avgDaysInTrade: summary.avgDaysInTrade,
        avgPnlVsActualPct: summary.avgPnlVsActualPct,
        totalPnlVsActualDollar: summary.totalPnlVsActualDollar,
        tradesImproved: summary.tradesImproved,
      }),
    }));

    // Get scenario names from run.scenarios
    scenariosWithMetrics.forEach((s) => {
      const scenario = run.scenarios.find((rs) => rs.scenarioId === s.id);
      if (scenario) {
        s.name = scenario.scenario.name;
      }
    });

    // Rank scenarios
    const rankings = rankScenarios(scenariosWithMetrics);

    // Display rankings
    console.log("\n" + "=".repeat(80));
    console.log("SCENARIO RANKINGS");
    console.log("=".repeat(80));

    for (const ranking of rankings) {
      console.log(
        `\n${ranking.rank}. ${ranking.scenarioName} (Score: ${(ranking.score * 100).toFixed(1)})`
      );
      console.log(`   Trades: ${ranking.metrics.totalTrades} (W: ${ranking.metrics.wins}, L: ${ranking.metrics.losses}, Open: ${ranking.metrics.openTrades})`);
      console.log(
        `   Win Rate: ${formatPercentage(ranking.metrics.winRate)} | Profit Factor: ${ranking.metrics.profitFactor.toFixed(2)}`
      );
      console.log(
        `   Avg PnL: ${formatPercentage(ranking.metrics.avgPnlPct)} | Best: ${formatPercentage(ranking.metrics.bestTradePct)} | Worst: ${formatPercentage(ranking.metrics.worstTradePct)}`
      );
      console.log(
        `   Expectancy: ${formatPercentage(ranking.metrics.expectancy)} | vs Actual: ${formatPercentage(ranking.metrics.avgPnlVsActualPct)}`
      );
      console.log(
        `   Hold Time: ${formatBars(ranking.metrics.avgBarsInTrade)}`
      );
      console.log(`   Strengths: ${ranking.strengths.join(", ")}`);
      if (ranking.weaknesses.length > 0) {
        console.log(`   Weaknesses: ${ranking.weaknesses.join(", ")}`);
      }
    }

    // Display top scenario details
    if (rankings.length > 0) {
      const topScenario = rankings[0];
      console.log("\n" + "=".repeat(80));
      console.log("TOP SCENARIO DETAILS");
      console.log("=".repeat(80));
      console.log(`\n${topScenario.scenarioName}`);

      const trades = await getRunTrades(args.runId, topScenario.scenarioId);

      if (trades.length > 0) {
        console.log(
          `\nTrade Details (showing first 10 of ${trades.length}):`
        );
        console.log(
          "Ticker  Entry      Exit       Result      vs Actual   Bars"
        );
        console.log("-".repeat(68));

        for (const trade of trades.slice(0, 10)) {
          const exitPrice = trade.exitPrice
            ? trade.exitPrice.toFixed(2)
            : "OPEN";
          const result = trade.pnlPct ? formatPercentage(trade.pnlPct) : "N/A";
          const vsActual = trade.pnlVsActualDollar
            ? formatDollar(trade.pnlVsActualDollar)
            : "N/A";
          const bars = trade.barsInTrade ? trade.barsInTrade.toString() : "N/A";

          const ticker = trade.actualTrade.ticker.padEnd(7);
          const entry = `$${trade.actualTrade.entryPrice.toFixed(2)}`.padEnd(10);
          const exit = `$${exitPrice}`.padEnd(10);
          const res = result.padEnd(12);
          const vs = vsActual.padEnd(12);

          console.log(`${ticker} ${entry} ${exit} ${res} ${vs} ${bars}`);
        }

        if (trades.length > 10) {
          console.log(
            `... and ${trades.length - 10} more trades`
          );
        }
      }
    }

    console.log("\n" + "=".repeat(80) + "\n");
  } catch (error) {
    console.error("\n✗ Failed to retrieve results:");
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
