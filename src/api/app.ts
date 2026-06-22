import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import {
  getApiBacktestRun,
  getApiRunOverview,
  getApiRunScenarios,
  listApiBacktestRuns,
} from "../services/run-overview.service.js";
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
    res.json({ run: await getApiBacktestRun(parseRunIdParam(req.params.runId)) });
  }));

  app.get(
    "/api/backtest-runs/:runId/overview",
    asyncHandler(async (req, res) => {
      res.json(
        await getApiRunOverview({
          runId: parseRunIdParam(req.params.runId),
          scenarioId:
            typeof req.query.scenarioId === "string"
              ? parseRunIdParam(req.query.scenarioId)
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
          parseRunIdParam(req.params.runId),
          parseAssetType(req.query.assetType)
        ),
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
      const status = message.includes("No ") ? 404 : 500;
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

function parseRunIdParam(value: string | string[] | undefined): number {
  if (Array.isArray(value)) {
    throw new Error("Invalid run ID");
  }

  const runId = value ? parseInt(value, 10) : NaN;

  if (isNaN(runId)) {
    throw new Error("Invalid run ID");
  }

  return runId;
}

function parseAssetType(value: unknown): AssetTypeFilter {
  if (value === "ETF" || value === "STOCK") {
    return value;
  }

  return "ALL";
}
