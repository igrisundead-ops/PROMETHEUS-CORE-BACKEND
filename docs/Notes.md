# Notes

Use this file after approved implementations that follow the UNIVERSE HAND flow.

## 2026-04-30 - Stepping-Stone Planner Phase 1

Date:
2026-04-30

Feature:
Stepping-stone planner scaffolding above the judgment layer with planner audit, bounded doctrine branches, treatment genomes, QD archive elites, and beam-search shortlist integration.

Idea:
Ship the first proper planner phase without replacing the current deterministic judgment seam. Let the planner explore bounded doctrine variants and treatment genomes, then hand a shortlist back to the existing judgment, critic, retrieval, and governance path.

Mini PRD:
Add a planner subtree under `remotion-app/src/creative-orchestration/judgment` that builds an Observation Snapshot, Planning Snapshot, bounded doctrine branches, Treatment Genome v1 candidates, a small QD archive, and a beam-ranked shortlist. Thread the resulting planner audit through `CoreJudgmentEngine` and keep a deterministic fallback if planner shortlist generation ever comes back empty.

Grill findings:
- The live source of truth is the `remotion-app/src/creative-orchestration/judgment` seam, not the older root orchestration tree.
- The current repo already has a strong deterministic evaluator, so the safest first move was to add a planner above it rather than rewrite it.
- A zero-candidate edge case existed if every treatment family got filtered away, so the deterministic candidate engine needed a safe floor.

Architecture decision:
Keep evaluator/governor modules in the existing `judgment/engines` seam and introduce a new `judgment/planning` subtree for planner concerns. `CoreJudgmentEngine` now calls the stepping-stone planner to get a traced shortlist and planner audit before the usual scoring, pairwise critic, retrieval, and governance flow continues.

Files changed:
- `CONTEXT.md`
- `docs/Notes.md`
- `remotion-app/src/creative-orchestration/judgment/types.ts`
- `remotion-app/src/creative-orchestration/judgment/index.ts`
- `remotion-app/src/creative-orchestration/judgment/engines/core-judgment-engine.ts`
- `remotion-app/src/creative-orchestration/judgment/engines/candidate-treatment-engine.ts`
- `remotion-app/src/creative-orchestration/judgment/planning/observation-snapshot-engine.ts`
- `remotion-app/src/creative-orchestration/judgment/planning/planning-snapshot-engine.ts`
- `remotion-app/src/creative-orchestration/judgment/planning/doctrine-branch-engine.ts`
- `remotion-app/src/creative-orchestration/judgment/planning/treatment-genome.ts`
- `remotion-app/src/creative-orchestration/judgment/planning/qd-archive.ts`
- `remotion-app/src/creative-orchestration/judgment/planning/beam-search-engine.ts`
- `remotion-app/src/creative-orchestration/judgment/planning/stepping-stone-planner.ts`
- `remotion-app/src/creative-orchestration/judgment/__tests__/stepping-stone-planner.test.ts`

Dependencies:
None added.

Verification:
Ran `npm.cmd run typecheck` in `remotion-app` and ran targeted Vitest coverage for `judgment-engine.test.ts` and `stepping-stone-planner.test.ts`.

Refactor notes:
This is intentionally a phase-1 planner. It adds bounded doctrine search, planner-native genome fields, archive scaffolding, and beam-search ranking, but it does not yet implement true multi-beat AB-MCTS.

Open risks or follow-ups:
- Beam search still scores a one-step shortlist under a sequence-aware objective; deeper multi-beat search remains phase two.
- The new planner audit is present in the judgment plan and audit artifacts, but the preview-side review surface for explicit human labels still needs implementation.
- Backend pattern memory, creator taste memory, and GOD feedback are still separate systems and have not yet been unified into a broader learning loop.

## 2026-04-28 - Preview Render Alignment Phase 1

Date:
2026-04-28

Feature:
Preview/render alignment, safer Git trust handling, and first-pass long-form house-style tightening.

Idea:
Keep Hyperframes as the fast live lane, keep Remotion as the cinematic export lane, and make sure both lanes honor the same long-form editorial house style instead of silently drifting back to the legacy SVG path.

Mini PRD:
Phase 1 aligns the backend caption-profile contract with the frontend long-form defaults, keeps EVE as the main house style, tunes preview-side treatment routing to prefer EVE and Docked Inverse over legacy SVG spam, and clarifies UI copy around Hyperframes vs Remotion responsibilities.

Grill findings:
- The Git warning came from nested `.git` directories owned by a different Windows account, not from the whole workspace root.
- The local preview runner only accepted SVG, Docked Inverse, and Semantic Sidecall, so final render requests could quietly coerce EVE back to SVG.
- The creative preview treatment map still leaned on legacy SVG in places that should now be driven by the EVE house style or a calmer docked treatment.

Architecture decision:
Add a small backend editorial contract for supported long-form preview/render caption profiles. Keep the existing caption editorial engine and creative orchestration path, but make EVE the real primary long-form style while preserving Legacy SVG as a comparison/fallback lane.

Files changed:
- `backend/src/editorial-contract.ts`
- `backend/src/local-preview-runner.ts`
- `backend/src/__tests__/editorial-contract.test.ts`
- `remotion-app/src/creative-orchestration/preview.ts`
- `remotion-app/src/creative-orchestration/__tests__/preview-house-style.test.ts`
- `remotion-app/src/web-preview/PreviewApp.tsx`
- `remotion-app/vitest.config.ts`

Dependencies:
None added.

Verification:
Ran targeted backend and remotion-app tests for the new editorial contract and preview house-style routing, then verified the two nested Git repos are trusted by Git without the dubious ownership warning.

Continuation verification:
The first rerun exposed that the Remotion house-style test folder was outside Vitest's include patterns. Added the include, then fixed preview treatment routing so long explanatory openings use Docked Inverse instead of being forced into the EVE title-card lane. Remotion typecheck also exposed an invalid EVE constant import, so preview routing now imports that ID from the stylebook that owns it. Targeted backend and Remotion tests pass, and backend/remotion-app typechecks pass.

Phase 2 continuation:
Added a shared editorial doctrine to the judgment engine so each moment now decides a visual captain, a concept-reduction mode, and a support-tool budget before proposals are scored. Text and asset proposals now follow that doctrine instead of acting like independent hero layers, and UNIVERSE HAND now includes explicit resource-gap escalation rules for missing animation families, asset packs, b-roll, matte support, and generated variants.

Refactor notes:
This is a phase-1 contract and routing cleanup, not the full editorial intuition system. The existing caption editorial engine remains the main taste layer.

Open risks or follow-ups:
- Local `sourcePath` handling is still okay for a machine-local workflow but not yet safe for a future internet-facing backend.
- Preview and export still share intent more than identical execution. Full parity would need another pass.
- The broader "editor intuition" system still needs a richer confidence and anti-repetition layer across captions, motion graphics, and asset deployment.

## Entry Template

Date:

Feature:

Idea:

Mini PRD:

Grill findings:

Architecture decision:

Files changed:

Dependencies:

Verification:

Refactor notes:

Open risks or follow-ups:
