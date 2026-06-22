export type SecurityAssetType = "ETF" | "STOCK";

export interface SecurityCatalogEntry {
  symbol: string;
  name: string;
  assetType: SecurityAssetType;
}

export const SECURITY_CATALOG: readonly SecurityCatalogEntry[] = [
  { symbol: "AAPL", name: "Apple Inc.", assetType: "STOCK" },
  { symbol: "AMZN", name: "Amazon.com Inc.", assetType: "STOCK" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF Trust", assetType: "ETF" },
  { symbol: "GOOG", name: "Alphabet Inc.", assetType: "STOCK" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", assetType: "ETF" },
  { symbol: "META", name: "Meta Platforms Inc.", assetType: "STOCK" },
  { symbol: "MSFT", name: "Microsoft Corp.", assetType: "STOCK" },
  { symbol: "NVDA", name: "NVIDIA Corp.", assetType: "STOCK" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", assetType: "ETF" },
  { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", assetType: "ETF" },
  { symbol: "RSP", name: "Invesco S&P 500 Equal Weight ETF", assetType: "ETF" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "ETF" },
  { symbol: "TSLA", name: "Tesla Inc.", assetType: "STOCK" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", assetType: "ETF" },
  { symbol: "VTV", name: "Vanguard Value ETF", assetType: "ETF" },
];

const SECURITY_CATALOG_BY_SYMBOL = new Map(
  SECURITY_CATALOG.map((security) => [security.symbol, security])
);

export function getKnownSecurity(
  symbol: string
): SecurityCatalogEntry | undefined {
  return SECURITY_CATALOG_BY_SYMBOL.get(symbol.trim().toUpperCase());
}

export function isKnownSecurity(symbol: string): boolean {
  return getKnownSecurity(symbol) !== undefined;
}

export function getSecurityCatalogSymbols(): string[] {
  return SECURITY_CATALOG.map((security) => security.symbol);
}
