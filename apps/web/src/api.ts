import {
  AssetTypeFilter,
  RunOverview,
  RunSummary,
  ScenarioExplorer,
  ScenarioSummary,
  ScenarioTradeDetail,
  ScenarioTradesResponse,
} from "./types";

export async function fetchRuns(): Promise<RunSummary[]> {
  const response = await fetch("/api/backtest-runs");
  const body = (await parseJson(response)) as { runs: RunSummary[] };
  return body.runs;
}

export async function fetchOverview(input: {
  runId: number;
  scenarioId?: number;
  assetType: AssetTypeFilter;
}): Promise<RunOverview> {
  const params = new URLSearchParams();
  params.set("assetType", input.assetType);

  if (input.scenarioId) {
    params.set("scenarioId", String(input.scenarioId));
  }

  const response = await fetch(
    `/api/backtest-runs/${input.runId}/overview?${params.toString()}`
  );
  return (await parseJson(response)) as RunOverview;
}

export async function fetchScenarios(input: {
  runId: number;
  assetType: AssetTypeFilter;
}): Promise<ScenarioSummary[]> {
  const params = new URLSearchParams();
  params.set("assetType", input.assetType);
  const response = await fetch(
    `/api/backtest-runs/${input.runId}/scenarios?${params.toString()}`
  );
  const body = (await parseJson(response)) as { scenarios: ScenarioSummary[] };
  return body.scenarios;
}

export async function fetchScenarioExplorer(input: {
  runId: number;
  scenarioId: number;
}): Promise<ScenarioExplorer> {
  const response = await fetch(
    `/api/backtest-runs/${input.runId}/scenarios/${input.scenarioId}`
  );
  return (await parseJson(response)) as ScenarioExplorer;
}

export async function fetchScenarioTrades(input: {
  runId: number;
  scenarioId: number;
}): Promise<ScenarioTradesResponse> {
  const response = await fetch(
    `/api/backtest-runs/${input.runId}/scenarios/${input.scenarioId}/trades`
  );
  return (await parseJson(response)) as ScenarioTradesResponse;
}

export async function fetchScenarioTradeDetail(input: {
  runId: number;
  scenarioId: number;
  backtestTradeId: number;
}): Promise<ScenarioTradeDetail> {
  const response = await fetch(
    `/api/backtest-runs/${input.runId}/scenarios/${input.scenarioId}/trades/${input.backtestTradeId}`
  );
  const body = (await parseJson(response)) as { trade: ScenarioTradeDetail };
  return body.trade;
}

async function parseJson(response: Response): Promise<unknown> {
  const body = await response.json();

  if (!response.ok) {
    const errorBody = body as { error?: string };
    throw new Error(errorBody.error ?? `Request failed: ${response.status}`);
  }

  return body;
}
