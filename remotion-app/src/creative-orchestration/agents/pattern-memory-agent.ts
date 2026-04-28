import type {AgentProposal, CreativeAgent, CreativeContext, CreativeMoment, CreativePatternMemory} from "../types";
import {normalizeText} from "../utils";

const findRelevantPattern = (memory: CreativePatternMemory[] | undefined, moment: CreativeMoment): CreativePatternMemory | null => {
  if (!memory || memory.length === 0) {
    return null;
  }

  const text = normalizeText(moment.transcriptText);
  return [...memory]
    .filter((pattern) => pattern.appliesToMomentTypes.includes(moment.momentType))
    .sort((a, b) => b.usageCount - a.usageCount)
    .find((pattern) => pattern.avoidWhen.some((term) => text.includes(term)) === false) ?? null;
};

export class PatternMemoryAgent implements CreativeAgent<CreativeContext> {
  id = "pattern-memory-agent";
  label = "Pattern Memory";
  private memory: CreativePatternMemory[];

  constructor(initialMemory: CreativePatternMemory[] = []) {
    this.memory = [...initialMemory];
  }

  getMemory(): CreativePatternMemory[] {
    return [...this.memory];
  }

  recordSelection(patternName: string, momentType: CreativeMoment["momentType"], successScore: number): void {
    const existing = this.memory.find((entry) => entry.patternName === patternName);
    if (existing) {
      existing.usageCount += 1;
      existing.successScore = Math.max(existing.successScore ?? 0, successScore);
      return;
    }
    this.memory.push({
      id: `pattern-${String(this.memory.length + 1).padStart(4, "0")}`,
      patternName,
      appliesToMomentTypes: [momentType],
      preferredAnimations: [],
      preferredAssets: [],
      preferredSounds: [],
      avoidWhen: [],
      usageCount: 1,
      successScore
    });
  }

  async propose(context: CreativeContext, moment: CreativeMoment): Promise<AgentProposal[]> {
    const pattern = findRelevantPattern(context.patternMemory ?? this.memory, moment);
    if (!pattern) {
      return [];
    }

    return [
      {
        id: `proposal-memory-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "memory",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.round(pattern.usageCount * 10 + moment.importance * 20),
        confidence: Math.min(0.95, 0.58 + (pattern.successScore ?? 0) / 2),
        renderCost: "low",
        payload: {
          patternName: pattern.patternName,
          usageCount: pattern.usageCount,
          preferredAnimations: pattern.preferredAnimations,
          preferredAssets: pattern.preferredAssets,
          preferredSounds: pattern.preferredSounds,
          avoidWhen: pattern.avoidWhen,
          notes: pattern.notes
        },
        reasoning: `Pattern memory recommends ${pattern.patternName} for this ${moment.momentType} moment.`
      } satisfies AgentProposal
    ];
  }
}
