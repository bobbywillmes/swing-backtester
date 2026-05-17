export interface MassiveAgg {
  t: number; // Unix milliseconds
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vw?: number; // VWAP
  n?: number; // transaction count
}

export interface MassiveResponse {
  results?: MassiveAgg[];
  ticker: string;
  status: string;
  next_url?: string;
}

export interface OhlcCandle {
  ticker: string;
  ts: Date; // UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
  vwap?: number;
  transactions?: number;
}

export interface IngestionStats {
  ticker: string;
  from: Date;
  to: Date;
  candlesRequested: number;
  candlesInserted: number;
  candlesUpdated: number;
  durationMs: number;
}
