import {
  IncrementalContributor,
  NarrativeScenarioMetrics,
  ScenarioAnalysisTrade,
} from "../types/analysis.types.js";

const BARS_PER_TRADING_DAY = 78;

export function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[midpoint] ?? null;
  }

  const lower = sorted[midpoint - 1];
  const upper = sorted[midpoint];

  if (lower === undefined || upper === undefined) {
    return null;
  }

  return (lower + upper) / 2;
}

export function isComparableRealizedTrade(
  trade: ScenarioAnalysisTrade
): boolean {
  return (
    trade.exitReason !== "OPEN" &&
    trade.actualExitTs !== null &&
    trade.pnlPct !== null &&
    trade.pnlDollar !== null &&
    trade.actualPnlPct !== null &&
    trade.actualPnlDollar !== null &&
    trade.pnlVsActualPct !== null &&
    trade.pnlVsActualDollar !== null
  );
}

export function calculateNarrativeScenarioMetrics(
  trades: ScenarioAnalysisTrade[]
): NarrativeScenarioMetrics {
  const comparableTrades = trades.filter(isComparableRealizedTrade);
  const contributors = comparableTrades.map(toContributor);
  const dollarDeltas = contributors.map(
    (contributor) => contributor.incrementalPnlDollar
  );
  const pctDeltas = contributors.map(
    (contributor) => contributor.incrementalPnlPct
  );
  const holdingBars = comparableTrades
    .map((trade) => trade.barsInTrade)
    .filter((bars): bars is number => bars !== null);

  const simulatedRealizedPnlDollar = contributors.reduce(
    (sum, contributor) => sum + contributor.simulatedPnlDollar,
    0
  );
  const actualComparablePnlDollar = contributors.reduce(
    (sum, contributor) => sum + contributor.actualPnlDollar,
    0
  );
  const incrementalRealizedPnlDollar = contributors.reduce(
    (sum, contributor) => sum + contributor.incrementalPnlDollar,
    0
  );

  const largestPositiveContributors = [...contributors]
    .filter((contributor) => contributor.incrementalPnlDollar > 0)
    .sort((a, b) => b.incrementalPnlDollar - a.incrementalPnlDollar);
  const largestNegativeContributors = [...contributors]
    .filter((contributor) => contributor.incrementalPnlDollar < 0)
    .sort((a, b) => a.incrementalPnlDollar - b.incrementalPnlDollar);

  const averageHoldingBars = average(holdingBars);
  const medianHoldingBars = median(holdingBars);

  return {
    totalTrades: trades.length,
    comparableTrades: comparableTrades.length,
    openSimulations: trades.filter((trade) => trade.exitReason === "OPEN").length,
    improvedTrades: contributors.filter(
      (contributor) => contributor.incrementalPnlDollar > 0
    ).length,
    worseTrades: contributors.filter(
      (contributor) => contributor.incrementalPnlDollar < 0
    ).length,
    unchangedTrades: contributors.filter(
      (contributor) => contributor.incrementalPnlDollar === 0
    ).length,
    improvementRate:
      comparableTrades.length > 0
        ? contributors.filter(
            (contributor) => contributor.incrementalPnlDollar > 0
          ).length / comparableTrades.length
        : null,
    simulatedRealizedPnlDollar,
    actualComparablePnlDollar,
    incrementalRealizedPnlDollar,
    realizedUpliftPct:
      actualComparablePnlDollar !== 0
        ? incrementalRealizedPnlDollar / actualComparablePnlDollar
        : null,
    averageDollarImprovement: average(dollarDeltas),
    medianDollarImprovement: median(dollarDeltas),
    averagePctImprovement: average(pctDeltas),
    medianPctImprovement: median(pctDeltas),
    averageHoldingBars,
    medianHoldingBars,
    averageHoldingDays:
      averageHoldingBars !== null ? averageHoldingBars / BARS_PER_TRADING_DAY : null,
    medianHoldingDays:
      medianHoldingBars !== null ? medianHoldingBars / BARS_PER_TRADING_DAY : null,
    largestPositiveContributors,
    largestNegativeContributors,
    topFiveContributionPct: calculateContributionConcentration(
      largestPositiveContributors,
      incrementalRealizedPnlDollar,
      5
    ),
    topTenContributionPct: calculateContributionConcentration(
      largestPositiveContributors,
      incrementalRealizedPnlDollar,
      10
    ),
  };
}

function toContributor(trade: ScenarioAnalysisTrade): IncrementalContributor {
  if (
    trade.pnlDollar === null ||
    trade.pnlPct === null ||
    trade.actualPnlDollar === null ||
    trade.actualPnlPct === null ||
    trade.pnlVsActualDollar === null ||
    trade.pnlVsActualPct === null
  ) {
    throw new Error("Comparable trade is missing required contribution fields");
  }

  return {
    actualTradeId: trade.actualTradeId,
    orderId: trade.orderId,
    ticker: trade.ticker,
    entryTs: trade.entryTs,
    simulatedPnlDollar: trade.pnlDollar,
    simulatedPnlPct: trade.pnlPct,
    actualPnlDollar: trade.actualPnlDollar,
    actualPnlPct: trade.actualPnlPct,
    incrementalPnlDollar: trade.pnlVsActualDollar,
    incrementalPnlPct: trade.pnlVsActualPct,
  };
}

function calculateContributionConcentration(
  positiveContributors: IncrementalContributor[],
  totalIncrementalProfit: number,
  limit: number
): number | null {
  if (totalIncrementalProfit <= 0) {
    return null;
  }

  const topContribution = positiveContributors
    .slice(0, limit)
    .reduce((sum, contributor) => sum + contributor.incrementalPnlDollar, 0);

  return topContribution / totalIncrementalProfit;
}
