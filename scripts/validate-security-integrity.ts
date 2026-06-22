import prisma from "../src/db/prisma.js";
import {
  validateSecurityIntegrity,
  RunScopeRecord,
  SymbolCount,
} from "../src/validation/security-integrity.js";

interface Args {
  runId?: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    const value = args[i + 1];

    if (value) {
      params[key] = value;
    }
  }

  if (params.runId) {
    const runId = parseInt(params.runId, 10);

    if (isNaN(runId)) {
      throw new Error("Usage: npm run validate-security-integrity -- --runId <id>");
    }

    return { runId };
  }

  return {};
}

async function main() {
  const args = parseArgs();

  const securities = await prisma.security.findMany({
    orderBy: { symbol: "asc" },
    select: {
      symbol: true,
      name: true,
      assetType: true,
    },
  });

  const actualTradeGroups = await prisma.actualTrade.groupBy({
    by: ["ticker"],
    _count: { _all: true },
    orderBy: { ticker: "asc" },
  });
  const actualTradeSymbols: SymbolCount[] = actualTradeGroups.map((group) => ({
    symbol: group.ticker,
    count: group._count._all,
  }));

  const runScopeRows = args.runId
    ? await prisma.backtestTrade.findMany({
        where: { runId: args.runId },
        select: {
          actualTrade: {
            select: {
              ticker: true,
              security: {
                select: { assetType: true },
              },
            },
          },
          scenario: {
            select: {
              name: true,
              assetTypeScope: true,
            },
          },
        },
      })
    : [];

  const runScopeRecords: RunScopeRecord[] = runScopeRows.map((row) => ({
    symbol: row.actualTrade.ticker,
    securityAssetType: row.actualTrade.security.assetType,
    scenarioName: row.scenario.name,
    scenarioAssetTypeScope: row.scenario.assetTypeScope,
  }));

  const report = validateSecurityIntegrity({
    securities,
    actualTradeSymbols,
    runScopeRecords,
  });

  console.log("\nSecurity integrity report");
  console.log("=========================");
  console.log(`Stored securities: ${securities.length}`);
  console.log(`Actual-trade symbols: ${actualTradeSymbols.length}`);

  if (args.runId) {
    console.log(`Run checked: ${args.runId}`);
    console.log(`Run scope records: ${runScopeRecords.length}`);
  } else {
    console.log("Run checked: none (pass --runId to check historical scope conflicts)");
  }

  printList("Unknown stored symbols", report.unknownStoredSymbols);
  printSymbolCounts("Unknown actual-trade symbols", report.unknownTradeSymbols);

  console.log(`\nMetadata conflicts: ${report.metadataConflicts.length}`);
  for (const conflict of report.metadataConflicts) {
    console.log(
      `- ${conflict.symbol}: stored "${conflict.storedName}" / ${conflict.storedAssetType}; catalog "${conflict.catalogName}" / ${conflict.catalogAssetType}`
    );
  }

  console.log(`\nRun scope conflicts: ${report.scopeConflicts.length}`);
  for (const conflict of report.scopeConflicts) {
    console.log(
      `- ${conflict.symbol}: ${conflict.count} trade(s) used scenario "${conflict.scenarioName}" scoped to ${conflict.scenarioAssetTypeScope} while security is ${conflict.securityAssetType}`
    );
  }

  if (report.hasConflicts) {
    console.log("\nResult: conflicts found. Affected runs should not be authoritative until rerun.");
    process.exitCode = 1;
  } else {
    console.log("\nResult: no integrity conflicts found.");
  }
}

function printList(label: string, values: string[]): void {
  console.log(`\n${label}: ${values.length}`);

  for (const value of values) {
    console.log(`- ${value}`);
  }
}

function printSymbolCounts(label: string, values: SymbolCount[]): void {
  console.log(`\n${label}: ${values.length}`);

  for (const value of values) {
    console.log(`- ${value.symbol}: ${value.count}`);
  }
}

main()
  .catch((error) => {
    console.error("\nSecurity integrity validation failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
