import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActualTradeBenchmarkRow,
  ExportTradeRow,
  isActualTradeBenchmarkRow,
} from "../src/exporting/results-export.js";

test("builds one typed Actual Trade benchmark row from a scenario row", () => {
  const scenarioRow = sampleScenarioRow();
  const actualRow = buildActualTradeBenchmarkRow(scenarioRow);

  assert.equal(actualRow.id, -1);
  assert.equal(actualRow.scenarioId, -1);
  assert.equal(actualRow.scenario.name, "Actual Trade");
  assert.equal(actualRow.exitTs, scenarioRow.actualTrade.actualExitTs);
  assert.equal(actualRow.exitPrice, scenarioRow.actualTrade.actualExitPrice);
  assert.equal(actualRow.exitReason, "limit_sell");
  assert.equal(actualRow.pnlPct, scenarioRow.actualTrade.actualPnlPct);
  assert.equal(actualRow.pnlDollar, scenarioRow.actualTrade.actualPnlDollar);
  assert.equal(actualRow.pnlVsActualPct, 0);
  assert.equal(actualRow.pnlVsActualDollar, 0);
  assert.equal(actualRow.runningHighPrice, null);
  assert.equal(actualRow.runningHighPct, null);
  assert.equal(actualRow.trailActivatedAt, null);
  assert.equal(isActualTradeBenchmarkRow(actualRow), true);
});

test("keeps open Actual Trade benchmark exit fields nullable", () => {
  const scenarioRow = sampleScenarioRow();
  scenarioRow.actualTrade.actualExitTs = null;
  scenarioRow.actualTrade.actualExitPrice = null;
  scenarioRow.actualTrade.actualExitReason = "open";
  scenarioRow.actualTrade.actualPnlPct = null;
  scenarioRow.actualTrade.actualPnlDollar = null;
  scenarioRow.actualTrade.actualBarsHeld = null;

  const actualRow = buildActualTradeBenchmarkRow(scenarioRow);

  assert.equal(actualRow.exitTs, null);
  assert.equal(actualRow.exitPrice, null);
  assert.equal(actualRow.exitReason, "open");
  assert.equal(actualRow.pnlPct, null);
  assert.equal(actualRow.pnlDollar, null);
  assert.equal(actualRow.barsInTrade, null);
  assert.equal(actualRow.pnlVsActualPct, 0);
  assert.equal(actualRow.pnlVsActualDollar, 0);
});

function sampleScenarioRow(): ExportTradeRow {
  return {
    id: 101,
    runId: 28,
    actualTradeId: 7,
    scenarioId: 50,
    exitTs: new Date("2026-01-03T15:00:00.000Z"),
    exitPrice: 110,
    exitReason: "TRAIL",
    pnlPct: 0.1,
    pnlDollar: 100,
    pnlVsActualPct: 0.05,
    pnlVsActualDollar: 50,
    barsInTrade: 78,
    runningHighPrice: 112,
    runningHighPct: 0.12,
    trailActivatedAt: new Date("2026-01-02T15:00:00.000Z"),
    regimeAtEntry: "NORMAL",
    spyAtrPctAtEntry: 0.01,
    actualTrade: {
      id: 7,
      ticker: "SPY",
      entryPrice: 100,
      entryTs: new Date("2026-01-01T15:00:00.000Z"),
      shares: 10,
      actualExitPrice: 105,
      actualExitTs: new Date("2026-01-02T15:00:00.000Z"),
      actualExitReason: "limit_sell",
      actualPnlPct: 0.05,
      actualPnlDollar: 50,
      actualBarsHeld: 50,
      addCount: 0,
      security: { assetType: "ETF" },
      orders: [{ etradeOrderId: "1234" }],
    },
    scenario: {
      name: "ETF: +1.0% Unlock -> Trail 0.5%",
      targetPct: 0.01,
      targetIsHardExit: false,
      stopPct: null,
      trailingStopPct: -0.005,
      trailActivateAfterPct: 0.01,
      maxHoldBars: null,
      assetTypeScope: "ETF",
    },
  };
}
