import { SecurityAssetType } from "../data/security-catalog.js";
import { NarrativeScenarioMetrics } from "../types/analysis.types.js";

export type AssetTypeFilter = SecurityAssetType | "ALL";

export interface ApiIntegrityStatus {
  ok: boolean;
  unknownStoredSymbols: string[];
  unknownTradeSymbols: { symbol: string; count: number }[];
  metadataConflictCount: number;
  scopeConflictCount: number;
}

export interface ApiRunSummary {
  id: number;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  scenarioCount: number;
  simulatedTradeCount: number;
}

export interface ApiScenarioSummary {
  scenarioId: number;
  scenarioName: string;
  assetTypeScope: AssetTypeFilter;
  metrics: NarrativeScenarioMetrics;
}

export interface ApiTickerContribution {
  ticker: string;
  comparableTrades: number;
  improvedTrades: number;
  worseTrades: number;
  simulatedRealizedPnlDollar: number;
  actualComparablePnlDollar: number;
  incrementalRealizedPnlDollar: number;
}

export interface ApiCumulativeProfitPoint {
  actualTradeId: number;
  orderId: string | null;
  ticker: string;
  entryTs: string;
  actualCumulativePnlDollar: number;
  scenarioCumulativePnlDollar: number;
  incrementalCumulativePnlDollar: number;
}

export interface ApiRunOverview {
  run: ApiRunSummary;
  integrity: ApiIntegrityStatus;
  selectedScenario: ApiScenarioSummary;
  actualPortfolioProfitDollar: number;
  assetTypeFilter: AssetTypeFilter;
  scenarios: ApiScenarioSummary[];
  tickerContributions: ApiTickerContribution[];
  cumulativeProfit: ApiCumulativeProfitPoint[];
}

export type ApiScenarioGroup =
  | "Trail Only"
  | "Target Unlocks Trail"
  | "Fixed Target";

export type ApiComparisonStatus =
  | "IMPROVED"
  | "WORSE"
  | "UNCHANGED"
  | "OPEN_SIMULATION"
  | "NOT_COMPARABLE";

export interface ApiScenarioConfig {
  scenarioId: number;
  scenarioName: string;
  scenarioGroup: ApiScenarioGroup;
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

export interface ApiScenarioExplorer {
  run: ApiRunSummary;
  integrity: ApiIntegrityStatus;
  scenario: ApiScenarioConfig;
  metrics: NarrativeScenarioMetrics;
  availableFilters: ApiScenarioExplorerFilters;
}

export interface ApiScenarioExplorerFilters {
  assetTypes: AssetTypeFilter[];
  tickers: string[];
  exitReasons: string[];
  regimes: string[];
  entryTypes: string[];
  comparisonStatuses: ApiComparisonStatus[];
}

export interface ApiScenarioTradeSummary {
  backtestTradeId: number;
  actualTradeId: number;
  orderId: string | null;
  ticker: string;
  assetType: SecurityAssetType;
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
  comparisonStatus: ApiComparisonStatus;
  regimeAtEntry: string | null;
}

export interface ApiScenarioTradesResponse {
  run: ApiRunSummary;
  scenario: ApiScenarioConfig;
  metrics: NarrativeScenarioMetrics;
  trades: ApiScenarioTradeSummary[];
}

export interface ApiActualOrderSummary {
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

export interface ApiScenarioTradeDetail extends ApiScenarioTradeSummary {
  scenario: ApiScenarioConfig;
  runningHighPrice: number | null;
  runningHighPct: number | null;
  trailActivatedAt: string | null;
  spyAtrPctAtEntry: number | null;
  orders: ApiActualOrderSummary[];
}
