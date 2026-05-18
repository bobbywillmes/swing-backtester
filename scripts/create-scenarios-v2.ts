import prisma from "../src/db/prisma.js";

interface ScenarioDefinition {
  name: string;
  assetType: "ETF" | "STOCK";
  targetPct?: number;
  targetIsHardExit?: boolean;
  stopPct?: number;
  trailingStopPct?: number;
  trailActivateAfterPct?: number;
  maxHoldBars?: number;
}

const scenarios: ScenarioDefinition[] = [
  // Group 1: Trail Only (no fixed target)
  {
    name: "ETF: Tight Trail 0.25%",
    assetType: "ETF",
    trailingStopPct: -0.0025,
  },
  {
    name: "ETF: Medium Trail 0.5%",
    assetType: "ETF",
    trailingStopPct: -0.005,
  },
  {
    name: "ETF: Loose Trail 0.75%",
    assetType: "ETF",
    trailingStopPct: -0.0075,
  },
  {
    name: "ETF: Very Loose Trail 1.0%",
    assetType: "ETF",
    trailingStopPct: -0.01,
  },
  {
    name: "Stock: Tight Trail 0.5%",
    assetType: "STOCK",
    trailingStopPct: -0.005,
  },
  {
    name: "Stock: Medium Trail 1.0%",
    assetType: "STOCK",
    trailingStopPct: -0.01,
  },
  {
    name: "Stock: Loose Trail 1.5%",
    assetType: "STOCK",
    trailingStopPct: -0.015,
  },
  {
    name: "Stock: Very Loose Trail 2.0%",
    assetType: "STOCK",
    trailingStopPct: -0.02,
  },

  // Group 2: Hit Target -> Trail Activates (targetIsHardExit = false)
  {
    name: "ETF: +0.5% Unlock -> Trail 0.25%",
    assetType: "ETF",
    targetPct: 0.005,
    targetIsHardExit: false,
    trailingStopPct: -0.0025,
    trailActivateAfterPct: 0.005,
  },
  {
    name: "ETF: +0.5% Unlock -> Trail 0.5%",
    assetType: "ETF",
    targetPct: 0.005,
    targetIsHardExit: false,
    trailingStopPct: -0.005,
    trailActivateAfterPct: 0.005,
  },
  {
    name: "ETF: +1.0% Unlock -> Trail 0.5%",
    assetType: "ETF",
    targetPct: 0.01,
    targetIsHardExit: false,
    trailingStopPct: -0.005,
    trailActivateAfterPct: 0.01,
  },
  {
    name: "ETF: +1.0% Unlock -> Trail 0.75%",
    assetType: "ETF",
    targetPct: 0.01,
    targetIsHardExit: false,
    trailingStopPct: -0.0075,
    trailActivateAfterPct: 0.01,
  },
  {
    name: "Stock: +1.0% Unlock -> Trail 0.5%",
    assetType: "STOCK",
    targetPct: 0.01,
    targetIsHardExit: false,
    trailingStopPct: -0.005,
    trailActivateAfterPct: 0.01,
  },
  {
    name: "Stock: +1.0% Unlock -> Trail 1.0%",
    assetType: "STOCK",
    targetPct: 0.01,
    targetIsHardExit: false,
    trailingStopPct: -0.01,
    trailActivateAfterPct: 0.01,
  },
  {
    name: "Stock: +2.0% Unlock -> Trail 1.0%",
    assetType: "STOCK",
    targetPct: 0.02,
    targetIsHardExit: false,
    trailingStopPct: -0.01,
    trailActivateAfterPct: 0.02,
  },
  {
    name: "Stock: +2.0% Unlock -> Trail 1.5%",
    assetType: "STOCK",
    targetPct: 0.02,
    targetIsHardExit: false,
    trailingStopPct: -0.015,
    trailActivateAfterPct: 0.02,
  },

  // Group 3: Fixed Target Only (baseline, hard exit)
  {
    name: "ETF: Fixed Target +0.5%",
    assetType: "ETF",
    targetPct: 0.005,
    targetIsHardExit: true,
  },
  {
    name: "ETF: Fixed Target +1.0%",
    assetType: "ETF",
    targetPct: 0.01,
    targetIsHardExit: true,
  },
  {
    name: "Stock: Fixed Target +1.0%",
    assetType: "STOCK",
    targetPct: 0.01,
    targetIsHardExit: true,
  },
  {
    name: "Stock: Fixed Target +2.0%",
    assetType: "STOCK",
    targetPct: 0.02,
    targetIsHardExit: true,
  },
];

async function main() {
  console.log("Seeding v2 exit scenarios...");

  for (const scenario of scenarios) {
    await prisma.exitScenario.upsert({
      where: { name: scenario.name },
      update: {
        targetPct: scenario.targetPct ?? null,
        targetIsHardExit: scenario.targetIsHardExit ?? true,
        stopPct: scenario.stopPct ?? null,
        trailingStopPct: scenario.trailingStopPct ?? null,
        trailActivateAfterPct: scenario.trailActivateAfterPct ?? null,
        maxHoldBars: scenario.maxHoldBars ?? null,
        assetTypeScope: scenario.assetType,
      },
      create: {
        name: scenario.name,
        targetPct: scenario.targetPct ?? null,
        targetIsHardExit: scenario.targetIsHardExit ?? true,
        stopPct: scenario.stopPct ?? null,
        trailingStopPct: scenario.trailingStopPct ?? null,
        trailActivateAfterPct: scenario.trailActivateAfterPct ?? null,
        maxHoldBars: scenario.maxHoldBars ?? null,
        assetTypeScope: scenario.assetType,
      },
    });
  }

  // Since upsert doesn't tell us update vs create, do a final count
  const finalCount = await prisma.exitScenario.count({
    where: {
      name: {
        in: scenarios.map((s) => s.name),
      },
    },
  });

  console.log(`\n✅ v2 scenarios seeded successfully`);
  console.log(`Total scenarios: ${finalCount}`);

  // Print summary by group
  console.log("\nScenario breakdown:");
  console.log("  Group 1 (Trail Only): 8 scenarios");
  console.log("  Group 2 (Target Unlocks Trail): 8 scenarios");
  console.log("  Group 3 (Fixed Target): 4 scenarios");
  console.log(`  Total: 20 scenarios`);

  // Verify asset type scoping
  const etfScenarios = await prisma.exitScenario.count({
    where: { assetTypeScope: "ETF" },
  });
  const stockScenarios = await prisma.exitScenario.count({
    where: { assetTypeScope: "STOCK" },
  });

  console.log("\nAsset type scope:");
  console.log(`  ETF-scoped: ${etfScenarios}`);
  console.log(`  Stock-scoped: ${stockScenarios}`);
}

main()
  .catch((err) => {
    console.error("Error seeding scenarios:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
