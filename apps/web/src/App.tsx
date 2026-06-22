import { useEffect, useMemo, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import {
  Alert,
  Badge,
  Box,
  Group,
  Loader,
  NativeSelect,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchOverview, fetchRuns, fetchScenarios } from "./api";
import {
  AssetTypeFilter,
  RunOverview,
  RunSummary,
  ScenarioSummary,
} from "./types";
import {
  formatDollar,
  formatDollarPrecise,
  formatNumber,
  formatPercent,
} from "./format";
import { ScenarioExplorerPage } from "./ScenarioExplorerPage";

const ASSET_OPTIONS: { label: string; value: AssetTypeFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "ETF", value: "ETF" },
  { label: "Stock", value: "STOCK" },
];

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RunOverviewPage />} />
      <Route
        path="/runs/:runId/scenarios/:scenarioId"
        element={<ScenarioExplorerPage />}
      />
    </Routes>
  );
}

function RunOverviewPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runId, setRunId] = useState<number | null>(null);
  const [scenarioId, setScenarioId] = useState<number | null>(null);
  const [assetType, setAssetType] = useState<AssetTypeFilter>("ALL");
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [overview, setOverview] = useState<RunOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRuns()
      .then((nextRuns) => {
        setRuns(nextRuns);
        setRunId(nextRuns[0]?.id ?? null);
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error ? requestError.message : String(requestError)
        );
      });
  }, []);

  useEffect(() => {
    if (!runId) {
      return;
    }

    setScenarioId(null);
    fetchScenarios({ runId, assetType })
      .then((nextScenarios) => {
        setScenarios(nextScenarios);
        setScenarioId(nextScenarios[0]?.scenarioId ?? null);
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error ? requestError.message : String(requestError)
        );
      });
  }, [assetType, runId]);

  useEffect(() => {
    if (!runId) {
      return;
    }

    setLoading(true);
    setError(null);
    fetchOverview({
      runId,
      scenarioId: scenarioId ?? undefined,
      assetType,
    })
      .then(setOverview)
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error ? requestError.message : String(requestError)
        );
      })
      .finally(() => setLoading(false));
  }, [assetType, runId, scenarioId]);

  const narrative = useMemo(() => {
    if (!overview) {
      return "";
    }

    const metrics = overview.selectedScenario.metrics;
    return `${overview.selectedScenario.scenarioName} increased realized ${overview.assetTypeFilter.toLowerCase()} profit by ${formatPercent(
      metrics.realizedUpliftPct
    )}. It beat the actual exit on ${formatPercent(
      metrics.improvementRate
    )} of comparable trades, while ${formatPercent(
      metrics.topTenContributionPct
    )} of incremental profit came from the ten largest contributors.`;
  }, [overview]);

  return (
    <Box className="appShell">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" gap="md">
          <Box>
            <Text className="eyebrow">Swing Backtester</Text>
            <Title order={1}>Run Overview</Title>
          </Box>
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

        <Paper className="controlBand" withBorder>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <NativeSelect
              label="Run"
              value={runId ? String(runId) : ""}
              onChange={(event) => setRunId(Number(event.currentTarget.value))}
              data={runs.map((run) => ({
                label: `Run ${run.id} - ${run.name}`,
                value: String(run.id),
              }))}
            />
            <NativeSelect
              label="Scenario"
              value={scenarioId ? String(scenarioId) : ""}
              onChange={(event) =>
                setScenarioId(Number(event.currentTarget.value))
              }
              data={scenarios.map((scenario) => ({
                label: scenario.scenarioName,
                value: String(scenario.scenarioId),
              }))}
            />
            <Box>
              <Text className="inputLabel">Asset type</Text>
              <SegmentedControl
                fullWidth
                value={assetType}
                onChange={(value) => setAssetType(value as AssetTypeFilter)}
                data={ASSET_OPTIONS}
              />
            </Box>
          </SimpleGrid>
        </Paper>

        {loading || !overview ? (
          <Group className="loadingState" justify="center">
            <Loader />
          </Group>
        ) : (
          <>
            <Group justify="space-between" className="runMeta">
              <Group gap="xs">
                {overview.integrity.ok ? (
                  <Badge color="green" leftSection={<CheckCircle2 size={13} />}>
                    Integrity passed
                  </Badge>
                ) : (
                  <Badge color="red" leftSection={<AlertTriangle size={13} />}>
                    Integrity conflicts
                  </Badge>
                )}
                <Badge variant="light">{overview.run.status}</Badge>
                <Badge variant="light">
                  {formatNumber(overview.run.simulatedTradeCount)} simulations
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {new Date(overview.run.createdAt).toLocaleString()}
              </Text>
            </Group>

            <Text className="narrative">{narrative}</Text>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <MetricCard
                label="Incremental realized profit"
                value={formatDollar(
                  overview.selectedScenario.metrics.incrementalRealizedPnlDollar
                )}
                tone="green"
              />
              <MetricCard
                label="Realized uplift"
                value={formatPercent(
                  overview.selectedScenario.metrics.realizedUpliftPct
                )}
                tone="blue"
              />
              <MetricCard
                label="Comparable / open"
                value={`${formatNumber(
                  overview.selectedScenario.metrics.comparableTrades
                )} / ${formatNumber(
                  overview.selectedScenario.metrics.openSimulations
                )}`}
                tone="amber"
              />
              <MetricCard
                label="Improved / worse"
                value={`${formatNumber(
                  overview.selectedScenario.metrics.improvedTrades
                )} / ${formatNumber(
                  overview.selectedScenario.metrics.worseTrades
                )}`}
                tone="rose"
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              <ChartPanel title="Actual vs Scenario Cumulative Profit">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={overview.cumulativeProfit}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="entryTs"
                      tickFormatter={(value: string) =>
                        new Date(value).toLocaleDateString()
                      }
                      minTickGap={36}
                    />
                    <YAxis tickFormatter={(value: number) => formatDollar(value)} />
                    <RechartsTooltip
                      formatter={(value: number) => formatDollarPrecise(value)}
                      labelFormatter={(value) =>
                        new Date(String(value)).toLocaleString()
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="actualCumulativePnlDollar"
                      name="Actual"
                      stroke="#64748b"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="scenarioCumulativePnlDollar"
                      name="Scenario"
                      stroke="#0f766e"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="incrementalCumulativePnlDollar"
                      name="Incremental"
                      stroke="#b45309"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Largest Trade Contributors">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={getTradeContributorData(overview)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="orderId"
                      tickFormatter={(value: string | null) => value ?? "n/a"}
                    />
                    <YAxis tickFormatter={(value: number) => formatDollar(value)} />
                    <RechartsTooltip
                      formatter={(value: number) => formatDollarPrecise(value)}
                      labelFormatter={(_, payload) => {
                        const item = payload?.[0]?.payload as
                          | { ticker?: string; orderId?: string | null }
                          | undefined;
                        return `${item?.ticker ?? ""} ${item?.orderId ?? ""}`.trim();
                      }}
                    />
                    <Bar dataKey="incrementalPnlDollar" name="Incremental">
                      {getTradeContributorData(overview).map((item) => (
                        <Cell
                          key={`${item.actualTradeId}-${item.incrementalPnlDollar}`}
                          fill={
                            item.incrementalPnlDollar >= 0
                              ? "#0f766e"
                              : "#be123c"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              <ChartPanel title="Contribution by Ticker">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={overview.tickerContributions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ticker" />
                    <YAxis tickFormatter={(value: number) => formatDollar(value)} />
                    <RechartsTooltip
                      formatter={(value: number) => formatDollarPrecise(value)}
                    />
                    <Bar dataKey="incrementalRealizedPnlDollar" name="Incremental">
                      {overview.tickerContributions.map((item) => (
                        <Cell
                          key={item.ticker}
                          fill={
                            item.incrementalRealizedPnlDollar >= 0
                              ? "#0f766e"
                              : "#be123c"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </SimpleGrid>

            <ChartPanel title="Scenario Comparison">
              <ScrollArea>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Scenario</Table.Th>
                      <Table.Th>Scope</Table.Th>
                      <Table.Th>Comparable</Table.Th>
                      <Table.Th>Improved</Table.Th>
                      <Table.Th>Uplift</Table.Th>
                      <Table.Th>Incremental</Table.Th>
                      <Table.Th>Top 10</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {overview.scenarios.map((scenario) => (
                      <Table.Tr
                        key={scenario.scenarioId}
                        className="clickableRow"
                        onClick={() =>
                          navigate(
                            `/runs/${overview.run.id}/scenarios/${scenario.scenarioId}`
                          )
                        }
                      >
                        <Table.Td>{scenario.scenarioName}</Table.Td>
                        <Table.Td>{scenario.assetTypeScope}</Table.Td>
                        <Table.Td>
                          {formatNumber(scenario.metrics.comparableTrades)}
                        </Table.Td>
                        <Table.Td>
                          {formatNumber(scenario.metrics.improvedTrades)}
                        </Table.Td>
                        <Table.Td>
                          {formatPercent(scenario.metrics.realizedUpliftPct)}
                        </Table.Td>
                        <Table.Td>
                          {formatDollar(
                            scenario.metrics.incrementalRealizedPnlDollar
                          )}
                        </Table.Td>
                        <Table.Td>
                          {formatPercent(scenario.metrics.topTenContributionPct)}
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

function getTradeContributorData(overview: RunOverview) {
  return [
    ...overview.selectedScenario.metrics.largestPositiveContributors.slice(0, 5),
    ...overview.selectedScenario.metrics.largestNegativeContributors.slice(0, 5),
  ];
}
