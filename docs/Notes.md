# Notes

Use this file after approved implementations that follow the UNIVERSE HAND flow.

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
