import {hashString} from "../../utils";
import {
  doctrineBranchSchema,
  type DoctrineBranch,
  type EditorialDoctrine,
  type JudgmentEngineInput,
  type PreJudgmentSnapshot
} from "../types";

const isHighStakeMoment = (input: JudgmentEngineInput, snapshot: PreJudgmentSnapshot): boolean => {
  return input.moment.importance >= 0.86 ||
    ["hook", "payoff", "transition"].includes(input.moment.momentType) ||
    snapshot.recentSequenceMetrics.needsContrastNext ||
    snapshot.recentSequenceMetrics.preferRestraintNext;
};

const cloneDoctrine = (doctrine: EditorialDoctrine, overrides: Partial<EditorialDoctrine>): EditorialDoctrine => ({
  ...doctrine,
  ...overrides,
  rationale: overrides.rationale ?? doctrine.rationale
});

export class DoctrineBranchEngine {
  build(input: JudgmentEngineInput, snapshot: PreJudgmentSnapshot): DoctrineBranch[] {
    const branches: DoctrineBranch[] = [
      doctrineBranchSchema.parse({
        id: `${input.segmentId}-primary`,
        kind: "primary",
        label: "Primary Doctrine",
        priority: 1,
        editorialDoctrine: snapshot.editorialDoctrine,
        rationale: ["Primary doctrine from the deterministic judgment layer."]
      })
    ];

    if (!isHighStakeMoment(input, snapshot)) {
      return branches;
    }

    const doctrine = snapshot.editorialDoctrine;
    const canExploreRestraint = doctrine.captain !== "restraint" && snapshot.minimalismLevel !== "minimal";
    if (canExploreRestraint) {
      branches.push(doctrineBranchSchema.parse({
        id: `${input.segmentId}-restrained-${String(hashString(doctrine.captain))}`,
        kind: "alternate-captain",
        label: "Restrained Alternate",
        priority: 2,
        editorialDoctrine: cloneDoctrine(doctrine, {
          captain: "restraint",
          conceptReductionMode: "literal-caption",
          heroText: null,
          supportText: input.transcriptSegment.trim() || input.moment.transcriptText.trim() || null,
          allowTextAssetPairing: false,
          allowIndependentTypography: false,
          supportToolBudget: "none",
          preferTextOnlyForAbstractMoments: true,
          rationale: [
            "Sequence pressure or beat importance justifies a restraint-first alternate.",
            "This branch trades spectacle for contrast preservation."
          ]
        }),
        rationale: ["Bounded alternate captain branch for high-stakes or repetition-sensitive moments."]
      }));
    }

    const canExploreReduction = doctrine.conceptReductionMode === "literal-caption"
      ? snapshot.emphasisTargets.isolatePunchWord || Boolean(doctrine.heroText)
      : true;
    if (canExploreReduction) {
      const alternateReduction = doctrine.conceptReductionMode === "literal-caption"
        ? (doctrine.heroText ? "hero-phrase" : "hero-word")
        : "literal-caption";
      branches.push(doctrineBranchSchema.parse({
        id: `${input.segmentId}-reduction-${String(hashString(alternateReduction))}`,
        kind: "alternate-reduction",
        label: "Reduction Alternate",
        priority: 3,
        editorialDoctrine: cloneDoctrine(doctrine, {
          conceptReductionMode: alternateReduction,
          heroText: alternateReduction === "literal-caption"
            ? null
            : doctrine.heroText ?? snapshot.emphasisTargets.punchWord?.toUpperCase() ?? null,
          supportText: alternateReduction === "literal-caption"
            ? input.transcriptSegment.trim() || input.moment.transcriptText.trim()
            : doctrine.supportText,
          rationale: [
            alternateReduction === "literal-caption"
              ? "Restore transcript fidelity to protect clarity."
              : "Compress the line to test whether a tighter concept lands better."
          ]
        }),
        rationale: ["Bounded alternate concept-reduction branch for high-value beats."]
      }));
    }

    return branches.slice(0, 3);
  }
}
