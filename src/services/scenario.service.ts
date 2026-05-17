import prisma from "../db/prisma.js";
import { ExitScenarioInput } from "../types/scenario.types.js";

export async function createExitScenario(
  input: ExitScenarioInput
): Promise<{ id: number; name: string }> {
  return prisma.exitScenario.create({
    data: {
      name: input.name,
      description: input.description,
      targetPct: input.targetPct ?? null,
      stopPct: input.stopPct ?? null,
      trailingStopPct: input.trailingStopPct ?? null,
      trailActivateAfterPct: input.trailActivateAfterPct ?? null,
      maxHoldBars: input.maxHoldBars ?? null,
      assetTypeScope: input.assetTypeScope ?? null,
    },
    select: { id: true, name: true },
  });
}

export async function getActiveScenarios(): Promise<
  {
    id: number;
    name: string;
  }[]
> {
  return prisma.exitScenario.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAllScenarios(): Promise<
  {
    id: number;
    name: string;
    active: boolean;
  }[]
> {
  return prisma.exitScenario.findMany({
    select: { id: true, name: true, active: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function deactivateScenario(scenarioId: number): Promise<void> {
  await prisma.exitScenario.update({
    where: { id: scenarioId },
    data: { active: false },
  });
}
