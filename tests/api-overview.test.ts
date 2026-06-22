import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { createApiApp } from "../src/api/app.js";
import { ApiRunOverview } from "../src/api/types.js";

test("GET /api/backtest-runs/:runId/overview returns v5 metric semantics", async (t) => {
  const server = createServer(createApiApp());

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/backtest-runs/29/overview?scenarioId=50&assetType=ALL`
    );

    if (response.status === 404) {
      t.skip("local run 29 is not available");
      return;
    }

    const overview = (await response.json()) as ApiRunOverview;

    assert.equal(response.status, 200);
    assert.equal(overview.run.id, 29);
    assert.equal(overview.integrity.ok, true);
    assert.equal(overview.selectedScenario.scenarioId, 50);
    assert.equal(overview.selectedScenario.metrics.totalTrades, 112);
    assert.equal(overview.selectedScenario.metrics.comparableTrades, 107);
    assert.equal(overview.selectedScenario.metrics.openSimulations, 5);
    assert.equal(overview.selectedScenario.metrics.improvedTrades, 61);
    assert.equal(overview.selectedScenario.metrics.worseTrades, 46);
    assert.equal(overview.selectedScenario.metrics.unchangedTrades, 0);
    assert.ok(overview.cumulativeProfit.length > 0);
    assert.ok(overview.tickerContributions.length > 0);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});
