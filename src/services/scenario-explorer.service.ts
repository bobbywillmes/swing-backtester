import prisma from "../db/prisma.js";
import {
  calculateNarrativeScenarioMetrics,
  isComparableRealizedTrade,
} from "../analysis/narrative-metrics.js";
import { ExitReason } from "../types/engine.types.js";
import { ScenarioAnalysisTrade } from "../types/analysis.types.js";
import {
  ApiActualOrderSummary,
  ApiComparisonStatus,
  ApiScenarioConfig,
  ApiScenarioExplorer,
  ApiScenarioExplorerFilters,
  ApiScenarioGroup,
  ApiScenarioTradeDetail,
  ApiScenarioTradesResponse,
  ApiScenarioTradeSummary,
} from "../api/types.js";
import {
  getApiBacktestRun,
  getApiIntegrityStatus,
} from "./run-overview.service.js";

const BARS_PER_TRADING_DAY = 78;

type ScenarioTradeRecord = Awaited<
  ReturnType<typeof getScenarioTradeRecords>
>[number];

export async function getApiScenarioExplorer(input: {
  runId: number;
  scenarioId: number;
}): Promise<ApiScenarioExplorer> {
  const [run, runScenario, rows] = await Promise.all([
    getApiBacktestRun(input.runId),
    getRunScenario(input.runId, input.scenarioId),
    getScenarioTradeRecords(input.runId, input.scenarioId),
  ]);

  return {
    run,
    integrity: await getApiIntegrityStatus(input.runId),
    scenario: toScenarioConfig(runScenario.scenario),
    metrics: calculateNarrativeScenarioMetrics(rows.map(toScenarioAnalysisTrade)),
    availableFilters: buildAvailableFilters(rows),
  };
}

export async function getApiScenarioTrades(input: {
  runId: number;
  scenarioId: number;
}): Promise<ApiScenarioTradesResponse> {
  const [run, runScenario, rows] = await Promise.all([
    getApiBacktestRun(input.runId),
    getRunScenario(input.runId, input.scenarioId),
    getScenarioTradeRecords(input.runId, input.scenarioId),
  ]);

  return {
    run,
    scenario: toScenarioConfig(runScenario.scenario),
    metrics: calculateNarrativeScenarioMetrics(rows.map(toScenarioAnalysisTrade)),
    trades: rows.map(toTradeSummary),
  };
}

export async function getApiScenarioTradeDetail(input: {
  runId: number;
  scenarioId: number;
  backtestTradeId: number;
}): Promise<ApiScenarioTradeDetail> {
  await getRunScenario(input.runId, input.scenarioId);

  const row = await prisma.backtestTrade.findFirst({
    where: {
      id: input.backtestTradeId,
      runId: input.runId,
      scenarioId: input.scenarioId,
    },
    select: scenarioTradeSelect,
  });

  if (!row) {
    throw new Error(
      `No trade ${input.backtestTradeId} found for run ${input.runId} and scenario ${input.scenarioId}`
    );
  }

  return {
    ...toTradeSummary(row),
    scenario: toScenarioConfig(row.scenario),
    runningHighPrice: row.runningHighPrice,
    runningHighPct: row.runningHighPct,
    trailActivatedAt: row.trailActivatedAt?.toISOString() ?? null,
    spyAtrPctAtEntry: row.spyAtrPctAtEntry,
    orders: row.actualTrade.orders.map(toOrderSummary),
  };
}

async function getRunScenario(runId: number, scenarioId: number) {
  const runScenario = await prisma.backtestRunScenario.findUnique({
    where: {
      runId_scenarioId: {
        runId,
        scenarioId,
      },
    },
    select: {
      scenario: {
        select: {
          id: true,
          name: true,
          description: true,
          assetTypeScope: true,
          targetPct: true,
          targetIsHardExit: true,
          stopPct: true,
          trailingStopPct: true,
          trailActivateAfterPct: true,
          maxHoldBars: true,
          active: true,
        },
      },
    },
  });

  if (!runScenario) {
    throw new Error(`No scenario ${scenarioId} found for run ${runId}`);
  }

  return runScenario;
}

const scenarioTradeSelect = {
  id: true,
  actualTradeId: true,
  exitTs: true,
  exitPrice: true,
  exitReason: true,
  pnlPct: true,
  pnlDollar: true,
  pnlVsActualPct: true,
  pnlVsActualDollar: true,
  barsInTrade: true,
  runningHighPrice: true,
  runningHighPct: true,
  trailActivatedAt: true,
  regimeAtEntry: true,
  spyAtrPctAtEntry: true,
  actualTrade: {
    select: {
      id: true,
      ticker: true,
      entryTs: true,
      entryPrice: true,
      shares: true,
      capitalDeployed: true,
      actualExitTs: true,
      actualExitPrice: true,
      actualExitReason: true,
      actualPnlPct: true,
      actualPnlDollar: true,
      actualBarsHeld: true,
      addCount: true,
      security: {
        select: {
          assetType: true,
        },
      },
      orders: {
        orderBy: { executedAt: "asc" },
        select: {
          id: true,
          etradeOrderId: true,
          side: true,
          executedAt: true,
          quantity: true,
          priceExecuted: true,
          priceType: true,
          term: true,
          limitPrice: true,
          orderRole: true,
        },
      },
    },
  },
  scenario: {
    select: {
      id: true,
      name: true,
      description: true,
      assetTypeScope: true,
      targetPct: true,
      targetIsHardExit: true,
      stopPct: true,
      trailingStopPct: true,
      trailActivateAfterPct: true,
      maxHoldBars: true,
      active: true,
    },
  },
} as const;

async function getScenarioTradeRecords(runId: number, scenarioId: number) {
  return prisma.backtestTrade.findMany({
    where: {
      runId,
      scenarioId,
    },
    select: scenarioTradeSelect,
    orderBy: {
      actualTrade: {
        entryTs: "asc",
      },
    },
  });
}

function toScenarioConfig(
  scenario: ScenarioTradeRecord["scenario"]
): ApiScenarioConfig {
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    scenarioGroup: determineScenarioGroup(scenario),
    description: scenario.description,
    assetTypeScope: scenario.assetTypeScope ?? "ALL",
    targetPct: scenario.targetPct,
    targetIsHardExit: scenario.targetIsHardExit,
    stopPct: scenario.stopPct,
    trailingStopPct: scenario.trailingStopPct,
    trailActivateAfterPct: scenario.trailActivateAfterPct,
    maxHoldBars: scenario.maxHoldBars,
    active: scenario.active,
  };
}

function toTradeSummary(row: ScenarioTradeRecord): ApiScenarioTradeSummary {
  const analysisTrade = toScenarioAnalysisTrade(row);

  return {
    backtestTradeId: row.id,
    actualTradeId: row.actualTradeId,
    orderId: getPrimaryOrderId(row),
    ticker: row.actualTrade.ticker,
    assetType: row.actualTrade.security.assetType,
    entryTs: row.actualTrade.entryTs.toISOString(),
    entryPrice: row.actualTrade.entryPrice,
    shares: row.actualTrade.shares,
    capitalDeployed: row.actualTrade.capitalDeployed,
    entryType: determineEntryType(row.actualTrade.addCount),
    exitTs: row.exitTs?.toISOString() ?? null,
    exitPrice: row.exitPrice,
    exitReason: row.exitReason,
    pnlPct: row.pnlPct,
    pnlDollar: row.pnlDollar,
    pnlVsActualPct: row.pnlVsActualPct,
    pnlVsActualDollar: row.pnlVsActualDollar,
    barsInTrade: row.barsInTrade,
    daysInTrade:
      row.barsInTrade !== null ? row.barsInTrade / BARS_PER_TRADING_DAY : null,
    actualExitTs: row.actualTrade.actualExitTs?.toISOString() ?? null,
    actualExitPrice: row.actualTrade.actualExitPrice,
    actualExitReason: row.actualTrade.actualExitReason,
    actualPnlPct: row.actualTrade.actualPnlPct,
    actualPnlDollar: row.actualTrade.actualPnlDollar,
    actualBarsHeld: row.actualTrade.actualBarsHeld,
    comparisonStatus: determineComparisonStatus(analysisTrade),
    regimeAtEntry: row.regimeAtEntry,
  };
}

function toScenarioAnalysisTrade(row: ScenarioTradeRecord): ScenarioAnalysisTrade {
  return {
    actualTradeId: row.actualTradeId,
    orderId: getPrimaryOrderId(row),
    ticker: row.actualTrade.ticker,
    entryTs: row.actualTrade.entryTs,
    exitReason: parseExitReason(row.exitReason),
    pnlPct: row.pnlPct,
    pnlDollar: row.pnlDollar,
    pnlVsActualPct: row.pnlVsActualPct,
    pnlVsActualDollar: row.pnlVsActualDollar,
    barsInTrade: row.barsInTrade,
    actualExitTs: row.actualTrade.actualExitTs,
    actualPnlPct: row.actualTrade.actualPnlPct,
    actualPnlDollar: row.actualTrade.actualPnlDollar,
  };
}

function toOrderSummary(order: ScenarioTradeRecord["actualTrade"]["orders"][number]): ApiActualOrderSummary {
  return {
    id: order.id,
    etradeOrderId: order.etradeOrderId,
    side: order.side,
    executedAt: order.executedAt.toISOString(),
    quantity: order.quantity,
    priceExecuted: order.priceExecuted,
    priceType: order.priceType,
    term: order.term,
    limitPrice: order.limitPrice,
    orderRole: order.orderRole,
  };
}

function getPrimaryOrderId(row: ScenarioTradeRecord): string | null {
  const openOrder =
    row.actualTrade.orders.find((order) => order.orderRole === "OPEN") ??
    row.actualTrade.orders.find((order) => order.side === "BUY") ??
    row.actualTrade.orders[0];

  return openOrder?.etradeOrderId !== null &&
    openOrder?.etradeOrderId !== undefined
    ? String(openOrder.etradeOrderId)
    : null;
}

function determineComparisonStatus(
  trade: ScenarioAnalysisTrade
): ApiComparisonStatus {
  if (trade.exitReason === "OPEN") {
    return "OPEN_SIMULATION";
  }

  if (!isComparableRealizedTrade(trade)) {
    return "NOT_COMPARABLE";
  }

  const delta = trade.pnlVsActualDollar;

  if (delta === null) {
    return "NOT_COMPARABLE";
  }

  if (delta > 0) {
    return "IMPROVED";
  }

  if (delta < 0) {
    return "WORSE";
  }

  return "UNCHANGED";
}

function determineEntryType(addCount: number): string {
  if (addCount === 0) {
    return "Single Entry";
  }

  if (addCount === 1) {
    return "Double-Down";
  }

  return `Add(${addCount})`;
}

function determineScenarioGroup(scenario: {
  targetPct: number | null;
  targetIsHardExit: boolean;
  trailingStopPct: number | null;
}): ApiScenarioGroup {
  if (scenario.targetPct !== null && scenario.targetIsHardExit === false) {
    return "Target Unlocks Trail";
  }

  if (scenario.targetPct !== null) {
    return "Fixed Target";
  }

  return "Trail Only";
}

function buildAvailableFilters(
  rows: ScenarioTradeRecord[]
): ApiScenarioExplorerFilters {
  const statuses = new Set<ApiComparisonStatus>();

  for (const row of rows) {
    statuses.add(determineComparisonStatus(toScenarioAnalysisTrade(row)));
  }

  return {
    assetTypes: uniqueSorted(
      rows.map((row) => row.actualTrade.security.assetType)
    ),
    tickers: uniqueSorted(rows.map((row) => row.actualTrade.ticker)),
    exitReasons: uniqueSorted(
      rows.map((row) => row.exitReason).filter(isPresent)
    ),
    regimes: uniqueSorted(
      rows.map((row) => row.regimeAtEntry).filter(isPresent)
    ),
    entryTypes: uniqueSorted(
      rows.map((row) => determineEntryType(row.actualTrade.addCount))
    ),
    comparisonStatuses: [...statuses].sort(),
  };
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function parseExitReason(value: string | null): ExitReason | null {
  if (
    value === "TARGET" ||
    value === "STOP" ||
    value === "TRAIL" ||
    value === "TIME" ||
    value === "OPEN"
  ) {
    return value;
  }

  return null;
}
