export function formatDollar(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDollarPrecise(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }

  return `${(value * 100).toFixed(2)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US").format(value);
}
