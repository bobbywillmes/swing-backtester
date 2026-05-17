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
  totalBuys: number;
  totalSells: number;
  pairedTrades: number;
  unpaired: {
    buys: number;
    sells: number;
  };
  durationMs: number;
}
