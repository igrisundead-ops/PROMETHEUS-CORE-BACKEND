import {describe, expect, it} from "vitest";

import type {CaptionChunk} from "../../lib/types";
import type {CreativeContext, CreativeMoment} from "../types";
import {TextAgent} from "../agents/text-agent";
import {ExistingAgentOrchestratorAdapter} from "../judgment";
import {CoreJudgmentEngine} from "../judgment";
import {buildJudgmentInput} from "../judgment/__tests__/test-helpers";

const makeChunk = (text: string): CaptionChunk => ({
  id: "chunk-1",
  text,
  startMs: 0,
  endMs: 1800,
  words: text.split(/\s+/).map((word, index) => ({
    text: word,
    startMs: index * 220,
    endMs: index * 220 + 180,
    confidence: 0.96
  })),
  styleKey: "style",
  motionKey: "motion",
  layoutVariant: "inline",
  emphasisWordIndices: [],
  semantic: {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  }
});

const makeMoment = (text: string, overrides: Partial<CreativeMoment> = {}): CreativeMoment => ({
  id: "moment-1",
  startMs: 0,
  endMs: 1800,
  transcriptText: text,
  words: text.split(/\s+/).map((word, index) => ({
    text: word,
    startMs: index * 220,
    endMs: index * 220 + 180,
    confidence: 0.96
  })),
  momentType: "hook",
  energy: 0.9,
  importance: 0.94,
  density: 2.2,
  suggestedIntensity: "hero",
  chunkIds: ["chunk-1"],
  ...overrides
});

const makeContext = (chunk: CaptionChunk): CreativeContext => ({
  jobId: "job-1",
  renderMode: "overlay-preview",
  chunks: [chunk],
  captionProfileId: "longform_eve_typography_v1",
  motionTier: "premium",
  availableAssets: [],
  revisionPass: 0
});

describe("editorial doctrine", () => {
  it("reduces a concrete punch concept into a hero word when behind-subject text is viable", () => {
    const engine = new CoreJudgmentEngine();
    const snapshot = engine.buildPreJudgmentSnapshot(buildJudgmentInput({
      transcriptSegment: "The intricacies of the brain",
      moment: {
        transcriptText: "The intricacies of the brain",
        momentType: "hook",
        importance: 0.96,
        energy: 0.88
      },
      subjectSegmentation: {
        matteConfidence: 0.92,
        subjectRegion: "center",
        behindSubjectTextSupported: true
      }
    }));

    expect(snapshot.editorialDoctrine.captain).toBe("text");
    expect(snapshot.editorialDoctrine.conceptReductionMode).toBe("hero-word");
    expect(snapshot.editorialDoctrine.heroText).toBe("BRAIN");
  });

  it("opens a sequential-keyword doctrine for list-like concrete noun moments", () => {
    const engine = new CoreJudgmentEngine();
    const snapshot = engine.buildPreJudgmentSnapshot(buildJudgmentInput({
      transcriptSegment: "Brain, nervous system, and trauma response",
      moment: {
        transcriptText: "Brain, nervous system, and trauma response",
        momentType: "list",
        importance: 0.9,
        energy: 0.78
      },
      subjectSegmentation: {
        matteConfidence: 0.64,
        subjectRegion: "center",
        behindSubjectTextSupported: false
      }
    }));

    expect(snapshot.editorialDoctrine.conceptReductionMode).toBe("sequential-keywords");
  });

  it("keeps typography in a support role when the directive says asset treatment is captain", async () => {
    const chunk = makeChunk("A million dollars");
    const moment = makeMoment("A million dollars", {
      momentType: "payoff",
      importance: 0.97,
      energy: 0.91
    });
    const baseContext = makeContext(chunk);
    const adapter = new ExistingAgentOrchestratorAdapter();
    const directives = await adapter.buildDirectives(baseContext, [moment]);
    const forcedDirective = {
      ...directives[moment.id]!,
      editorialDoctrine: {
        ...directives[moment.id]!.editorialDoctrine,
        captain: "asset" as const,
        allowIndependentTypography: false,
        heroText: "A MILLION DOLLARS",
        conceptReductionMode: "hero-phrase" as const
      }
    };
    const context: CreativeContext = {
      ...baseContext,
      judgmentDirectives: {
        [moment.id]: forcedDirective
      }
    };

    const proposals = await new TextAgent().propose(context, moment);

    expect(proposals.some((proposal) => proposal.payload["mode"] === "title-card")).toBe(false);
    expect(proposals.find((proposal) => proposal.payload["mode"] === "keyword-only")?.payload["visualRole"]).toBe("support");
  });
});
