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
