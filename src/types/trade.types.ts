export interface RawEtradeRow {
  Order?: string;
  "Order type"?: string;
  Quantity?: string;
  Symbol?: string;
  "Price type"?: string;
  Term?: string;
  Price?: string;
  "Price executed"?: string;
  ExecutedDateTime?: string;
  [key: string]: string | undefined;
}

export interface ParsedOrder {
  etradeOrderId: number | null;
  ticker: string;
  side: "BUY" | "SELL";
  executedAt: Date;
  quantity: number;
  priceExecuted: number;
  priceType: string;
  term: string | null;
  limitPrice: number | null;
  rawRow: RawEtradeRow;
}

export interface ImportStats {
  totalRows: number;
  validOrders: number;
  skippedRows: number;
  errors: ImportError[];
  durationMs: number;
}

export interface ImportError {
  rowNumber: number;
  reason: string;
  data?: unknown;
}

export interface PairingStats {
  tradesCreated: number;      // total ActualTrade records created
  singleEntry: number;        // trades with addCount === 0
  withAdds: number;           // trades with addCount === 1 (double-down)
  withMultipleAdds: number;   // trades with addCount >= 2 (triple-down+)
  openPositions: number;      // trades with no SELL found (actualExitTs = null)
  orphanedSells: number;      // SELLs with no matching open position
  durationMs: number;
}
