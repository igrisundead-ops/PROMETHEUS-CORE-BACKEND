import {runFontIntelligenceCommand} from "./font-intelligence-cli";

runFontIntelligenceCommand("ingest-fonts", process.argv.slice(2)).catch((error) => {
  console.error(`[font-intelligence] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
