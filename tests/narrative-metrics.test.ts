import test from "node:test";
import assert from "node:assert/strict";
import {
  average,
  calculateNarrativeScenarioMetrics,
  median,
} from "../src/analysis/narrative-metrics.js";
import { ScenarioAnalysisTrade } from "../src/types/analysis.types.js";

test("median handles odd, even, and empty inputs", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
});

test("average handles populated and empty inputs", () => {
  assert.equal(average([2, 4, 6]), 4);
  assert.equal(average([]), null);
});

test("excludes open simulations and null comparisons from comparable metrics", () => {
  const metrics = calculateNarrativeScenarioMetrics([
    trade({ id: 1, pnlDollar: 20, actualPnlDollar: 10, barsInTrade: 78 }),
    trade({ id: 2, exitReason: "OPEN", pnlDollar: null, actualPnlDollar: 5 }),
    trade({ id: 3, pnlDollar: 10, actualPnlDollar: null }),
    trade({ id: 4, pnlDollar: 7, actualPnlDollar: 7, pnlVsActualDollar: null }),
  ]);

  assert.equal(metrics.totalTrades, 4);
  assert.equal(metrics.openSimulations, 1);
  assert.equal(metrics.comparableTrades, 1);
  assert.equal(metrics.simulatedRealizedPnlDollar, 20);
  assert.equal(metrics.actualComparablePnlDollar, 10);
  assert.equal(metrics.incrementalRealizedPnlDollar, 10);
});

test("calculates exact improved, worse, unchanged, and comparable counts", () => {
  const metrics = calculateNarrativeScenarioMetrics([
    trade({ id: 1, pnlDollar: 25, actualPnlDollar: 10 }),
    trade({ id: 2, pnlDollar: 5, actualPnlDollar: 10 }),
    trade({ id: 3, pnlDollar: 10, actualPnlDollar: 10 }),
    trade({ id: 4, exitReason: "OPEN", pnlDollar: null, actualPnlDollar: 10 }),
  ]);

  assert.equal(metrics.comparableTrades, 3);
  assert.equal(metrics.improvedTrades, 1);
  assert.equal(metrics.worseTrades, 1);
  assert.equal(metrics.unchangedTrades, 1);
  assert.equal(metrics.improvementRate, 1 / 3);
});

test("uses the comparable actual profit as realized uplift denominator", () => {
  const metrics = calculateNarrativeScenarioMetrics([
    trade({ id: 1, pnlDollar: 50, actualPnlDollar: 20 }),
    trade({ id: 2, pnlDollar: 30, actualPnlDollar: 20 }),
  ]);

  assert.equal(metrics.simulatedRealizedPnlDollar, 80);
  assert.equal(metrics.actualComparablePnlDollar, 40);
  assert.equal(metrics.incrementalRealizedPnlDollar, 40);
  assert.equal(metrics.realizedUpliftPct, 1);
});

test("calculates average and median holding duration", () => {
  const metrics = calculateNarrativeScenarioMetrics([
    trade({ id: 1, pnlDollar: 20, actualPnlDollar: 10, barsInTrade: 78 }),
    trade({ id: 2, pnlDollar: 30, actualPnlDollar: 20, barsInTrade: 156 }),
    trade({ id: 3, pnlDollar: 50, actualPnlDollar: 40, barsInTrade: 312 }),
  ]);

  assert.equal(metrics.averageHoldingBars, 182);
  assert.equal(metrics.medianHoldingBars, 156);
  assert.equal(metrics.averageHoldingDays, 182 / 78);
  assert.equal(metrics.medianHoldingDays, 2);
});

test("calculates top-five and top-ten contribution concentration", () => {
  const inputs = [100, 80, 60, 40, 20, 10, 5, 3, 2, 1].map((delta, index) =>
    trade({
      id: index + 1,
      pnlDollar: delta + 100,
      actualPnlDollar: 100,
    })
  );
  const metrics = calculateNarrativeScenarioMetrics(inputs);

  assert.equal(metrics.incrementalRealizedPnlDollar, 321);
  assert.equal(metrics.topFiveContributionPct, 300 / 321);
  assert.equal(metrics.topTenContributionPct, 1);
});

test("uses all comparable trades when fewer than five or ten exist", () => {
  const metrics = calculateNarrativeScenarioMetrics([
    trade({ id: 1, pnlDollar: 30, actualPnlDollar: 10 }),
    trade({ id: 2, pnlDollar: 25, actualPnlDollar: 10 }),
  ]);

  assert.equal(metrics.topFiveContributionPct, 1);
  assert.equal(metrics.topTenContributionPct, 1);
});

test("returns unavailable concentration for zero or negative incremental profit", () => {
  const zeroMetrics = calculateNarrativeScenarioMetrics([
    trade({ id: 1, pnlDollar: 10, actualPnlDollar: 10 }),
  ]);
  const negativeMetrics = calculateNarrativeScenarioMetrics([
    trade({ id: 1, pnlDollar: 5, actualPnlDollar: 10 }),
  ]);

  assert.equal(zeroMetrics.topFiveContributionPct, null);
  assert.equal(zeroMetrics.topTenContributionPct, null);
  assert.equal(negativeMetrics.topFiveContributionPct, null);
  assert.equal(negativeMetrics.topTenContributionPct, null);
});

function trade(input: {
  id: number;
  exitReason?: "TARGET" | "STOP" | "TRAIL" | "TIME" | "OPEN";
  pnlDollar: number | null;
  actualPnlDollar: number | null;
  pnlVsActualDollar?: number | null;
  barsInTrade?: number | null;
}): ScenarioAnalysisTrade {
  const pnlPct = input.pnlDollar !== null ? input.pnlDollar / 100 : null;
  const actualPnlPct =
    input.actualPnlDollar !== null ? input.actualPnlDollar / 100 : null;
  const pnlVsActualDollar =
    input.pnlVsActualDollar !== undefined
      ? input.pnlVsActualDollar
      : input.pnlDollar !== null && input.actualPnlDollar !== null
        ? input.pnlDollar - input.actualPnlDollar
        : null;

  return {
    actualTradeId: input.id,
    orderId: String(input.id),
    ticker: "SPY",
    entryTs: new Date("2026-01-01T14:30:00.000Z"),
    exitReason: input.exitReason ?? "TRAIL",
    pnlPct,
    pnlDollar: input.pnlDollar,
    pnlVsActualPct: pnlVsActualDollar !== null ? pnlVsActualDollar / 100 : null,
    pnlVsActualDollar,
    barsInTrade: input.barsInTrade ?? 78,
    actualExitTs: new Date("2026-01-02T14:30:00.000Z"),
    actualPnlPct,
    actualPnlDollar: input.actualPnlDollar,
  };
}
