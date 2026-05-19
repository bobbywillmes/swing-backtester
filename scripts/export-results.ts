import { writeFileSync } from "fs";
import { mkdir } from "fs/promises";
import { join } from "path";
import prisma from "../src/db/prisma.js";
import { getBacktestRun, getMostRecentRun, getRunAllTrades } from "../src/services/results.service.js";
import { calculateMetrics } from "../src/analysis/metrics.calculator.js";
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

  const runId = params.runId ? parseInt(params.runId, 10) : undefined;
  if (params.runId && isNaN(runId!)) {
    console.error("Usage: npx tsx scripts/export-results.ts [--runId <id>]");
    process.exit(1);
  }

  return { runId: runId || 0 };
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function determineScenarioGroup(scenario: {
  targetPct: number | null;
  targetIsHardExit: boolean | null;
  trailingStopPct: number | null;
}): string {
  if (scenario.targetPct && scenario.targetIsHardExit === false) {
    return "Target Unlocks Trail";
  } else if (scenario.targetPct && scenario.targetIsHardExit !== false) {
    return "Fixed Target";
  } else {
    return "Trail Only";
  }
}

function formatDateTimeForExcel(date: Date | null | undefined): string {
  if (!date) return "N/A";

  // Convert UTC to Eastern Time (EDT/EST)
  const utcDate = new Date(date);

  // Determine if EDT (daylight saving) or EST
  // EDT is roughly March 12 - November 5
  const month = utcDate.getUTCMonth();
  const day = utcDate.getUTCDate();
  const dayOfWeek = utcDate.getUTCDay();

  // Simple EDT check (March to November, except early/late period)
  let isEDT = false;
  if (month > 2 && month < 10) {
    isEDT = true;
  } else if (month === 2) {
    // March: EDT starts second Sunday
    if (day > 8 && day <= 14 && dayOfWeek === 0) {
      isEDT = true;
    } else if (day > 14) {
      isEDT = true;
    }
  } else if (month === 10) {
    // November: EDT ends first Sunday
    if (day < 8 || (day >= 8 && day <= 14 && dayOfWeek !== 0)) {
      isEDT = true;
    }
  }

  const offset = isEDT ? -4 : -5; // EDT is UTC-4, EST is UTC-5
  const easternDate = new Date(utcDate.getTime() + offset * 60 * 60 * 1000);

  const year = easternDate.getUTCFullYear();
  const month_num = String(easternDate.getUTCMonth() + 1).padStart(2, "0");
  const day_num = String(easternDate.getUTCDate()).padStart(2, "0");
  const hours24 = easternDate.getUTCHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = String(easternDate.getUTCMinutes()).padStart(2, "0");
  const seconds = String(easternDate.getUTCSeconds()).padStart(2, "0");
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const tz = isEDT ? "EDT" : "EST";

  return `${year}-${month_num}-${day_num} ${String(hours12).padStart(2, "0")}:${minutes}:${seconds} ${ampm} ${tz}`;
}

async function main() {
  const args = parseArgs();

  try {
    let runId = args.runId;
    if (!runId) {
      const mostRecentId = await getMostRecentRun();
      if (!mostRecentId) {
        console.error("\n✗ No backtest runs found\n");
        process.exit(1);
      }
      runId = mostRecentId;
    }

    const run = await getBacktestRun(runId);

    if (!run.summaries || run.summaries.length === 0) {
      console.error(`\n✗ No results found for run ${runId}\n`);
      process.exit(1);
    }

    // Create export directory
    const exportDir = join("exports");
    await mkdir(exportDir, { recursive: true });

    console.log(`\nExporting results for run ${runId}...`);

    // 1. Export scenario summaries
    const scenariosWithMetrics = run.summaries.map((summary) => ({
      id: summary.scenarioId,
      name: "",
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

    // Get scenario names
    scenariosWithMetrics.forEach((s) => {
      const scenario = run.scenarios.find((rs) => rs.scenarioId === s.id);
      if (scenario) {
        s.name = scenario.scenario.name;
      }
    });

    const rankings = rankScenarios(scenariosWithMetrics);

    // Export rankings CSV
    let rankingsCSV = `Rank,Scenario,Score,Trades,Wins,Losses,Open,Win Rate,Profit Factor,Expectancy,Avg PnL %,Best Trade %,Worst Trade %,vs Actual %,Improved Trades,Hold Time (bars),Hold Time (days)\n`;

    for (const ranking of rankings) {
      rankingsCSV += [
        ranking.rank,
        escapeCSV(ranking.scenarioName),
        (ranking.score * 100).toFixed(1),
        ranking.metrics.totalTrades,
        ranking.metrics.wins,
        ranking.metrics.losses,
        ranking.metrics.openTrades,
        (ranking.metrics.winRate * 100).toFixed(2),
        ranking.metrics.profitFactor.toFixed(2),
        (ranking.metrics.expectancy * 100).toFixed(2),
        (ranking.metrics.avgPnlPct * 100).toFixed(2),
        (ranking.metrics.bestTradePct * 100).toFixed(2),
        (ranking.metrics.worstTradePct * 100).toFixed(2),
        (ranking.metrics.avgPnlVsActualPct * 100).toFixed(2),
        ranking.metrics.improvementRate > 0
          ? ranking.metrics.totalTrades * ranking.metrics.improvementRate
          : 0,
        ranking.metrics.avgBarsInTrade.toFixed(0),
        ranking.metrics.avgDaysInTrade.toFixed(2),
      ]
        .map(escapeCSV)
        .join(",");
      rankingsCSV += "\n";
    }

    const rankingsFile = join(exportDir, `run-${runId}-rankings.csv`);
    writeFileSync(rankingsFile, rankingsCSV);
    console.log(`✓ Exported rankings: ${rankingsFile}`);

    // 2. Export all scenario trades
    const allTrades = await getRunAllTrades(runId);

    console.log(`Debug: Retrieved ${allTrades.length} backtest trade records`);

    // Count unique actualTrade IDs
    const uniqueActualTrades = new Set(allTrades.map((t) => t.actualTrade.id));
    const uniqueOrderIds = new Set(
      allTrades.map((t) => t.actualTrade.orders[0]?.etradeOrderId || "UNKNOWN")
    );
    const withoutOrderIds = allTrades.filter((t) => !t.actualTrade.orders[0]?.etradeOrderId).length;

    console.log(`Debug: ${uniqueActualTrades.size} unique actual trades`);
    console.log(`Debug: ${uniqueOrderIds.size} unique order IDs`);
    console.log(`Debug: ${withoutOrderIds} trades without order IDs`);
    console.log(`Debug: Expected rows: 6 scenarios × ${uniqueOrderIds.size - 1} orders = ${6 * (uniqueOrderIds.size - 1)}`);

    if (allTrades.length > 0) {
      // Comprehensive flat export with all v2 context columns
      let tradesCSV = `Order ID,Ticker,Asset Type,Entry Date,Entry Price,Shares,Capital Deployed,Entry Type,Scenario Name,Scenario Group,Trail %,Trail Activate %,Target %,Target Is Hard Exit,Stop %,Max Hold Bars,Exit Date,Exit Price,Exit Reason,Result %,Result $,vs Actual %,vs Actual $,Bars Held,Days Held,Running High $,Running High %,Trail Activated At,Actual Exit Date,Actual Exit Price,Actual Result %,Actual Result $,Regime at Entry,SPY ATR % at Entry\n`;

      for (const trade of allTrades) {
        const entryDateTime = formatDateTimeForExcel(trade.actualTrade.entryTs);
        const exitDateTime = formatDateTimeForExcel(trade.exitTs);
        const actualExitDateTime = formatDateTimeForExcel(
          trade.actualTrade.actualExitTs
        );
        const trailActivatedDateTime = formatDateTimeForExcel(
          trade.trailActivatedAt
        );

        const orderId = trade.actualTrade.orders[0]?.etradeOrderId || "N/A";
        const ticker = trade.actualTrade.ticker;
        const assetType = trade.actualTrade.security?.assetType || "UNKNOWN";
        const entryPrice = trade.actualTrade.entryPrice.toFixed(2);
        const shares = trade.actualTrade.shares.toFixed(0);
        const capitalDeployed = (
          trade.actualTrade.entryPrice * trade.actualTrade.shares
        ).toFixed(2);

        // Determine entry type based on addCount
        let entryType = "Single Entry";
        if (trade.actualTrade.addCount === 1) {
          entryType = "Double-Down";
        } else if (trade.actualTrade.addCount >= 2) {
          entryType = `Add(${trade.actualTrade.addCount})`;
        }

        const scenarioName = trade.scenario.name;
        const scenarioGroup = determineScenarioGroup(trade.scenario);

        const trailingStopPct = trade.scenario.trailingStopPct
          ? (trade.scenario.trailingStopPct * 100).toFixed(2) + "%"
          : "N/A";
        const trailActivateAfterPct = trade.scenario.trailActivateAfterPct
          ? (trade.scenario.trailActivateAfterPct * 100).toFixed(2) + "%"
          : "N/A";
        const targetPct = trade.scenario.targetPct
          ? (trade.scenario.targetPct * 100).toFixed(2) + "%"
          : "N/A";
        const stopPct = trade.scenario.stopPct
          ? (trade.scenario.stopPct * 100).toFixed(2) + "%"
          : "N/A";

        const exitPrice = trade.exitPrice?.toFixed(2) || "OPEN";
        const resultPct = trade.pnlPct
          ? (trade.pnlPct * 100).toFixed(2) + "%"
          : "N/A";
        const resultDollar = trade.pnlDollar?.toFixed(2) || "N/A";
        const vsActualPct = trade.pnlVsActualPct
          ? (trade.pnlVsActualPct * 100).toFixed(2) + "%"
          : "N/A";
        const vsActualDollar = trade.pnlVsActualDollar?.toFixed(2) || "N/A";
        const bars = trade.barsInTrade || "N/A";
        const days =
          trade.barsInTrade && trade.barsInTrade > 0
            ? (trade.barsInTrade / 78).toFixed(2)
            : "N/A";
        const runningHigh = trade.runningHighPrice?.toFixed(2) || "N/A";
        const runningHighPct = trade.runningHighPct
          ? (trade.runningHighPct * 100).toFixed(2) + "%"
          : "N/A";

        const actualExitPrice = trade.actualTrade.actualExitPrice?.toFixed(2) || "OPEN";
        const actualResultPct = trade.actualTrade.actualPnlPct
          ? (trade.actualTrade.actualPnlPct * 100).toFixed(2) + "%"
          : "N/A";
        const actualResultDollar = trade.actualTrade.actualPnlDollar?.toFixed(2) || "N/A";

        const regimeAtEntry = trade.regimeAtEntry || "N/A";
        const spyAtrPctAtEntry = trade.spyAtrPctAtEntry
          ? (trade.spyAtrPctAtEntry * 100).toFixed(2) + "%"
          : "N/A";

        tradesCSV += [
          orderId,
          ticker,
          assetType,
          entryDateTime,
          entryPrice,
          shares,
          capitalDeployed,
          entryType,
          escapeCSV(scenarioName),
          escapeCSV(scenarioGroup),
          trailingStopPct,
          trailActivateAfterPct,
          targetPct,
          trade.scenario.targetIsHardExit !== false ? "Yes" : "No",
          stopPct,
          trade.scenario.maxHoldBars || "N/A",
          exitDateTime,
          exitPrice,
          trade.exitReason || "OPEN",
          resultPct,
          resultDollar,
          vsActualPct,
          vsActualDollar,
          bars,
          days,
          runningHigh,
          runningHighPct,
          trailActivatedDateTime,
          actualExitDateTime,
          actualExitPrice,
          actualResultPct,
          actualResultDollar,
          regimeAtEntry,
          spyAtrPctAtEntry,
        ]
          .map(escapeCSV)
          .join(",");
        tradesCSV += "\n";
      }

      const tradesFile = join(exportDir, `run-${runId}-scenario-trades.csv`);
      writeFileSync(tradesFile, tradesCSV);
      console.log(
        `✓ Exported comprehensive trades CSV (${allTrades.length} rows): ${tradesFile}`
      );
    }

    // 3. Export run metadata
    let metadataCSV = `Field,Value\n`;
    metadataCSV += `Run ID,${runId}\n`;
    metadataCSV += `Run Name,${escapeCSV(run.name)}\n`;
    metadataCSV += `Description,${escapeCSV(run.description || "")}\n`;
    metadataCSV += `Status,${run.status}\n`;
    metadataCSV += `Created,${run.createdAt.toISOString()}\n`;
    metadataCSV += `Completed,${run.completedAt?.toISOString() || "N/A"}\n`;
    metadataCSV += `Scenarios,${run.scenarios.length}\n`;
    metadataCSV += `Filter Tickers,${run.filterTickers.join("; ") || "All"}\n`;
    metadataCSV += `Filter Date From,${run.filterDateFrom?.toISOString().split("T")[0] || "All"}\n`;
    metadataCSV += `Filter Date To,${run.filterDateTo?.toISOString().split("T")[0] || "All"}\n`;

    const metadataFile = join(exportDir, `run-${runId}-metadata.csv`);
    writeFileSync(metadataFile, metadataCSV);
    console.log(`✓ Exported metadata: ${metadataFile}`);

    console.log(`\n📁 All files exported to: ${exportDir}/\n`);
  } catch (error) {
    console.error("\n✗ Export failed:");
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
