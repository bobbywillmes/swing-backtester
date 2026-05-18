import prisma from "../src/db/prisma.js";

/**
 * Find duplicate scenarios (same parameters, different names)
 * Examples:
 *   - "Stock: Fixed Target +1.0%" vs "Stock: Fixed +1% Target"
 *   - "ETF: Trail 1% (activate at +1%)" vs "ETF: Trail 1% (activate at +1%)"
 */

async function main() {
  console.log("Scanning for duplicate scenarios...\n");

  try {
    const scenarios = await prisma.exitScenario.findMany({
      where: { active: true },
    });

    console.log(`Found ${scenarios.length} active scenarios\n`);

    // Group by parameters to find duplicates
    const paramGroups = new Map<string, typeof scenarios>();

    for (const scenario of scenarios) {
      // Create a fingerprint of the scenario's parameters
      const fingerprint = JSON.stringify({
        targetPct: scenario.targetPct,
        targetIsHardExit: scenario.targetIsHardExit,
        stopPct: scenario.stopPct,
        trailingStopPct: scenario.trailingStopPct,
        trailActivateAfterPct: scenario.trailActivateAfterPct,
        maxHoldBars: scenario.maxHoldBars,
        assetTypeScope: scenario.assetTypeScope,
      });

      if (!paramGroups.has(fingerprint)) {
        paramGroups.set(fingerprint, []);
      }
      paramGroups.get(fingerprint)!.push(scenario);
    }

    // Find groups with multiple scenarios (duplicates)
    const duplicates: { params: string; scenarios: typeof scenarios }[] = [];
    for (const [params, group] of paramGroups) {
      if (group.length > 1) {
        duplicates.push({ params, scenarios: group });
      }
    }

    if (duplicates.length === 0) {
      console.log("✅ No duplicates found!");
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} duplicate groups:\n`);

    for (const dup of duplicates) {
      const params = JSON.parse(dup.params);
      console.log(`Parameters: ${JSON.stringify(params, null, 2)}`);
      console.log(`Scenarios with these params:`);
      dup.scenarios.forEach((s, idx) => {
        console.log(
          `  ${idx + 1}. ID ${s.id}: "${s.name}"`
        );
      });
      console.log();
    }

    console.log(
      `\n📋 Recommendation: Delete the v1-migrated versions, keep v2 style names`
    );
    console.log(
      `   (e.g., keep "Stock: Fixed Target +1.0%", delete "Stock: Fixed +1% Target")`
    );
  } catch (error) {
    console.error("Scan failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
