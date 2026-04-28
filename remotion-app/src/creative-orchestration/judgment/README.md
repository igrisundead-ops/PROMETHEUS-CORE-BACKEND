# Judgment Engine

PROMETHEUS now runs a deterministic-first judgment layer above the existing creative agents.

## What It Does

The judgment engine converts a raw editing moment into a structured `EditDecisionPlan` before the specialist agents are allowed to govern execution.

The flow is:

1. classify rhetorical purpose
2. classify emotional spine
3. rank visual priorities
4. load sequence memory from the recent beat window
5. detect punch-word emphasis and minimalism level
6. compute frame constraints and matte legality
7. decide whether retrieval is needed and which libraries are allowed
8. generate candidate treatment families
9. run negative grammar validation
10. score legal candidates, including sequence contrast and repetition costs
11. run the pairwise taste critic on the top candidates
12. hand the approved plan to the existing agents through the orchestrator adapter

## Key Files

- `types.ts`: zod schemas and TypeScript contracts for `EditDecisionPlan`, asset fingerprints, traces, directives, and feedback signals
- `rules/`: deterministic editorial rules for purpose, emotion, emphasis, spatial constraints, retrieval, negative grammar, and scoring
- `rules/sequence-memory.ts`: converts recent decision plans into treatment fingerprints, contrast records, escalation history, and rolling sequence metrics
- `rules/sequence-negative-grammar.ts`: sequence-level constraint rules for repeated loud beats, repeated behind-subject text, repeated motion/typography signatures, and climax overspend
- `rules/sequence-scoring.ts`: sequence-aware scoring dimensions such as contrast, surprise preservation, restraint balance, emotional progression, and climax budget
- `rules/pairwise-taste-critic.ts`: direct candidate-vs-candidate editorial comparison across premium feel, readability, restraint, sequence fit, cliché avoidance, and human-made feel
- `engines/pairwise-taste-critic-engine.ts`: critic tournament layer that re-ranks the top scored candidates before final selection
- `engines/core-judgment-engine.ts`: main orchestration engine
- `adapters/existing-agent-orchestrator-adapter.ts`: bridges the new judgment layer with the existing text/asset/motion/layout/matting/sound agents

## Integration

`buildCreativeOrchestrationPlan()` now does a pre-judgment pass first, stores per-moment directives in `context.judgmentDirectives`, lets the existing agents propose inside that envelope, and then resolves final governed tracks with the adapter.

The adapter also maintains a rolling sequence memory window, so later moments can see:

- recently selected treatment families
- repeated typography / motion / placement patterns
- recent treatment fingerprints and premium tricks
- recent contrast-direction changes
- recent escalation stages and climax usage
- surprise budget remaining
- whether the sequence needs contrast or restraint next

## Pairwise Critic

The pairwise critic sits above scalar scoring.

Scoring still gives each candidate a deterministic weighted score.
The critic then asks a different question: if two strong candidates are both legal, which one would a better editor actually choose here?

That layer compares the top candidates directly on:

- premium feel
- cinematic intentionality
- readability
- emotional alignment
- rhetorical clarity
- restraint
- novelty without chaos
- sequence fit
- non-cliche execution
- human-made feel
- creator style fit
- render practicality

It stores:

- pairwise comparison results
- critic rationale
- taste risk flags

inside both the `EditDecisionPlan` and the audit record.

## Example

```ts
import {CoreJudgmentEngine} from "./engines/core-judgment-engine";

const engine = new CoreJudgmentEngine();

const plan = engine.plan({
  segmentId: "moment-0001",
  moment: {
    id: "moment-0001",
    startMs: 0,
    endMs: 1800,
    transcriptText: "This changes everything",
    words: [
      {text: "This", startMs: 0, endMs: 180},
      {text: "changes", startMs: 200, endMs: 420},
      {text: "everything", startMs: 440, endMs: 780}
    ],
    momentType: "hook",
    energy: 0.92,
    importance: 0.97,
    density: 2.1,
    suggestedIntensity: "hero"
  },
  transcriptSegment: "This changes everything",
  sceneAnalysis: {
    sceneDensity: 0.42,
    motionDensity: 0.36,
    backgroundComplexity: 0.28,
    brightness: 0.46,
    negativeSpaceScore: 0.68,
    occlusionRisk: 0.18,
    mobileReadabilityRisk: 0.14,
    activeFocalElements: 1,
    safeZones: ["center", "top-safe", "bottom-safe"],
    busyRegions: []
  },
  subjectSegmentation: {
    matteConfidence: 0.82,
    subjectRegion: "center",
    behindSubjectTextSupported: true
  },
  agentProposals: []
});

console.log(plan.selectedTreatment.family);
console.log(plan.scoringBreakdown.finalScore);
console.log(plan.trace);
```

## ML Hooks

The deterministic layer leaves explicit upgrade points for future models:

- semantic emphasis detection
- style similarity
- retrieval ranking
- novelty estimation
- preference learning

Those hooks should refine or re-rank the existing structured artifacts, not replace the rule skeleton.

The future upgrade path for taste models is:

1. keep deterministic scoring and negative grammar as the safety skeleton
2. replace or augment `pairwise-taste-critic.ts` with an ML or LLM pairwise ranker
3. keep the critic output structured so audit, tests, and agent governance still work

## Sequence Walkthrough

Example 5-beat sequence under the current deterministic sequence layer:

1. Beat 1 is a loud hook, so the engine may choose `expressive-premium`; sequence memory records `keyword-only`, `blur-slide-up`, `center-stage`, `balanced/loud`, and a hero-like contrast jump.
2. Beat 2 is another loud hook; the system can still escalate, but sequence memory now shows repeated expressive typography, repeated premium tricks, and reduced surprise budget.
3. Beat 3 tries to use behind-subject text again; sequence-negative-grammar can block that if Beat 2 already spent a hero matte, and anti-repetition pushes the plan toward a different placement or matte mode.
4. Beat 4 is an explanation beat after that loud run; `preferRestraintNext`, `needsContrastNext`, and low surprise budget bias the scorer toward `safe-premium` or `luxury-minimal`, and the adapter can stop requesting motion or matting up front.
5. Beat 5 is a true payoff; climax budget and escalation stage allow a controlled return to expression, but the engine still penalizes reusing the same typography signature, motion signature, or hero background-text trick from earlier beats.
