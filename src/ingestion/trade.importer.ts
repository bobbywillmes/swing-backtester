import prisma from "../db/prisma.js";
import {
  parseEtradeCsv,
  stripCommas,
  stripTrailingDagger,
  parseFloat_,
  parseEstDateTime,
} from "../utils/csv.utils.js";
import {
  RawEtradeRow,
  ParsedOrder,
  ImportStats,
  ImportError,
} from "../types/trade.types.js";

export async function importEtradeCsv(
  csvContent: string
): Promise<ImportStats> {
  const startTime = Date.now();
  const errors: ImportError[] = [];
  let validOrders = 0;

  try {
    const rows = await parseEtradeCsv(csvContent);

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 because CSV header is row 1, data starts at row 2
      const row = rows[i] as RawEtradeRow;

      try {
        const order = parseEtradeRow(row);

        // Ensure security exists (create if missing)
        const existingSecurity = await prisma.security.findUnique({
          where: { symbol: order.ticker },
        });

        if (!existingSecurity) {
          await prisma.security.create({
            data: {
              symbol: order.ticker,
              name: order.ticker, // Placeholder; user can update later
              assetType: "STOCK", // Default to STOCK; can be ETF/other
            },
          });
          console.log(`  ℹ Auto-created security: ${order.ticker}`);
        }

        // Insert ActualOrder
        await prisma.actualOrder.create({
          data: {
            etradeOrderId: order.etradeOrderId,
            ticker: order.ticker,
            side: order.side,
            executedAt: order.executedAt,
            quantity: order.quantity,
            priceExecuted: order.priceExecuted,
            priceType: order.priceType,
            term: order.term,
            limitPrice: order.limitPrice,
            rawRow: order.rawRow,
          },
        });

        validOrders++;
      } catch (error) {
        errors.push({
          rowNumber,
          reason:
            error instanceof Error
              ? error.message
              : "Unknown parsing error",
          data: row,
        });
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      totalRows: rows.length,
      validOrders,
      skippedRows: rows.length - validOrders,
      errors,
      durationMs,
    };
  } catch (error) {
    throw new Error(
      `CSV import failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function parseEtradeRow(row: RawEtradeRow): ParsedOrder {
  const orderIdStr = row.Order?.trim();
  const etradeOrderId = orderIdStr ? parseInt(orderIdStr, 10) : null;

  if (!orderIdStr) {
    throw new Error("Missing Order ID");
  }

  const orderType = row["Order type"]?.trim().toUpperCase();
  if (!orderType || !["BUY", "SELL"].includes(orderType)) {
    throw new Error(`Invalid order type: ${orderType}`);
  }

  const ticker = row.Symbol?.trim().toUpperCase();
  if (!ticker) {
    throw new Error("Missing symbol");
  }

  const quantityStr = row.Quantity ? stripCommas(row.Quantity) : "";
  const quantity = parseFloat(quantityStr);
  if (!quantityStr || isNaN(quantity)) {
    throw new Error(`Invalid quantity: ${row.Quantity}`);
  }

  const priceExecutedStr = row["Price executed"]
    ? stripTrailingDagger(row["Price executed"])
    : "";
  const priceExecuted = parseFloat(priceExecutedStr);
  if (!priceExecutedStr || isNaN(priceExecuted)) {
    throw new Error(`Invalid price executed: ${row["Price executed"]}`);
  }

  const executedAtStr = row.ExecutedDateTime;
  const executedAt = parseEstDateTime(executedAtStr);
  if (!executedAt) {
    throw new Error(`Invalid executed date/time: ${executedAtStr}`);
  }

  const priceType = row["Price type"]?.trim() || "";
  if (!priceType) {
    throw new Error("Missing price type");
  }

  const term = row.Term?.trim() || null;

  let limitPrice: number | null = null;
  if (row.Price && row.Price.trim().toUpperCase() !== "MKT") {
    limitPrice = parseFloat_(row.Price);
  }

  return {
    etradeOrderId,
    ticker,
    side: orderType as "BUY" | "SELL",
    executedAt,
    quantity,
    priceExecuted,
    priceType,
    term,
    limitPrice,
    rawRow: row,
  };
}
