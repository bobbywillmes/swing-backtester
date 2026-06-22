import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { createApiApp } from "../src/api/app.js";
import {
  ApiScenarioExplorer,
  ApiScenarioTradeDetail,
  ApiScenarioTradesResponse,
} from "../src/api/types.js";

test("GET /api/backtest-runs/:runId/scenarios/:scenarioId returns scenario explorer semantics", async (t) => {
  const server = createServer(createApiApp());

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/backtest-runs/29/scenarios/50`
    );

    if (response.status === 404) {
      t.skip("local run 29 is not available");
      return;
    }

    const body = (await response.json()) as ApiScenarioExplorer;

    assert.equal(response.status, 200);
    assert.equal(body.run.id, 29);
    assert.equal(body.scenario.scenarioId, 50);
    assert.equal(body.scenario.scenarioGroup, "Target Unlocks Trail");
    assert.equal(body.metrics.totalTrades, 112);
    assert.equal(body.metrics.comparableTrades, 107);
    assert.equal(body.metrics.openSimulations, 5);
    assert.ok(body.availableFilters.tickers.includes("QQQ"));
    assert.ok(body.availableFilters.comparisonStatuses.includes("IMPROVED"));
    assert.ok(body.availableFilters.comparisonStatuses.includes("WORSE"));
    assert.ok(
      body.availableFilters.comparisonStatuses.includes("OPEN_SIMULATION")
    );
  } finally {
    await closeServer(server);
  }
});

test("GET /api/backtest-runs/:runId/scenarios/:scenarioId/trades returns trade rows and details", async (t) => {
  const server = createServer(createApiApp());

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(
      `${baseUrl}/api/backtest-runs/29/scenarios/50/trades`
    );

    if (response.status === 404) {
      t.skip("local run 29 is not available");
      return;
    }

    const body = (await response.json()) as ApiScenarioTradesResponse;
    const firstTrade = body.trades[0];

    assert.equal(response.status, 200);
    assert.equal(body.run.id, 29);
    assert.equal(body.scenario.scenarioId, 50);
    assert.equal(body.trades.length, 112);
    assert.equal(firstTrade?.ticker, "QQQ");
    assert.equal(firstTrade?.entryType, "Single Entry");
    assert.equal(firstTrade?.comparisonStatus, "WORSE");
    assert.equal(firstTrade?.actualTradeId, 891);

    const detailResponse = await fetch(
      `${baseUrl}/api/backtest-runs/29/scenarios/50/trades/${firstTrade?.backtestTradeId}`
    );
    const detailBody = (await detailResponse.json()) as {
      trade: ApiScenarioTradeDetail;
    };

    assert.equal(detailResponse.status, 200);
    assert.equal(detailBody.trade.actualTradeId, firstTrade?.actualTradeId);
    assert.equal(detailBody.trade.scenario.scenarioId, 50);
    assert.equal(detailBody.trade.orders.length, 2);
    assert.equal(detailBody.trade.orders[0]?.orderRole, "OPEN");
    assert.equal(detailBody.trade.orders[1]?.orderRole, "CLOSE");
  } finally {
    await closeServer(server);
  }
});

async function closeServer(server: ReturnType<typeof createServer>) {
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
