import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import {
  getApiBacktestRun,
  getApiRunOverview,
  getApiRunScenarios,
  listApiBacktestRuns,
} from "../services/run-overview.service.js";
import {
  getApiScenarioExplorer,
  getApiScenarioTradeDetail,
  getApiScenarioTrades,
} from "../services/scenario-explorer.service.js";
import { AssetTypeFilter } from "./types.js";

export function createApiApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get("/api/backtest-runs", asyncHandler(async (_req, res) => {
    res.json({ runs: await listApiBacktestRuns() });
  }));

  app.get("/api/backtest-runs/:runId", asyncHandler(async (req, res) => {
    res.json({ run: await getApiBacktestRun(parseIdParam(req.params.runId, "run ID")) });
  }));

  app.get(
    "/api/backtest-runs/:runId/overview",
    asyncHandler(async (req, res) => {
      res.json(
        await getApiRunOverview({
          runId: parseIdParam(req.params.runId, "run ID"),
          scenarioId:
            typeof req.query.scenarioId === "string"
              ? parseIdParam(req.query.scenarioId, "scenario ID")
              : undefined,
          assetType: parseAssetType(req.query.assetType),
        })
      );
    })
  );

  app.get(
    "/api/backtest-runs/:runId/scenarios",
    asyncHandler(async (req, res) => {
      res.json({
        scenarios: await getApiRunScenarios(
          parseIdParam(req.params.runId, "run ID"),
          parseAssetType(req.query.assetType)
        ),
      });
    })
  );

  app.get(
    "/api/backtest-runs/:runId/scenarios/:scenarioId",
    asyncHandler(async (req, res) => {
      res.json(
        await getApiScenarioExplorer({
          runId: parseIdParam(req.params.runId, "run ID"),
          scenarioId: parseIdParam(req.params.scenarioId, "scenario ID"),
        })
      );
    })
  );

  app.get(
    "/api/backtest-runs/:runId/scenarios/:scenarioId/trades",
    asyncHandler(async (req, res) => {
      res.json(
        await getApiScenarioTrades({
          runId: parseIdParam(req.params.runId, "run ID"),
          scenarioId: parseIdParam(req.params.scenarioId, "scenario ID"),
        })
      );
    })
  );

  app.get(
    "/api/backtest-runs/:runId/scenarios/:scenarioId/trades/:backtestTradeId",
    asyncHandler(async (req, res) => {
      res.json({
        trade: await getApiScenarioTradeDetail({
          runId: parseIdParam(req.params.runId, "run ID"),
          scenarioId: parseIdParam(req.params.scenarioId, "scenario ID"),
          backtestTradeId: parseIdParam(
            req.params.backtestTradeId,
            "backtest trade ID"
          ),
        }),
      });
    })
  );

  app.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.startsWith("Invalid ")
        ? 400
        : message.includes("No ")
          ? 404
          : 500;
      res.status(status).json({ error: message });
    }
  );

  return app;
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

function parseIdParam(
  value: string | string[] | undefined,
  label: string
): number {
  if (Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }

  const parsedValue = value ? parseInt(value, 10) : NaN;

  if (isNaN(parsedValue)) {
    throw new Error(`Invalid ${label}`);
  }

  return parsedValue;
}

function parseAssetType(value: unknown): AssetTypeFilter {
  if (value === "ETF" || value === "STOCK") {
    return value;
  }

  return "ALL";
}
