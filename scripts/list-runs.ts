import prisma from "../src/db/prisma.js";

async function main() {
  console.log("\nBacktest Runs:");
  console.log("=".repeat(80));

  const runs = await prisma.backtestRun.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      completedAt: true,
      _count: {
        select: { summaries: true },
      },
    },
  });

  if (runs.length === 0) {
    console.log("\nNo backtest runs found.\n");
    process.exit(0);
  }

  console.log("ID    Name                           Status       Scenarios    Created");
  console.log("-".repeat(80));

  for (const run of runs) {
    const id = run.id.toString().padEnd(5);
    const name = (run.name || "").substring(0, 29).padEnd(30);
    const status = run.status.padEnd(12);
    const scenarios = (run._count.summaries || 0).toString().padEnd(12);
    const created = run.createdAt.toISOString().split("T")[0];

    console.log(`${id}${name}${status}${scenarios}${created}`);

    if (run.description) {
      const desc = "  " + run.description.substring(0, 75);
      console.log(desc);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(
    `\nView results: npx tsx scripts/print-results.ts --runId <id>\n`
  );

  await prisma.$disconnect();
}

main();
