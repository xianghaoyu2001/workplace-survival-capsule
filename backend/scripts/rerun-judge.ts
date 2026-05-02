/**
 * Re-run Judge agent on an existing session to verify the JSON repair fix.
 * Usage: npx tsx scripts/rerun-judge.ts <session_id> [--save]
 */
import "dotenv/config";
import { callJudgeAgent } from "../src/agents/judge.agent";
import { prisma } from "../src/db/prisma";
import { parseJsonField, stringifyJson } from "../src/utils/jsonField";

const scriptIndex = process.argv.findIndex((arg) => arg.replace(/\\/g, "/").endsWith("scripts/rerun-judge.ts"));
const userArgs = process.argv.slice(scriptIndex >= 0 ? scriptIndex + 1 : 2);
const SESSION_ID = userArgs.find((arg) => !arg.startsWith("--"));
const updateFlag = process.argv.includes("--save");

async function main() {
  if (!SESSION_ID) {
    console.error("Usage: npx tsx scripts/rerun-judge.ts <session_id> [--save]");
    process.exit(1);
  }

  const session = await prisma.assessmentSession.findUnique({
    where: { id: SESSION_ID },
    include: { messages: { orderBy: { createdAt: "asc" } }, scenario: true }
  });

  if (!session) {
    console.error("Session not found:", SESSION_ID);
    process.exit(1);
  }

  console.log("=== Session Info ===");
  console.log(`  Scenario: ${session.scenario.title}`);
  console.log(`  Status:   ${session.status}`);
  console.log(`  Rounds:   ${session.round}`);
  console.log(`  Messages: ${session.messages.length}`);
  console.log(`  Old score: ${session.reportJson ? parseJsonField<{ total_score?: number }>(session.reportJson, {}).total_score ?? "N/A" : "N/A"} pts`);
  console.log("");

  const blackboard = parseJsonField<Record<string, unknown>>(session.blackboardState, {});
  const maxScore = Array.isArray((blackboard.scenario_facts as { capability_dimensions?: unknown[] } | undefined)?.capability_dimensions)
    ? ((blackboard.scenario_facts as { capability_dimensions: unknown[] }).capability_dimensions.length * 20)
    : 100;

  // Build chat history the same way the orchestrator does
  const historyLines = session.messages
    .filter((m) => m.content && m.content.trim())
    .map((m) => {
      const sender = m.senderType === "user" ? "用户" : `${m.senderName} (${m.senderRole})`;
      return `[Round ${m.roundIndex}] ${sender}: ${m.content}`;
    });
  const fullHistory = historyLines.join("\n\n");

  console.log("=== History (last 500 chars) ===");
  console.log(fullHistory.slice(-500));
  console.log("");

  console.log("=== Calling Judge (3× sampling) ===");
  const startedAt = Date.now();

  try {
    const { report, samplingStats } = await callJudgeAgent({
      blackboard,
      chatHistory: fullHistory,
      groupSummary: blackboard.group_discussion_summary
    });

    const duration = Date.now() - startedAt;

    console.log(`\nJudge completed in ${(duration / 1000).toFixed(1)}s`);
    console.log(`   Total score: ${report.total_score} / ${maxScore}`);
    console.log(`   Level:       ${report.level}`);
    console.log(`   Sampling:    scores=[${samplingStats.scores.join(", ")}], variance=${samplingStats.variance.toFixed(2)}`);
    console.log(`   Dimensions:`);
    for (const [k, v] of Object.entries(report.dimension_scores)) {
      console.log(`     ${k}: ${v}/20`);
    }
    console.log(`   Strengths:   ${report.strengths.length} items`);
    console.log(`   Risks:       ${report.risks.length} items`);
    console.log(`   Evidence:    ${report.evidence.length} items`);

    if (updateFlag) {
      await prisma.assessmentSession.update({
        where: { id: SESSION_ID },
        data: {
          reportJson: stringifyJson({
            ...report,
            sampling_stats: samplingStats
          }),
          totalScore: report.total_score
        }
      });
      console.log("\nUpdated session report in DB.");
    } else {
      console.log("\nRun with --save to persist this report to DB.");
    }
  } catch (err) {
    console.error("\nJudge failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
