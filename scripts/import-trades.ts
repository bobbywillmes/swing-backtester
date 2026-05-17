import { readFileSync } from "fs";
import { resolve } from "path";
import prisma from "../src/db/prisma.js";
import { importEtradeCsv } from "../src/ingestion/trade.importer.js";
import { pairTrades } from "../src/ingestion/trade.pairer.js";

interface Args {
  file: string;
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

  if (!params.file) {
    console.error(
      "Usage: npx tsx scripts/import-trades.ts --file ./data/orders.csv"
    );
    process.exit(1);
  }

  return {
    file: params.file,
  };
}

async function main() {
  const args = parseArgs();
  const filePath = resolve(args.file);

  console.log(`\nImporting E*TRADE orders from ${filePath}`);

  try {
    // Read CSV file
    const csvContent = readFileSync(filePath, "utf-8");

    if (!csvContent.trim()) {
      console.error("\n✗ CSV file is empty\n");
      process.exit(1);
    }

    // Import orders
    console.log("\nParsing and importing orders...");
    const importStats = await importEtradeCsv(csvContent);

    console.log(`  ✓ Valid orders: ${importStats.validOrders}`);
    console.log(`  ✗ Errors: ${importStats.errors.length}`);
    console.log(`  Duration: ${importStats.durationMs}ms`);

    if (importStats.errors.length > 0) {
      console.log("\n  First 5 errors:");
      for (const error of importStats.errors.slice(0, 5)) {
        console.log(`    Row ${error.rowNumber}: ${error.reason}`);
      }
      if (importStats.errors.length > 5) {
        console.log(
          `    ... and ${importStats.errors.length - 5} more errors`
        );
      }
    }

    if (importStats.validOrders === 0) {
      console.log("\n⚠ No valid orders to import.\n");
      process.exit(0);
    }

    // Pair trades
    console.log("\nPairing orders into trades...");
    const pairingStats = await pairTrades();

    console.log(`  Buys:  ${pairingStats.totalBuys}`);
    console.log(`  Sells: ${pairingStats.totalSells}`);
    console.log(`  ✓ Paired trades: ${pairingStats.pairedTrades}`);
    if (pairingStats.unpaired.buys > 0) {
      console.log(`  ⚠ Unpaired buys (open): ${pairingStats.unpaired.buys}`);
    }
    if (pairingStats.unpaired.sells > 0) {
      console.log(`  ⚠ Orphaned sells: ${pairingStats.unpaired.sells}`);
    }
    console.log(`  Duration: ${pairingStats.durationMs}ms`);

    console.log("\n✓ Import complete\n");
  } catch (error) {
    console.error("\n✗ Import failed:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    } else {
      console.error(`  ${error}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
