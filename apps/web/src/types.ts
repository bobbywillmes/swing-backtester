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

export type ScenarioGroup =
  | "Trail Only"
  | "Target Unlocks Trail"
  | "Fixed Target";

export type ComparisonStatus =
  | "IMPROVED"
  | "WORSE"
  | "UNCHANGED"
  | "OPEN_SIMULATION"
  | "NOT_COMPARABLE";

export interface ScenarioConfig {
  scenarioId: number;
  scenarioName: string;
  scenarioGroup: ScenarioGroup;
  description: string | null;
  assetTypeScope: AssetTypeFilter;
  targetPct: number | null;
  targetIsHardExit: boolean;
  stopPct: number | null;
  trailingStopPct: number | null;
  trailActivateAfterPct: number | null;
  maxHoldBars: number | null;
  active: boolean;
}

export interface ScenarioExplorerFilters {
  assetTypes: AssetTypeFilter[];
  tickers: string[];
  exitReasons: string[];
  regimes: string[];
  entryTypes: string[];
  comparisonStatuses: ComparisonStatus[];
}

export interface ScenarioExplorer {
  run: RunSummary;
  integrity: IntegrityStatus;
  scenario: ScenarioConfig;
  metrics: NarrativeScenarioMetrics;
  availableFilters: ScenarioExplorerFilters;
}

export interface ScenarioTradeSummary {
  backtestTradeId: number;
  actualTradeId: number;
  orderId: string | null;
  ticker: string;
  assetType: "ETF" | "STOCK";
  entryTs: string;
  entryPrice: number;
  shares: number;
  capitalDeployed: number;
  entryType: string;
  exitTs: string | null;
  exitPrice: number | null;
  exitReason: string | null;
  pnlPct: number | null;
  pnlDollar: number | null;
  pnlVsActualPct: number | null;
  pnlVsActualDollar: number | null;
  barsInTrade: number | null;
  daysInTrade: number | null;
  actualExitTs: string | null;
  actualExitPrice: number | null;
  actualExitReason: string | null;
  actualPnlPct: number | null;
  actualPnlDollar: number | null;
  actualBarsHeld: number | null;
  comparisonStatus: ComparisonStatus;
  regimeAtEntry: string | null;
}

export interface ScenarioTradesResponse {
  run: RunSummary;
  scenario: ScenarioConfig;
  metrics: NarrativeScenarioMetrics;
  trades: ScenarioTradeSummary[];
}

export interface ActualOrderSummary {
  id: number;
  etradeOrderId: number | null;
  side: string;
  executedAt: string;
  quantity: number;
  priceExecuted: number;
  priceType: string;
  term: string | null;
  limitPrice: number | null;
  orderRole: string | null;
}

export interface ScenarioTradeDetail extends ScenarioTradeSummary {
  scenario: ScenarioConfig;
  runningHighPrice: number | null;
  runningHighPct: number | null;
  trailActivatedAt: string | null;
  spyAtrPctAtEntry: number | null;
  orders: ActualOrderSummary[];
}
