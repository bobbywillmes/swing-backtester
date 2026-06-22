import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Badge,
  Box,
  Drawer,
  Group,
  Loader,
  NativeSelect,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import {
  fetchScenarioExplorer,
  fetchScenarioTradeDetail,
  fetchScenarioTrades,
} from "./api";
import {
  ComparisonStatus,
  ScenarioExplorer,
  ScenarioTradeDetail,
  ScenarioTradeSummary,
  ScenarioTradesResponse,
} from "./types";
import {
  formatDollar,
  formatDollarPrecise,
  formatNumber,
  formatPercent,
} from "./format";

type FilterValue = "ALL" | string;
type SortKey =
  | "entryTs"
  | "ticker"
  | "pnlDollar"
  | "pnlVsActualDollar"
  | "daysInTrade"
  | "comparisonStatus";
type SortDirection = "asc" | "desc";

const STATUS_LABELS: Record<ComparisonStatus, string> = {
  IMPROVED: "Improved",
  WORSE: "Worse",
  UNCHANGED: "Unchanged",
  OPEN_SIMULATION: "Open simulation",
  NOT_COMPARABLE: "Not comparable",
};

export function ScenarioExplorerPage() {
  const navigate = useNavigate();
  const params = useParams();
  const runId = Number(params.runId);
  const scenarioId = Number(params.scenarioId);
  const [explorer, setExplorer] = useState<ScenarioExplorer | null>(null);
  const [tradeResponse, setTradeResponse] =
    useState<ScenarioTradesResponse | null>(null);
  const [selectedTrade, setSelectedTrade] =
    useState<ScenarioTradeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickerFilter, setTickerFilter] = useState<FilterValue>("ALL");
  const [statusFilter, setStatusFilter] = useState<FilterValue>("ALL");
  const [exitReasonFilter, setExitReasonFilter] = useState<FilterValue>("ALL");
  const [entryTypeFilter, setEntryTypeFilter] = useState<FilterValue>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("pnlVsActualDollar");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    if (!Number.isFinite(runId) || !Number.isFinite(scenarioId)) {
      setError("Invalid scenario route");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    Promise.all([
      fetchScenarioExplorer({ runId, scenarioId }),
      fetchScenarioTrades({ runId, scenarioId }),
    ])
      .then(([nextExplorer, nextTrades]) => {
        setExplorer(nextExplorer);
        setTradeResponse(nextTrades);
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error ? requestError.message : String(requestError)
        );
      })
      .finally(() => setLoading(false));
  }, [runId, scenarioId]);

  const filteredTrades = useMemo(() => {
    const trades = tradeResponse?.trades ?? [];
    return trades
      .filter((trade) => tickerFilter === "ALL" || trade.ticker === tickerFilter)
      .filter(
        (trade) =>
          statusFilter === "ALL" || trade.comparisonStatus === statusFilter
      )
      .filter(
        (trade) =>
          exitReasonFilter === "ALL" || trade.exitReason === exitReasonFilter
      )
      .filter(
        (trade) => entryTypeFilter === "ALL" || trade.entryType === entryTypeFilter
      )
      .sort((a, b) => compareTrades(a, b, sortKey, sortDirection));
  }, [
    entryTypeFilter,
    exitReasonFilter,
    sortDirection,
    sortKey,
    statusFilter,
    tickerFilter,
    tradeResponse,
  ]);

  const narrative = useMemo(() => {
    if (!explorer) {
      return "";
    }

    return `${explorer.scenario.scenarioName} produced ${formatDollar(
      explorer.metrics.incrementalRealizedPnlDollar
    )} of realized uplift across ${formatNumber(
      explorer.metrics.comparableTrades
    )} comparable trades, with ${formatNumber(
      explorer.metrics.improvedTrades
    )} improved and ${formatNumber(explorer.metrics.worseTrades)} worse exits.`;
  }, [explorer]);

  const openTradeDetail = (trade: ScenarioTradeSummary) => {
    setDetailLoading(true);
    fetchScenarioTradeDetail({
      runId,
      scenarioId,
      backtestTradeId: trade.backtestTradeId,
    })
      .then(setSelectedTrade)
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error ? requestError.message : String(requestError)
        );
      })
      .finally(() => setDetailLoading(false));
  };

  return (
    <Box className="appShell">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" gap="md">
          <Group align="flex-end" gap="md">
            <Tooltip label="Back to run overview">
              <button
                className="iconButton"
                type="button"
                onClick={() => navigate("/")}
                aria-label="Back to run overview"
              >
                <ArrowLeft size={18} />
              </button>
            </Tooltip>
            <Box>
              <Text className="eyebrow">Scenario Explorer</Text>
              <Title order={1}>
                {explorer?.scenario.scenarioName ?? "Scenario"}
              </Title>
            </Box>
          </Group>
          <Tooltip label="Refresh page data">
            <button
              className="iconButton"
              type="button"
              onClick={() => window.location.reload()}
              aria-label="Refresh page data"
            >
              <RefreshCw size={18} />
            </button>
          </Tooltip>
        </Group>

        {error ? (
          <Alert color="red" icon={<AlertTriangle size={18} />}>
            {error}
          </Alert>
        ) : null}

        {loading || !explorer || !tradeResponse ? (
          <Group className="loadingState" justify="center">
            <Loader />
          </Group>
        ) : (
          <>
            <Group justify="space-between" className="runMeta">
              <Group gap="xs">
                {explorer.integrity.ok ? (
                  <Badge color="green" leftSection={<CheckCircle2 size={13} />}>
                    Integrity passed
                  </Badge>
                ) : (
                  <Badge color="red" leftSection={<AlertTriangle size={13} />}>
                    Integrity conflicts
                  </Badge>
                )}
                <Badge variant="light">Run {explorer.run.id}</Badge>
                <Badge variant="light">{explorer.scenario.scenarioGroup}</Badge>
                <Badge variant="light">{explorer.scenario.assetTypeScope}</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {new Date(explorer.run.createdAt).toLocaleString()}
              </Text>
            </Group>

            <Text className="narrative">{narrative}</Text>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <MetricCard
                label="Incremental realized profit"
                value={formatDollar(explorer.metrics.incrementalRealizedPnlDollar)}
                tone="green"
              />
              <MetricCard
                label="Realized uplift"
                value={formatPercent(explorer.metrics.realizedUpliftPct)}
                tone="blue"
              />
              <MetricCard
                label="Median improvement"
                value={formatDollarPrecise(explorer.metrics.medianDollarImprovement)}
                tone="amber"
              />
              <MetricCard
                label="Median hold days"
                value={
                  explorer.metrics.medianHoldingDays !== null
                    ? explorer.metrics.medianHoldingDays.toFixed(2)
                    : "n/a"
                }
                tone="rose"
              />
            </SimpleGrid>

            <Paper className="controlBand" withBorder>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 6 }} spacing="md">
                <NativeSelect
                  label="Ticker"
                  value={tickerFilter}
                  onChange={(event) => setTickerFilter(event.currentTarget.value)}
                  data={toSelectOptions(explorer.availableFilters.tickers)}
                />
                <NativeSelect
                  label="Status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.currentTarget.value)}
                  data={toSelectOptions(
                    explorer.availableFilters.comparisonStatuses,
                    STATUS_LABELS
                  )}
                />
                <NativeSelect
                  label="Exit"
                  value={exitReasonFilter}
                  onChange={(event) =>
                    setExitReasonFilter(event.currentTarget.value)
                  }
                  data={toSelectOptions(explorer.availableFilters.exitReasons)}
                />
                <NativeSelect
                  label="Entry"
                  value={entryTypeFilter}
                  onChange={(event) =>
                    setEntryTypeFilter(event.currentTarget.value)
                  }
                  data={toSelectOptions(explorer.availableFilters.entryTypes)}
                />
                <NativeSelect
                  label="Sort"
                  value={sortKey}
                  onChange={(event) => setSortKey(event.currentTarget.value as SortKey)}
                  data={[
                    { label: "Entry date", value: "entryTs" },
                    { label: "Ticker", value: "ticker" },
                    { label: "Scenario P&L", value: "pnlDollar" },
                    { label: "vs Actual $", value: "pnlVsActualDollar" },
                    { label: "Days held", value: "daysInTrade" },
                    { label: "Status", value: "comparisonStatus" },
                  ]}
                />
                <NativeSelect
                  label="Direction"
                  value={sortDirection}
                  onChange={(event) =>
                    setSortDirection(event.currentTarget.value as SortDirection)
                  }
                  data={[
                    { label: "Descending", value: "desc" },
                    { label: "Ascending", value: "asc" },
                  ]}
                />
              </SimpleGrid>
            </Paper>

            <ChartPanel
              title={`Trade Comparison (${formatNumber(filteredTrades.length)})`}
            >
              <ScrollArea>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Order</Table.Th>
                      <Table.Th>Ticker</Table.Th>
                      <Table.Th>Entry</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Exit</Table.Th>
                      <Table.Th>Scenario $</Table.Th>
                      <Table.Th>Actual $</Table.Th>
                      <Table.Th>vs Actual $</Table.Th>
                      <Table.Th>Days</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredTrades.map((trade) => (
                      <Table.Tr
                        key={trade.backtestTradeId}
                        className="clickableRow"
                        onClick={() => openTradeDetail(trade)}
                      >
                        <Table.Td>{trade.orderId ?? "n/a"}</Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Text fw={700}>{trade.ticker}</Text>
                            <Badge variant="light">{trade.assetType}</Badge>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {new Date(trade.entryTs).toLocaleDateString()}
                        </Table.Td>
                        <Table.Td>
                          <ComparisonBadge status={trade.comparisonStatus} />
                        </Table.Td>
                        <Table.Td>{trade.exitReason ?? "n/a"}</Table.Td>
                        <Table.Td>{formatDollarPrecise(trade.pnlDollar)}</Table.Td>
                        <Table.Td>
                          {formatDollarPrecise(trade.actualPnlDollar)}
                        </Table.Td>
                        <Table.Td>
                          {formatDollarPrecise(trade.pnlVsActualDollar)}
                        </Table.Td>
                        <Table.Td>
                          {trade.daysInTrade !== null
                            ? trade.daysInTrade.toFixed(2)
                            : "n/a"}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </ChartPanel>
          </>
        )}
      </Stack>

      <Drawer
        opened={selectedTrade !== null || detailLoading}
        onClose={() => setSelectedTrade(null)}
        position="right"
        size="lg"
        title={selectedTrade ? `${selectedTrade.ticker} Trade Detail` : "Trade Detail"}
      >
        {detailLoading || !selectedTrade ? (
          <Group className="loadingState" justify="center">
            <Loader />
          </Group>
        ) : (
          <TradeDetail trade={selectedTrade} />
        )}
      </Drawer>
    </Box>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  tone: "green" | "blue" | "amber" | "rose";
}) {
  return (
    <Paper className={`metricCard metric-${props.tone}`} withBorder>
      <Text size="sm" c="dimmed">
        {props.label}
      </Text>
      <Text className="metricValue">{props.value}</Text>
    </Paper>
  );
}

function ChartPanel(props: { title: string; children: React.ReactNode }) {
  return (
    <Paper className="panel" withBorder>
      <Title order={2}>{props.title}</Title>
      {props.children}
    </Paper>
  );
}

function TradeDetail(props: { trade: ScenarioTradeDetail }) {
  const trade = props.trade;

  return (
    <Stack gap="md">
      <Group gap="xs">
        <ComparisonBadge status={trade.comparisonStatus} />
        <Badge variant="light">{trade.entryType}</Badge>
        <Badge variant="light">{trade.exitReason ?? "n/a"}</Badge>
      </Group>

      <SimpleGrid cols={2} spacing="sm">
        <DetailItem label="Order" value={trade.orderId ?? "n/a"} />
        <DetailItem label="Actual trade" value={String(trade.actualTradeId)} />
        <DetailItem
          label="Entry"
          value={`${new Date(trade.entryTs).toLocaleString()} @ ${formatDollarPrecise(
            trade.entryPrice
          )}`}
        />
        <DetailItem
          label="Scenario exit"
          value={
            trade.exitTs
              ? `${new Date(trade.exitTs).toLocaleString()} @ ${formatDollarPrecise(
                  trade.exitPrice
                )}`
              : "n/a"
          }
        />
        <DetailItem
          label="Actual exit"
          value={
            trade.actualExitTs
              ? `${new Date(trade.actualExitTs).toLocaleString()} @ ${formatDollarPrecise(
                  trade.actualExitPrice
                )}`
              : "n/a"
          }
        />
        <DetailItem
          label="Capital"
          value={formatDollarPrecise(trade.capitalDeployed)}
        />
        <DetailItem
          label="Scenario P&L"
          value={`${formatDollarPrecise(trade.pnlDollar)} (${formatPercent(
            trade.pnlPct
          )})`}
        />
        <DetailItem
          label="Actual P&L"
          value={`${formatDollarPrecise(trade.actualPnlDollar)} (${formatPercent(
            trade.actualPnlPct
          )})`}
        />
        <DetailItem
          label="vs Actual"
          value={`${formatDollarPrecise(
            trade.pnlVsActualDollar
          )} (${formatPercent(trade.pnlVsActualPct)})`}
        />
        <DetailItem
          label="Holding days"
          value={trade.daysInTrade !== null ? trade.daysInTrade.toFixed(2) : "n/a"}
        />
        <DetailItem
          label="Running high"
          value={`${formatDollarPrecise(trade.runningHighPrice)} (${formatPercent(
            trade.runningHighPct
          )})`}
        />
        <DetailItem
          label="Trail activated"
          value={
            trade.trailActivatedAt
              ? new Date(trade.trailActivatedAt).toLocaleString()
              : "n/a"
          }
        />
        <DetailItem label="Regime" value={trade.regimeAtEntry ?? "n/a"} />
        <DetailItem
          label="SPY ATR"
          value={formatPercent(trade.spyAtrPctAtEntry)}
        />
      </SimpleGrid>

      <Paper className="panel compactPanel" withBorder>
        <Title order={2}>Scenario Parameters</Title>
        <SimpleGrid cols={2} spacing="sm">
          <DetailItem
            label="Target"
            value={formatPercent(trade.scenario.targetPct)}
          />
          <DetailItem
            label="Hard target"
            value={trade.scenario.targetIsHardExit ? "Yes" : "No"}
          />
          <DetailItem label="Stop" value={formatPercent(trade.scenario.stopPct)} />
          <DetailItem
            label="Trail"
            value={formatPercent(trade.scenario.trailingStopPct)}
          />
          <DetailItem
            label="Trail activation"
            value={formatPercent(trade.scenario.trailActivateAfterPct)}
          />
          <DetailItem
            label="Max bars"
            value={
              trade.scenario.maxHoldBars !== null
                ? String(trade.scenario.maxHoldBars)
                : "n/a"
            }
          />
        </SimpleGrid>
      </Paper>

      <Paper className="panel compactPanel" withBorder>
        <Title order={2}>Orders</Title>
        <ScrollArea>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Role</Table.Th>
                <Table.Th>Side</Table.Th>
                <Table.Th>Time</Table.Th>
                <Table.Th>Qty</Table.Th>
                <Table.Th>Price</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {trade.orders.map((order) => (
                <Table.Tr key={order.id}>
                  <Table.Td>{order.orderRole ?? "n/a"}</Table.Td>
                  <Table.Td>{order.side}</Table.Td>
                  <Table.Td>
                    {new Date(order.executedAt).toLocaleString()}
                  </Table.Td>
                  <Table.Td>{formatNumber(order.quantity)}</Table.Td>
                  <Table.Td>{formatDollarPrecise(order.priceExecuted)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

function DetailItem(props: { label: string; value: string }) {
  return (
    <Box className="detailItem">
      <Text size="xs" c="dimmed">
        {props.label}
      </Text>
      <Text fw={700}>{props.value}</Text>
    </Box>
  );
}

function ComparisonBadge(props: { status: ComparisonStatus }) {
  const color =
    props.status === "IMPROVED"
      ? "green"
      : props.status === "WORSE"
        ? "red"
        : props.status === "OPEN_SIMULATION"
          ? "yellow"
          : "gray";

  return <Badge color={color}>{STATUS_LABELS[props.status]}</Badge>;
}

function toSelectOptions<T extends string>(
  values: T[],
  labels?: Partial<Record<T, string>>
) {
  return [
    { label: "All", value: "ALL" },
    ...values.map((value) => ({
      label: labels?.[value] ?? value,
      value,
    })),
  ];
}

function compareTrades(
  a: ScenarioTradeSummary,
  b: ScenarioTradeSummary,
  sortKey: SortKey,
  direction: SortDirection
): number {
  const aValue = getSortValue(a, sortKey);
  const bValue = getSortValue(b, sortKey);
  const modifier = direction === "asc" ? 1 : -1;

  if (typeof aValue === "string" || typeof bValue === "string") {
    return String(aValue).localeCompare(String(bValue)) * modifier;
  }

  return (aValue - bValue) * modifier;
}

function getSortValue(trade: ScenarioTradeSummary, sortKey: SortKey) {
  switch (sortKey) {
    case "entryTs":
      return new Date(trade.entryTs).getTime();
    case "ticker":
      return trade.ticker;
    case "pnlDollar":
      return trade.pnlDollar ?? Number.NEGATIVE_INFINITY;
    case "pnlVsActualDollar":
      return trade.pnlVsActualDollar ?? Number.NEGATIVE_INFINITY;
    case "daysInTrade":
      return trade.daysInTrade ?? Number.NEGATIVE_INFINITY;
    case "comparisonStatus":
      return trade.comparisonStatus;
  }
}
