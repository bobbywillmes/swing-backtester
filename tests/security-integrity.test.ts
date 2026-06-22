import test from "node:test";
import assert from "node:assert/strict";
import { validateSecurityIntegrity } from "../src/validation/security-integrity.js";

test("detects security metadata that disagrees with the catalog", () => {
  const report = validateSecurityIntegrity({
    securities: [
      { symbol: "RSP", name: "RSP", assetType: "STOCK" },
      {
        symbol: "SPY",
        name: "SPDR S&P 500 ETF Trust",
        assetType: "ETF",
      },
    ],
    actualTradeSymbols: [],
    runScopeRecords: [],
  });

  assert.equal(report.metadataConflicts.length, 1);
  assert.equal(report.metadataConflicts[0]?.symbol, "RSP");
  assert.equal(report.metadataConflicts[0]?.catalogAssetType, "ETF");
  assert.equal(report.hasConflicts, true);
});

test("detects symbols missing from the trusted catalog", () => {
  const report = validateSecurityIntegrity({
    securities: [{ symbol: "XYZ", name: "XYZ", assetType: "STOCK" }],
    actualTradeSymbols: [{ symbol: "XYZ", count: 3 }],
    runScopeRecords: [],
  });

  assert.deepEqual(report.unknownStoredSymbols, ["XYZ"]);
  assert.deepEqual(report.unknownTradeSymbols, [{ symbol: "XYZ", count: 3 }]);
  assert.equal(report.hasConflicts, true);
});

test("detects historical run scope conflicts", () => {
  const report = validateSecurityIntegrity({
    securities: [],
    actualTradeSymbols: [],
    runScopeRecords: [
      {
        symbol: "RSP",
        securityAssetType: "ETF",
        scenarioName: "Stock: Medium Trail 1.0%",
        scenarioAssetTypeScope: "STOCK",
      },
      {
        symbol: "RSP",
        securityAssetType: "ETF",
        scenarioName: "Stock: Medium Trail 1.0%",
        scenarioAssetTypeScope: "STOCK",
      },
      {
        symbol: "SPY",
        securityAssetType: "ETF",
        scenarioName: "ETF: Medium Trail 0.5%",
        scenarioAssetTypeScope: "ETF",
      },
    ],
  });

  assert.equal(report.scopeConflicts.length, 1);
  assert.equal(report.scopeConflicts[0]?.symbol, "RSP");
  assert.equal(report.scopeConflicts[0]?.count, 2);
  assert.equal(report.hasConflicts, true);
});

test("allows unscoped scenarios in historical run checks", () => {
  const report = validateSecurityIntegrity({
    securities: [],
    actualTradeSymbols: [],
    runScopeRecords: [
      {
        symbol: "SPY",
        securityAssetType: "ETF",
        scenarioName: "Legacy Scenario",
        scenarioAssetTypeScope: null,
      },
    ],
  });

  assert.equal(report.scopeConflicts.length, 0);
  assert.equal(report.hasConflicts, false);
});
