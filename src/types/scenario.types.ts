import { AssetType } from "@prisma/client";

export interface ExitScenarioInput {
  name: string;
  description?: string;
  targetPct?: number;
  targetIsHardExit?: boolean;
  stopPct?: number;
  trailingStopPct?: number;
  trailActivateAfterPct?: number;
  maxHoldBars?: number;
  assetTypeScope?: AssetType;
}

export interface ExitScenario {
  id: number;
  name: string;
  description?: string;
  targetPct?: number;
  targetIsHardExit?: boolean;
  stopPct?: number;
  trailingStopPct?: number;
  trailActivateAfterPct?: number;
  maxHoldBars?: number;
  assetTypeScope?: AssetType;
  active: boolean;
}

export interface ScenarioStats {
  totalScenarios: number;
  activeScenarios: number;
}
