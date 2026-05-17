import prisma from "../src/db/prisma.js";
import { createExitScenario } from "../src/services/scenario.service.js";

async function main() {
  console.log("\nCreating default exit scenarios...\n");

  const scenarios = [
    {
      name: "Fixed +1% Target",
      description: "Exit when price hits +1% gain",
      targetPct: 0.01,
    },
    {
      name: "Fixed -1.5% Stop",
      description: "Hard stop at -1.5% loss",
      stopPct: -0.015,
    },
    {
      name: "Trail 0.5% (activate at +0.5%)",
      description: "Trailing stop 0.5% below high, activates after +0.5% gain",
      trailingStopPct: -0.005,
      trailActivateAfterPct: 0.005,
    },
    {
      name: "Trail 1% (activate at +1%)",
      description: "Trailing stop 1% below high, activates after +1% gain",
      trailingStopPct: -0.01,
      trailActivateAfterPct: 0.01,
    },
    {
      name: "1 Day Max Hold",
      description: "Exit after 78 bars (1 trading day)",
      maxHoldBars: 78,
    },
    {
      name: "+1% Target OR Trail 0.5%",
      description: "Target +1% or trailing stop 0.5% (activates at +0.5%)",
      targetPct: 0.01,
      trailingStopPct: -0.005,
      trailActivateAfterPct: 0.005,
    },
  ];

  try {
    for (const scenario of scenarios) {
      const created = await createExitScenario(scenario);
      console.log(`✓ ${created.name} (ID: ${created.id})`);
    }

    console.log("\n✓ Scenarios created\n");
  } catch (error) {
    console.error("\n✗ Failed to create scenarios:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    } else {
      console.error(`  ${error}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
