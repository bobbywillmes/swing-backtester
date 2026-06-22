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
import { getKnownSecurity } from "../data/security-catalog.js";

export async function importEtradeCsv(
  csvContent: string
): Promise<ImportStats> {
  const startTime = Date.now();
  const errors: ImportError[] = [];
  let validOrders = 0;

  try {
    const rows = await parseEtradeCsv(csvContent);
    const parsedOrders: ParsedOrder[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const row = rows[i] as RawEtradeRow;

      try {
        parsedOrders.push(parseEtradeRow(row));
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

    if (errors.length > 0) {
      const durationMs = Date.now() - startTime;

      return {
        totalRows: rows.length,
        validOrders: 0,
        skippedRows: rows.length,
        errors,
        durationMs,
      };
    }

    const unknownSymbols = [
      ...new Set(
        parsedOrders
          .map((order) => order.ticker)
          .filter((ticker) => !getKnownSecurity(ticker))
      ),
    ].sort();

    if (unknownSymbols.length > 0) {
      throw new Error(
        `Security classification required for: ${unknownSymbols.join(", ")}. Add each symbol to SECURITY_CATALOG before importing.`
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const order of parsedOrders) {
        const security = getKnownSecurity(order.ticker);

        if (!security) {
          throw new Error(`Security classification required for: ${order.ticker}`);
        }

        await tx.security.upsert({
          where: { symbol: security.symbol },
          update: {
            name: security.name,
            assetType: security.assetType,
          },
          create: security,
        });

        await tx.actualOrder.create({
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
      }
    });

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
