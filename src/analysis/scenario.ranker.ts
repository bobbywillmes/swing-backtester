import { MetricsSnapshot } from "./metrics.calculator.js";

export interface ScenarioRanking {
  scenarioId: number;
  scenarioName: string;
  metrics: MetricsSnapshot;
  rank: number;
  score: number;
  strengths: string[];
  weaknesses: string[];
}

export interface RankingCriteria {
  winRate?: number;
  profitFactor?: number;
  expectancy?: number;
  improvementRate?: number;
  avgPnlPct?: number;
  consistency?: number;
}

const DEFAULT_CRITERIA: RankingCriteria = {
  winRate: 0.2,
  profitFactor: 0.2,
  expectancy: 0.2,
  improvementRate: 0.2,
  avgPnlPct: 0.2,
};

export function rankScenarios(
  scenarios: Array<{
    id: number;
    name: string;
    metrics: MetricsSnapshot;
  }>,
  criteria: RankingCriteria = DEFAULT_CRITERIA
): ScenarioRanking[] {
  // Normalize criteria weights
  const weights = {
    winRate: criteria.winRate || 0.2,
    profitFactor: criteria.profitFactor || 0.2,
    expectancy: criteria.expectancy || 0.2,
    improvementRate: criteria.improvementRate || 0.2,
    avgPnlPct: criteria.avgPnlPct || 0.2,
  };

  const totalWeight =
    weights.winRate +
    weights.profitFactor +
    weights.expectancy +
    weights.improvementRate +
    weights.avgPnlPct;

  // Normalize to sum to 1
  const normalizedWeights = {
    winRate: weights.winRate / totalWeight,
    profitFactor: weights.profitFactor / totalWeight,
    expectancy: weights.expectancy / totalWeight,
    improvementRate: weights.improvementRate / totalWeight,
    avgPnlPct: weights.avgPnlPct / totalWeight,
  };

  // Get max values for normalization
  const maxWinRate = Math.max(...scenarios.map((s) => s.metrics.winRate));
  const maxProfitFactor = Math.max(
    ...scenarios.map((s) => s.metrics.profitFactor)
  );
  const maxExpectancy = Math.max(...scenarios.map((s) => s.metrics.expectancy));
  const maxImprovementRate = Math.max(
    ...scenarios.map((s) => s.metrics.improvementRate)
  );
  const maxAvgPnlPct = Math.max(...scenarios.map((s) => s.metrics.avgPnlPct));

  const rankings = scenarios.map((scenario) => {
    // Normalize each metric to 0-1
    const normalizedWinRate =
      maxWinRate > 0 ? scenario.metrics.winRate / maxWinRate : 0;
    const normalizedProfitFactor =
      maxProfitFactor > 0 ? scenario.metrics.profitFactor / maxProfitFactor : 0;
    const normalizedExpectancy =
      maxExpectancy > 0 ? Math.max(0, scenario.metrics.expectancy / maxExpectancy) : 0;
    const normalizedImprovementRate =
      maxImprovementRate > 0
        ? scenario.metrics.improvementRate / maxImprovementRate
        : 0;
    const normalizedAvgPnlPct =
      maxAvgPnlPct > 0 ? Math.max(0, scenario.metrics.avgPnlPct / maxAvgPnlPct) : 0;

    // Weighted score
    const score =
      normalizedWinRate * normalizedWeights.winRate +
      normalizedProfitFactor * normalizedWeights.profitFactor +
      normalizedExpectancy * normalizedWeights.expectancy +
      normalizedImprovementRate * normalizedWeights.improvementRate +
      normalizedAvgPnlPct * normalizedWeights.avgPnlPct;

    // Identify strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (scenario.metrics.winRate > 0.6) strengths.push("High win rate");
    if (scenario.metrics.winRate < 0.4) weaknesses.push("Low win rate");

    if (scenario.metrics.profitFactor > 1.5) strengths.push("Strong profit factor");
    if (scenario.metrics.profitFactor < 1) weaknesses.push("Profit factor < 1");

    if (scenario.metrics.expectancy > 0.02) strengths.push("Good expectancy");
    if (scenario.metrics.expectancy < 0) weaknesses.push("Negative expectancy");

    if (scenario.metrics.improvementRate > 0.7)
      strengths.push("Beats actual trades");
    if (scenario.metrics.improvementRate < 0.3)
      weaknesses.push("Underperforms actual");

    if (scenario.metrics.avgDaysInTrade < 2)
      strengths.push("Quick exits");
    if (scenario.metrics.avgDaysInTrade > 10)
      strengths.push("Patient strategy");

    if (scenario.metrics.openTrades > scenario.metrics.totalTrades * 0.5)
      weaknesses.push("Many open positions");

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      metrics: scenario.metrics,
      rank: 0, // Will be assigned after sorting
      score,
      strengths:
        strengths.length > 0
          ? strengths
          : ["Balanced approach"],
      weaknesses: weaknesses.length > 0 ? weaknesses : [],
    };
  });

  // Sort by score descending and assign ranks
  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((r, i) => {
    r.rank = i + 1;
  });

  return rankings;
}

export function compareScenarios(
  s1: MetricsSnapshot,
  s2: MetricsSnapshot
): { better: string; metrics: string[] } {
  const metrics: string[] = [];

  if (s1.winRate > s2.winRate) {
    metrics.push(`Win rate: ${(s1.winRate * 100).toFixed(1)}% vs ${(s2.winRate * 100).toFixed(1)}%`);
  }
  if (s1.avgPnlPct > s2.avgPnlPct) {
    metrics.push(`Avg PnL: ${(s1.avgPnlPct * 100).toFixed(2)}% vs ${(s2.avgPnlPct * 100).toFixed(2)}%`);
  }
  if (s1.profitFactor > s2.profitFactor) {
    metrics.push(`Profit Factor: ${s1.profitFactor.toFixed(2)} vs ${s2.profitFactor.toFixed(2)}`);
  }
  if (s1.avgPnlVsActualPct > s2.avgPnlVsActualPct) {
    metrics.push(`Improvement: ${(s1.avgPnlVsActualPct * 100).toFixed(2)}% vs ${(s2.avgPnlVsActualPct * 100).toFixed(2)}%`);
  }

  return {
    better: metrics.length > 0 ? "Scenario 1" : "Scenario 2",
    metrics,
  };
}
