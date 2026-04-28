const joinLines = (parts: string[]): string => parts.join("\n");

export const PROMPT_TEMPLATE_VERSIONS = {
  metadata_synthesizer: "metadata_synthesizer_v1",
  enrichment_planner: "enrichment_planner_v1",
  central_edit_planner: "central_edit_planner_v1",
  execution_planner: "execution_planner_v1"
} as const;

export const buildMetadataSynthesizerPrompt = (input: unknown): string => {
  return joinLines([
    "You are the Metadata Synthesizer for a single video editing job.",
    "Return strict JSON only. Preserve explicit user instructions and fill missing fields with safe defaults.",
    "Never drop any required metadata groups.",
    `Input context: ${JSON.stringify(input)}`
  ]);
};

export const buildEnrichmentPlannerPrompt = (input: unknown): string => {
  return joinLines([
    "You are the Visual Enrichment Planner for a single video job.",
    "Return strict JSON only. Rank entities, assign confidence, visual relevance, fetch priority, source strategy, and fallback strategy.",
    "If a fetch is risky or low-confidence, prefer typography or internal motion assets.",
    `Input context: ${JSON.stringify(input)}`
  ]);
};

export const buildCentralEditPlannerPrompt = (input: unknown): string => {
  return joinLines([
    "You are the Central Edit Planner for a single shared job record.",
    "Return strict JSON only. Produce a complete edit plan tied to one job_id.",
    "Silence cleanup precedes typography timing. Caption-safe zones outrank motion accents.",
    `Input context: ${JSON.stringify(input)}`
  ]);
};

export const buildExecutionPlannerPrompt = (input: unknown): string => {
  return joinLines([
    "You are the Edit Execution Coordinator.",
    "Return strict JSON only. Preserve one authoritative timeline state and ordered execution steps.",
    "If an optional asset is unavailable, use the fallback strategy rather than blocking the job.",
    `Input context: ${JSON.stringify(input)}`
  ]);
};
