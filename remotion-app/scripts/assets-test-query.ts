import {queryUnifiedAssetRetriever} from "../src/lib/assets/retrieval";

const readArg = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
};

const hasFlag = (flag: string): boolean => process.argv.includes(flag);

const run = async (): Promise<void> => {
  const queryText = readArg("--query") ?? process.argv.slice(2).join(" ").trim();
  if (!queryText) {
    throw new Error("Provide a query with --query \"...\".");
  }

  const result = await queryUnifiedAssetRetriever({
    queryText,
    desiredAssetTypes: readArg("--type")?.split(",").map((value) => value.trim()).filter(Boolean) as
      | undefined
      | Array<"static_image" | "motion_graphic" | "animated_overlay" | "typography_effect" | "icon" | "background" | "accent" | "ui_card">,
    positionRole: readArg("--role") ?? undefined,
    requireAnimated: hasFlag("--animated") || undefined,
    requireStatic: hasFlag("--static") || undefined,
    limit: Number.parseInt(readArg("--limit") ?? "6", 10) || 6
  });

  console.log(`Backend: ${result.backend}`);
  console.log(`Query: ${result.query}`);
  console.log(`Candidates: ${result.totalCandidates}`);
  result.results.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.asset_id} | ${entry.asset_type} | score=${entry.score.toFixed(2)}`);
    console.log(`   labels: ${entry.labels.join(", ")}`);
    console.log(`   path: ${entry.public_path || entry.path}`);
    console.log(`   why: ${entry.why_it_matched}`);
    console.log(`   usage: ${entry.recommended_usage}`);
    console.log(`   caption: ${entry.retrieval_caption}`);
  });
  if (result.warnings.length > 0) {
    console.log(`Warnings: ${result.warnings.join(" | ")}`);
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
