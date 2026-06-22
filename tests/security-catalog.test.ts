import test from "node:test";
import assert from "node:assert/strict";
import {
  getKnownSecurity,
  getSecurityCatalogSymbols,
} from "../src/data/security-catalog.js";

test("known ETFs are classified as ETFs", () => {
  for (const symbol of ["SPY", "QQQ", "DIA", "IWM", "RSP", "QQQM", "VOO", "VTV"]) {
    assert.equal(getKnownSecurity(symbol)?.assetType, "ETF", symbol);
  }
});

test("known stocks are classified as stocks", () => {
  for (const symbol of ["AAPL", "AMZN", "GOOG", "META", "MSFT", "NVDA", "TSLA"]) {
    assert.equal(getKnownSecurity(symbol)?.assetType, "STOCK", symbol);
  }
});

test("security lookup normalizes input symbols", () => {
  assert.equal(getKnownSecurity(" rsp ")?.symbol, "RSP");
});

test("unknown symbols require explicit classification", () => {
  assert.equal(getKnownSecurity("NOTREAL"), undefined);
});

test("catalog includes every symbol in the current actual-trade dataset", () => {
  assert.deepEqual(getSecurityCatalogSymbols().sort(), [
    "AAPL",
    "AMZN",
    "DIA",
    "GOOG",
    "IWM",
    "META",
    "MSFT",
    "NVDA",
    "QQQ",
    "QQQM",
    "RSP",
    "SPY",
    "TSLA",
    "VOO",
    "VTV",
  ]);
});
