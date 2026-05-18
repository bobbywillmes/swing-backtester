import prisma from "../db/prisma.js";
import { getCandlesByTicker } from "./ohlc.service.js";
import { createBacktestEngine } from "../engine/backtest.engine.js";
import { OhlcBar, ScenarioConfig, TradeConfig } from "../types/engine.types.js";
import { ExitScenarioInput } from "../types/scenario.types.js";

export async function createExitScenario(
  input: ExitScenarioInput
): Promise<{ id: number; name: string }> {
  return prisma.exitScenario.create({
    data: {
      name: input.name,
      description: input.description,
      targetPct: input.targetPct ?? null,
      targetIsHardExit: input.targetIsHardExit ?? true,
      stopPct: input.stopPct ?? null,
      trailingStopPct: input.trailingStopPct ?? null,
      trailActivateAfterPct: input.trailActivateAfterPct ?? null,
      maxHoldBars: input.maxHoldBars ?? null,
      assetTypeScope: input.assetTypeScope ?? null,
    },
    select: { id: true, name: true },
  });
}

export async function runBacktest(
  backtestRunId: number,
  filterTickers?: string[],
  filterDateFrom?: Date,
  filterDateTo?: Date
): Promise<void> {
  // Mark run as running
  await prisma.backtestRun.update({
    where: { id: backtestRunId },
    data: { status: "RUNNING" },
  });

  try {
    const engine = createBacktestEngine();

    // Get the backtest run with its scenarios
    const run = await prisma.backtestRun.findUniqueOrThrow({
      where: { id: backtestRunId },
      include: {
        scenarios: {
          include: { scenario: true },
        },
      },
    });

    // Get trades to backtest
    const tradeWhere: {
      ticker?: { in: string[] };
      entryTs?: { gte?: Date; lte?: Date };
    } = {};

    if (filterTickers && filterTickers.length > 0) {
      tradeWhere.ticker = { in: filterTickers };
    }

    if (filterDateFrom || filterDateTo) {
      tradeWhere.entryTs = {};
      if (filterDateFrom) tradeWhere.entryTs.gte = filterDateFrom;
      if (filterDateTo) tradeWhere.entryTs.lte = filterDateTo;
    }

    const trades = await prisma.actualTrade.findMany({
      where: tradeWhere,
    });

    // Run backtest for each trade and scenario
    for (const trade of trades) {
      // Get candles starting from entry
      const candles = await getCandlesByTicker(trade.ticker, trade.entryTs);

      if (candles.length === 0) {
        continue; // Skip trades with no candle data
      }

      const ohlcBars: OhlcBar[] = candles.map((c) => ({
        ts: c.ts,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      for (const runScenario of run.scenarios) {
        const scenario: ScenarioConfig = {
          id: runScenario.scenario.id,
          name: runScenario.scenario.name,
          targetPct: runScenario.scenario.targetPct,
          targetIsHardExit: runScenario.scenario.targetIsHardExit,
          stopPct: runScenario.scenario.stopPct,
          trailingStopPct: runScenario.scenario.trailingStopPct,
          trailActivateAfterPct: runScenario.scenario.trailActivateAfterPct,
          maxHoldBars: runScenario.scenario.maxHoldBars,
        };

        const tradeConfig: TradeConfig = {
          ticker: trade.ticker,
          entryPrice: trade.entryPrice,
          shares: trade.shares,
          entryTs: trade.entryTs,
          actualExitPrice: trade.actualExitPrice,
          actualExitTs: trade.actualExitTs,
          actualPnlPct: trade.actualPnlPct,
          actualPnlDollar: trade.actualPnlDollar,
        };

        const result = engine.runTrade(tradeConfig, ohlcBars, scenario);

        // Get market regime at entry date
        const entryDateMidnight = new Date(trade.entryTs);
        entryDateMidnight.setUTCHours(0, 0, 0, 0);
        const regime = await prisma.marketRegime.findUnique({
          where: { date: entryDateMidnight },
          select: { regime: true, spyAtrPct: true },
        });

        // Write BacktestTrade result
        await prisma.backtestTrade.upsert({
          where: {
            runId_actualTradeId_scenarioId: {
              runId: backtestRunId,
              actualTradeId: trade.id,
              scenarioId: scenario.id,
            },
          },
          update: {
            exitTs: result.exitTs,
            exitPrice: result.exitPrice,
            exitReason: result.exitReason,
            pnlPct: result.pnlPct,
            pnlDollar: result.pnlDollar,
            pnlVsActualPct: result.pnlVsActualPct,
            pnlVsActualDollar: result.pnlVsActualDollar,
            barsInTrade: result.barsInTrade,
            runningHighPrice: result.runningHighPrice,
            runningHighPct: result.runningHighPct,
            trailActivatedAt: result.trailActivatedAt,
            regimeAtEntry: regime?.regime ?? null,
            spyAtrPctAtEntry: regime?.spyAtrPct ?? null,
          },
          create: {
            runId: backtestRunId,
            actualTradeId: trade.id,
            scenarioId: scenario.id,
            exitTs: result.exitTs,
            exitPrice: result.exitPrice,
            exitReason: result.exitReason,
            pnlPct: result.pnlPct,
            pnlDollar: result.pnlDollar,
            pnlVsActualPct: result.pnlVsActualPct,
            pnlVsActualDollar: result.pnlVsActualDollar,
            barsInTrade: result.barsInTrade,
            runningHighPrice: result.runningHighPrice,
            runningHighPct: result.runningHighPct,
            trailActivatedAt: result.trailActivatedAt,
            regimeAtEntry: regime?.regime ?? null,
            spyAtrPctAtEntry: regime?.spyAtrPct ?? null,
          },
        });
      }
    }

    // Compute summaries for each scenario
    await computeBacktestSummaries(backtestRunId);

    // Mark run as complete
    await prisma.backtestRun.update({
      where: { id: backtestRunId },
      data: { status: "COMPLETE", completedAt: new Date() },
    });
  } catch (error) {
    // Mark run as failed
    await prisma.backtestRun.update({
      where: { id: backtestRunId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

async function computeBacktestSummaries(backtestRunId: number): Promise<void> {
  const run = await prisma.backtestRun.findUniqueOrThrow({
    where: { id: backtestRunId },
    include: {
      scenarios: {
        include: { scenario: true },
      },
    },
  });

  for (const runScenario of run.scenarios) {
    const trades = await prisma.backtestTrade.findMany({
      where: {
        runId: backtestRunId,
        scenarioId: runScenario.scenario.id,
      },
    });

    if (trades.length === 0) continue;

    const closedTrades = trades.filter((t) => t.exitReason !== "OPEN");
    const openTrades = trades.filter((t) => t.exitReason === "OPEN");
    const wins = closedTrades.filter((t) => t.pnlPct !== null && t.pnlPct > 0);
    const losses = closedTrades.filter(
      (t) => t.pnlPct !== null && t.pnlPct < 0
    );

    const totalPnlPct = trades.reduce((sum, t) => sum + (t.pnlPct ?? 0), 0);
    const avgPnlPct = closedTrades.length > 0 ? totalPnlPct / closedTrades.length : 0;
    const avgWinPct =
      wins.length > 0
        ? wins.reduce((sum, t) => sum + (t.pnlPct ?? 0), 0) / wins.length
        : 0;
    const avgLossPct =
      losses.length > 0
        ? losses.reduce((sum, t) => sum + (t.pnlPct ?? 0), 0) / losses.length
        : 0;
    const pnlValues = trades.filter((t) => t.pnlPct !== null).map((t) => t.pnlPct!);
    const bestTradePct = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
    const worstTradePct = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

    const winRate =
      closedTrades.length > 0 ? wins.length / closedTrades.length : 0;

    const avgPnlVsActualPct =
      trades.length > 0
        ? trades.reduce((sum, t) => sum + (t.pnlVsActualPct ?? 0), 0) /
          trades.length
        : 0;
    const totalPnlVsActualDollar = trades.reduce(
      (sum, t) => sum + (t.pnlVsActualDollar ?? 0),
      0
    );
    const tradesImproved = trades.filter(
      (t) => t.pnlVsActualDollar !== null && t.pnlVsActualDollar > 0
    ).length;
    const tradesWorse = trades.filter(
      (t) => t.pnlVsActualDollar !== null && t.pnlVsActualDollar < 0
    ).length;

    const avgBarsInTrade =
      closedTrades.length > 0
        ? closedTrades.reduce((sum, t) => sum + (t.barsInTrade ?? 0), 0) /
          closedTrades.length
        : 0;
    const avgDaysInTrade = avgBarsInTrade / 78; // 78 bars per trading day

    const avgRunningHighPct =
      trades.length > 0
        ? trades.reduce((sum, t) => sum + (t.runningHighPct ?? 0), 0) /
          trades.length
        : 0;

    await prisma.backtestSummary.upsert({
      where: {
        runId_scenarioId: {
          runId: backtestRunId,
          scenarioId: runScenario.scenario.id,
        },
      },
      update: {
        totalTrades: trades.length,
        wins: wins.length,
        losses: losses.length,
        openTrades: openTrades.length,
        winRate,
        totalPnlPct,
        avgPnlPct,
        avgWinPct,
        avgLossPct,
        bestTradePct,
        worstTradePct,
        avgPnlVsActualPct,
        totalPnlVsActualDollar,
        tradesImproved,
        tradesWorse,
        avgBarsInTrade,
        avgDaysInTrade,
        avgRunningHighPct,
      },
      create: {
        run: { connect: { id: backtestRunId } },
        scenarioId: runScenario.scenario.id,
        totalTrades: trades.length,
        wins: wins.length,
        losses: losses.length,
        openTrades: openTrades.length,
        winRate,
        totalPnlPct,
        avgPnlPct,
        avgWinPct,
        avgLossPct,
        bestTradePct,
        worstTradePct,
        avgPnlVsActualPct,
        totalPnlVsActualDollar,
        tradesImproved,
        tradesWorse,
        avgBarsInTrade,
        avgDaysInTrade,
        avgRunningHighPct,
      },
    });
  }
}
