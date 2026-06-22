import { ExitReason } from "./engine.types.js";

export interface ScenarioAnalysisTrade {
  actualTradeId: number;
  orderId: string | null;
  ticker: string;
  entryTs: Date;
  exitReason: ExitReason | null;
  pnlPct: number | null;
  pnlDollar: number | null;
  pnlVsActualPct: number | null;
  pnlVsActualDollar: number | null;
  barsInTrade: number | null;
  actualExitTs: Date | null;
  actualPnlPct: number | null;
  actualPnlDollar: number | null;
}

export interface IncrementalContributor {
  actualTradeId: number;
  orderId: string | null;
  ticker: string;
  entryTs: Date;
  simulatedPnlDollar: number;
  simulatedPnlPct: number;
  actualPnlDollar: number;
  actualPnlPct: number;
  incrementalPnlDollar: number;
  incrementalPnlPct: number;
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
  largestPositiveContributors: IncrementalContributor[];
  largestNegativeContributors: IncrementalContributor[];
  topFiveContributionPct: number | null;
  topTenContributionPct: number | null;
}
