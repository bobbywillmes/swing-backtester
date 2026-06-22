import prisma from "../db/prisma.js";
import {
  calculateNarrativeScenarioMetrics,
  isComparableRealizedTrade,
} from "../analysis/narrative-metrics.js";
import { SecurityAssetType } from "../data/security-catalog.js";
import { ExitReason } from "../types/engine.types.js";
import { ScenarioAnalysisTrade } from "../types/analysis.types.js";
import {
  validateSecurityIntegrity,
  RunScopeRecord,
  SymbolCount,
} from "../validation/security-integrity.js";
import {
  ApiCumulativeProfitPoint,
  ApiIntegrityStatus,
  ApiRunOverview,
  ApiRunSummary,
  ApiScenarioSummary,
  ApiTickerContribution,
  AssetTypeFilter,
} from "../api/types.js";

interface RunTradeRecord {
  actualTradeId: number;
  scenarioId: number;
  exitReason: string | null;
  pnlPct: number | null;
  pnlDollar: number | null;
  pnlVsActualPct: number | null;
  pnlVsActualDollar: number | null;
  barsInTrade: number | null;
  actualTrade: {
    id: number;
    ticker: string;
    entryTs: Date;
    actualExitTs: Date | null;
    actualPnlPct: number | null;
    actualPnlDollar: number | null;
    security: {
      assetType: SecurityAssetType;
    };
    orders: {
      etradeOrderId: number | null;
    }[];
  };
  scenario: {
    id: number;
    name: string;
    assetTypeScope: SecurityAssetType | null;
  };
}

export async function listApiBacktestRuns(): Promise<ApiRunSummary[]> {
  const runs = await prisma.backtestRun.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      completedAt: true,
      _count: {
        select: {
          scenarios: true,
          trades: true,
        },
      },
    },
  });

  return runs.map((run) => ({
    id: run.id,
    name: run.name,
    description: run.description,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    scenarioCount: run._count.scenarios,
    simulatedTradeCount: run._count.trades,
  }));
}

export async function getApiBacktestRun(runId: number): Promise<ApiRunSummary> {
  const run = await prisma.backtestRun.findUniqueOrThrow({
    where: { id: runId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      completedAt: true,
      _count: {
        select: {
          scenarios: true,
          trades: true,
        },
      },
    },
  });

  return {
    id: run.id,
    name: run.name,
    description: run.description,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    scenarioCount: run._count.scenarios,
    simulatedTradeCount: run._count.trades,
  };
}

export async function getApiRunScenarios(
  runId: number,
  assetType: AssetTypeFilter = "ALL"
): Promise<ApiScenarioSummary[]> {
  const rows = await getRunTradeRecords(runId);
  return buildScenarioSummaries(rows, assetType);
}

export async function getApiRunOverview(input: {
  runId: number;
  scenarioId?: number;
  assetType?: AssetTypeFilter;
}): Promise<ApiRunOverview> {
  const assetTypeFilter = input.assetType ?? "ALL";
  const run = await getApiBacktestRun(input.runId);
  const rows = await getRunTradeRecords(input.runId);
  const scenarios = buildScenarioSummaries(rows, assetTypeFilter);

  if (scenarios.length === 0) {
    throw new Error(`No scenario data found for run ${input.runId}`);
  }

  const selectedScenario =
    scenarios.find((scenario) => scenario.scenarioId === input.scenarioId) ??
    [...scenarios].sort(
      (a, b) =>
        b.metrics.incrementalRealizedPnlDollar -
        a.metrics.incrementalRealizedPnlDollar
    )[0];

  if (!selectedScenario) {
    throw new Error(`No scenario data found for run ${input.runId}`);
  }

  const selectedRows = filterRows(rows, assetTypeFilter).filter(
    (row) => row.scenarioId === selectedScenario.scenarioId
  );
  const selectedTrades = selectedRows.map(toScenarioAnalysisTrade);
  const comparableTrades = selectedTrades.filter(isComparableRealizedTrade);

  return {
    run,
    integrity: await getApiIntegrityStatus(input.runId),
    selectedScenario,
    actualPortfolioProfitDollar: calculateActualPortfolioProfit(
      rows,
      assetTypeFilter
    ),
    assetTypeFilter,
    scenarios,
    tickerContributions: buildTickerContributions(comparableTrades),
    cumulativeProfit: buildCumulativeProfit(comparableTrades),
  };
}

async function getRunTradeRecords(runId: number): Promise<RunTradeRecord[]> {
  return prisma.backtestTrade.findMany({
    where: { runId },
    select: {
      actualTradeId: true,
      scenarioId: true,
      exitReason: true,
      pnlPct: true,
      pnlDollar: true,
      pnlVsActualPct: true,
      pnlVsActualDollar: true,
      barsInTrade: true,
      actualTrade: {
        select: {
          id: true,
          ticker: true,
          entryTs: true,
          actualExitTs: true,
          actualPnlPct: true,
          actualPnlDollar: true,
          security: {
            select: { assetType: true },
          },
          orders: {
            select: { etradeOrderId: true },
            take: 1,
          },
        },
      },
      scenario: {
        select: {
          id: true,
          name: true,
          assetTypeScope: true,
        },
      },
    },
    orderBy: {
      actualTrade: {
        entryTs: "asc",
      },
    },
  });
}

async function getApiIntegrityStatus(
  runId: number
): Promise<ApiIntegrityStatus> {
  const securities = await prisma.security.findMany({
    orderBy: { symbol: "asc" },
    select: {
      symbol: true,
      name: true,
      assetType: true,
    },
  });
  const actualTradeGroups = await prisma.actualTrade.groupBy({
    by: ["ticker"],
    _count: { _all: true },
    orderBy: { ticker: "asc" },
  });
  const actualTradeSymbols: SymbolCount[] = actualTradeGroups.map((group) => ({
    symbol: group.ticker,
    count: group._count._all,
  }));
  const rows = await getRunTradeRecords(runId);
  const runScopeRecords: RunScopeRecord[] = rows.map((row) => ({
    symbol: row.actualTrade.ticker,
    securityAssetType: row.actualTrade.security.assetType,
    scenarioName: row.scenario.name,
    scenarioAssetTypeScope: row.scenario.assetTypeScope,
  }));
  const report = validateSecurityIntegrity({
    securities,
    actualTradeSymbols,
    runScopeRecords,
  });

  return {
    ok: !report.hasConflicts,
    unknownStoredSymbols: report.unknownStoredSymbols,
    unknownTradeSymbols: report.unknownTradeSymbols,
    metadataConflictCount: report.metadataConflicts.length,
    scopeConflictCount: report.scopeConflicts.length,
  };
}

function buildScenarioSummaries(
  rows: RunTradeRecord[],
  assetType: AssetTypeFilter
): ApiScenarioSummary[] {
  const filteredRows = filterRows(rows, assetType);
  const scenarioIds = [...new Set(filteredRows.map((row) => row.scenarioId))];

  return scenarioIds
    .map((scenarioId) => {
      const scenarioRows = filteredRows.filter(
        (row) => row.scenarioId === scenarioId
      );
      const firstRow = scenarioRows[0];

      if (!firstRow) {
        return null;
      }

      return {
        scenarioId,
        scenarioName: firstRow.scenario.name,
        assetTypeScope: firstRow.scenario.assetTypeScope ?? "ALL",
        metrics: calculateNarrativeScenarioMetrics(
          scenarioRows.map(toScenarioAnalysisTrade)
        ),
      };
    })
    .filter((scenario): scenario is ApiScenarioSummary => scenario !== null)
    .sort(
      (a, b) =>
        b.metrics.incrementalRealizedPnlDollar -
        a.metrics.incrementalRealizedPnlDollar
    );
}

function filterRows(
  rows: RunTradeRecord[],
  assetType: AssetTypeFilter
): RunTradeRecord[] {
  if (assetType === "ALL") {
    return rows;
  }

  return rows.filter((row) => row.actualTrade.security.assetType === assetType);
}

function toScenarioAnalysisTrade(row: RunTradeRecord): ScenarioAnalysisTrade {
  return {
    actualTradeId: row.actualTradeId,
    orderId:
      row.actualTrade.orders[0]?.etradeOrderId !== null &&
      row.actualTrade.orders[0]?.etradeOrderId !== undefined
        ? String(row.actualTrade.orders[0].etradeOrderId)
        : null,
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

function calculateActualPortfolioProfit(
  rows: RunTradeRecord[],
  assetType: AssetTypeFilter
): number {
  const actualTrades = new Map<number, RunTradeRecord["actualTrade"]>();

  for (const row of filterRows(rows, assetType)) {
    actualTrades.set(row.actualTrade.id, row.actualTrade);
  }

  return [...actualTrades.values()].reduce(
    (sum, trade) => sum + (trade.actualPnlDollar ?? 0),
    0
  );
}

function buildTickerContributions(
  comparableTrades: ScenarioAnalysisTrade[]
): ApiTickerContribution[] {
  const byTicker = new Map<string, ApiTickerContribution>();

  for (const trade of comparableTrades) {
    const existing =
      byTicker.get(trade.ticker) ??
      ({
        ticker: trade.ticker,
        comparableTrades: 0,
        improvedTrades: 0,
        worseTrades: 0,
        simulatedRealizedPnlDollar: 0,
        actualComparablePnlDollar: 0,
        incrementalRealizedPnlDollar: 0,
      } satisfies ApiTickerContribution);

    existing.comparableTrades += 1;
    existing.improvedTrades +=
      trade.pnlVsActualDollar !== null && trade.pnlVsActualDollar > 0 ? 1 : 0;
    existing.worseTrades +=
      trade.pnlVsActualDollar !== null && trade.pnlVsActualDollar < 0 ? 1 : 0;
    existing.simulatedRealizedPnlDollar += trade.pnlDollar ?? 0;
    existing.actualComparablePnlDollar += trade.actualPnlDollar ?? 0;
    existing.incrementalRealizedPnlDollar += trade.pnlVsActualDollar ?? 0;
    byTicker.set(trade.ticker, existing);
  }

  return [...byTicker.values()].sort(
    (a, b) => b.incrementalRealizedPnlDollar - a.incrementalRealizedPnlDollar
  );
}

function buildCumulativeProfit(
  comparableTrades: ScenarioAnalysisTrade[]
): ApiCumulativeProfitPoint[] {
  let actualCumulativePnlDollar = 0;
  let scenarioCumulativePnlDollar = 0;
  let incrementalCumulativePnlDollar = 0;

  return [...comparableTrades]
    .sort((a, b) => a.entryTs.getTime() - b.entryTs.getTime())
    .map((trade) => {
      actualCumulativePnlDollar += trade.actualPnlDollar ?? 0;
      scenarioCumulativePnlDollar += trade.pnlDollar ?? 0;
      incrementalCumulativePnlDollar += trade.pnlVsActualDollar ?? 0;

      return {
        actualTradeId: trade.actualTradeId,
        orderId: trade.orderId,
        ticker: trade.ticker,
        entryTs: trade.entryTs.toISOString(),
        actualCumulativePnlDollar,
        scenarioCumulativePnlDollar,
        incrementalCumulativePnlDollar,
      };
    });
}
