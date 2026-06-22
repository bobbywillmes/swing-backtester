export type AssetTypeFilter = "ALL" | "ETF" | "STOCK";

export interface RunSummary {
  id: number;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  scenarioCount: number;
  simulatedTradeCount: number;
}

export interface NarrativeScenarioMetrics {
  totalTrades: number;
  comparableTrades: number;
  openSimulations: number;
  improvedTrades: number;
  worseTrades: number;
  unchangedTrades: number;
  improvementRate: number | null;
  simulatedRealizedPnlDollar: number;
  actualComparablePnlDollar: number;
  incrementalRealizedPnlDollar: number;
  realizedUpliftPct: number | null;
  averageDollarImprovement: number | null;
  medianDollarImprovement: number | null;
  averagePctImprovement: number | null;
  medianPctImprovement: number | null;
  averageHoldingBars: number | null;
  medianHoldingBars: number | null;
  averageHoldingDays: number | null;
  medianHoldingDays: number | null;
  topFiveContributionPct: number | null;
  topTenContributionPct: number | null;
  largestPositiveContributors: IncrementalContributor[];
  largestNegativeContributors: IncrementalContributor[];
}

export interface IncrementalContributor {
  actualTradeId: number;
  orderId: string | null;
  ticker: string;
  entryTs: string;
  simulatedPnlDollar: number;
  simulatedPnlPct: number;
  actualPnlDollar: number;
  actualPnlPct: number;
  incrementalPnlDollar: number;
  incrementalPnlPct: number;
}

export interface ScenarioSummary {
  scenarioId: number;
  scenarioName: string;
  assetTypeScope: AssetTypeFilter;
  metrics: NarrativeScenarioMetrics;
}

export interface IntegrityStatus {
  ok: boolean;
  unknownStoredSymbols: string[];
  unknownTradeSymbols: { symbol: string; count: number }[];
  metadataConflictCount: number;
  scopeConflictCount: number;
}

export interface TickerContribution {
  ticker: string;
  comparableTrades: number;
  improvedTrades: number;
  worseTrades: number;
  simulatedRealizedPnlDollar: number;
  actualComparablePnlDollar: number;
  incrementalRealizedPnlDollar: number;
}

export interface CumulativeProfitPoint {
  actualTradeId: number;
  orderId: string | null;
  ticker: string;
  entryTs: string;
  actualCumulativePnlDollar: number;
  scenarioCumulativePnlDollar: number;
  incrementalCumulativePnlDollar: number;
}

export interface RunOverview {
  run: RunSummary;
  integrity: IntegrityStatus;
  selectedScenario: ScenarioSummary;
  actualPortfolioProfitDollar: number;
  assetTypeFilter: AssetTypeFilter;
  scenarios: ScenarioSummary[];
  tickerContributions: TickerContribution[];
  cumulativeProfit: CumulativeProfitPoint[];
}
