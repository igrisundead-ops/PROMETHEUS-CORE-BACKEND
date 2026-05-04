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

## 2026-05-02 - Typography Doctrine Phase 1

Date:
2026-05-02

Feature:
Role-centric typography doctrine and hand-authored font compatibility graph seed for the cinematic typography system.

Idea:
Stop treating typography as a loose collection of pretty fonts. Build a constrained doctrine first so future beam search and QD exploration operate inside a premium taste space instead of improvising style.

Mini PRD:
Add a Phase 1 typography doctrine in `remotion-app/src/lib/cinematic-typography` that defines explicit role slots, benchmark candidates, and compatibility edges. The doctrine must treat `Jugendreisen` as the primary hero-serif benchmark, `DM Sans` as the singular neutral-sans core, and demote display-sans usage into a bounded pressure-release role.

Grill findings:
- The current repo already had a motion/selector layer and a newer editorial palette layer, but no explicit role-centric typography doctrine
- The audit showed that the biggest problem was governance, not category absence.
- The system needed rhetorical assignment discipline before pairwise font matching or algorithmic exploration.

Architecture decision:
Introduce `typography-doctrine.ts` and `font-compatibility-graph.ts` as Phase 1 hand-authored taste artifacts. Thread doctrine-role hints into `editorial-fonts.ts` so the active palette layer can already speak the same role language that future graph search will use.

Files changed:
- `docs/Notes.md`
- `remotion-app/src/lib/cinematic-typography/typography-doctrine.ts`
- `remotion-app/src/lib/cinematic-typography/font-compatibility-graph.ts`
- `remotion-app/src/lib/cinematic-typography/editorial-fonts.ts`

Dependencies:
None added.

Verification:
No compiler run was available in this workspace, but the new doctrine files are data-first TypeScript modules with no external runtime dependencies. The typography audit command continues to run after the change.

Refactor notes:
This is intentionally Phase 1. The compatibility graph is hand-authored and role-centric. It is not yet driving beam search or QD exploration directly.

Open risks or follow-ups:
- External benchmark/reference fonts like `Jugendreisen`, `Louize`, `Ivar Script`, and `BS Acapulko` are now represented as doctrine candidates, but not yet integrated as runtime-loaded house fonts.
- The editorial selector still chooses among existing palettes heuristically; a later pass should make it graph-aware.
- Phase 2 should rank `template + font pair + placement + motion + intensity` over this doctrine rather than over raw font lists.

## 2026-05-02 - Typography Doctrine Lock-In Pass

Date:
2026-05-02

Feature:
Fast consolidation pass to remove remaining role ambiguity from the new typography doctrine.

Idea:
Stop spending turns re-litigating obvious lane assignments. Lock the current best judgment into the doctrine so implementation can move into graph-aware search and runtime routing.

Mini PRD:
Constrain benchmark and challenger fonts to a single primary rhetorical lane whenever possible. `Jugendreisen` owns hero primary, `Louize` owns hero alternate, `Fraunces` owns editorial support, `Crimson Pro` becomes the documentary understudy, `Instrument Serif` becomes soft luxury support only, and `DM Sans` stays neutral-core only.

Grill findings:
- Too many fonts were still technically eligible for multiple lanes, which would recreate drift later even with a doctrine file present.
- `Instrument Serif` was incorrectly acting like both a hero-alternate and a script-adjacent face in palette metadata.
- `DM Sans` was accidentally tagged as if it belonged to the display-sans pressure-release lane.

Architecture decision:
Prefer one dominant lane per premium font unless there is a very strong reason to cross-list it. Keep overlap rare and explicit. Treat emotional/support nuance as a support-lane concern, not an excuse to reopen hero-tier ambiguity.

Files changed:
- `docs/Notes.md`
- `remotion-app/src/lib/cinematic-typography/typography-doctrine.ts`
- `remotion-app/src/lib/cinematic-typography/font-compatibility-graph.ts`
- `remotion-app/src/lib/cinematic-typography/editorial-fonts.ts`

Dependencies:
None added.

Verification:
Typography audit rerun succeeds after the lock-in pass.

Refactor notes:
This pass intentionally favors doctrinal clarity over maximum optionality. A later graph-search phase can still explore combinations, but only inside these narrower role boundaries.

Open risks or follow-ups:
- `Sokoli` is still only a doctrine candidate and not yet a runtime-loaded pressure-release house font.
- Legacy preset files still contain older font stacks and should be normalized later if they remain active.
- Phase 2 should read role-constrained graph data directly instead of relying on mood-only palette heuristics.

## 2026-05-02 - Typography Selector Phase 2 Runtime Wiring

Date:
2026-05-02

Feature:
Graph-aware runtime font selection shared by the caption editorial engine and cinematic caption planner.

Idea:
Move past hand-written mood switches for runtime font choice. The system should choose runtime palettes from the doctrine using rhetorical role, graph-ranked candidates, intensity, and motion demand.

Mini PRD:
Add a shared runtime font selector that maps `TypographySelection` output into doctrine role slots, resolves graph-ranked runtime candidates, and returns a canonical font palette choice plus rationale. Use that selector inside `caption-editorial-engine.ts` and `cinematic-typography/selector.ts` so overlays and planner output stop diverging.

Grill findings:
- Motion/pattern selection was already nuanced, but font choice in the caption engine was still mostly a handwritten mood switch.
- The cinematic planner had a deeper treatment selector, but it defaulted to each treatment's baked font profile instead of a doctrine-aware runtime font decision.
- Without a shared selector, typography doctrine could stay conceptually correct while runtime choices silently drifted.

Architecture decision:
Introduce `runtime-font-selector.ts` as the canonical font selection layer. It resolves a requested doctrine role, falls back when a runtime house face does not yet exist for that role, and returns the chosen candidate/palette with rationale. The caption engine now emits this selection, and the cinematic planner uses it as the baseline when assembling caption plans.

Files changed:
- `docs/Notes.md`
- `remotion-app/src/lib/cinematic-typography/runtime-font-selector.ts`
- `remotion-app/src/lib/motion-platform/caption-editorial-engine.ts`
- `remotion-app/src/lib/cinematic-typography/selector.ts`
- `remotion-app/src/lib/__tests__/caption-editorial-engine.test.ts`
- `remotion-app/src/lib/__tests__/runtime-font-selector.test.ts`

Dependencies:
None added.

Verification:
`npm run typography:audit` succeeds after the runtime-selector integration.

Refactor notes:
This is the first real Phase 2 bridge. Treatment search still exists, but font choice is no longer a separate mood-only heuristic. Runtime still falls back out of `display_sans_pressure_release` and `hero_serif_primary` because those benchmark faces are not yet loaded as house fonts.

Open risks or follow-ups:
- Local test execution is blocked in this workspace because `vitest` is not installed and `@remotion/google-fonts` is currently unavailable to `tsx` runtime imports.
- `Louize`, `Jugendreisen`, `Ivar Script`, and `Sokoli` still need actual runtime font integration if they are going to become live house assets rather than doctrine-only benchmarks.
- Treatment scoring is now font-aware through the editorial decision baseline, but a later pass can make graph scores first-class treatment-search inputs instead of alignment bonuses.

## 2026-05-02 - Typography Graph Inspection Layer

Date:
2026-05-02

Feature:
Inspectable graph export for the typography doctrine, runtime registry, and compatibility layer.

Idea:
Do not trust selector behavior blindly. Export the typography system as visible artifacts so we can audit which lanes are real, which are fake, and which benchmark fonts still exist only on paper.

Mini PRD:
Add a graph command that emits JSON, Markdown, and Mermaid artifacts to `docs/generated/` using only doctrine, compatibility, and runtime-registry files. The export must show font nodes, role lanes, compatibility edges, fallback role edges, runtime-selectable status, doctrine-only placeholders, and recommended next runtime loads.

Grill findings:
- We had a compatibility graph in code, but no inspection artifact that exposed the real state of the system.
- Runtime selectability was entangled with font-loading modules, which made clean inspection harder than it should have been.
- Governance questions like "which lanes are fake?" and "what should be loaded next?" need an artifact, not just prose.

Architecture decision:
Split the passive font registry data from the active font-loading module. `font-runtime-registry.ts` now owns palette metadata and runtime candidate mappings, while `editorial-fonts.ts` focuses on Remotion font loading. The new `typography-graph.ts` script inspects doctrine, compatibility, registry, and role fallback data without requiring Remotion rendering.

Files changed:
- `docs/Notes.md`
- `remotion-app/package.json`
- `remotion-app/scripts/typography-graph.ts`
- `remotion-app/src/lib/cinematic-typography/font-runtime-registry.ts`
- `remotion-app/src/lib/cinematic-typography/editorial-fonts.ts`
- `remotion-app/src/lib/cinematic-typography/runtime-font-selector.ts`

Dependencies:
None added.

Verification:
Run `npm run typography:graph` to generate the inspection artifacts, then review the generated JSON, Markdown, and Mermaid files in `docs/generated/`.

Refactor notes:
This does not complete later phases. It creates visibility for the current bridge between doctrine and runtime selection so Phase 2 governance becomes inspectable.

Open risks or follow-ups:
- The graph can now prove which runtime lanes are missing, but it does not yet load external benchmark faces as live house fonts.
- Phase 3 exploration and any later learning/ranking loop still depend on those runtime lanes becoming real.
- Visual benchmark snapshots should follow once the next house fonts are loaded.

## 2026-05-02 - House Font Runtime Scaffold

Date:
2026-05-02

Feature:
Drop-in runtime scaffold for licensed Prometheus house fonts.

Idea:
Do not wait for another selector rewrite once the real font files arrive. Create the registry, loader, and folder structure now so doctrine-only benchmark faces can become live by adding files and flipping flags.

Mini PRD:
Add a pure house-font registry, a browser-side loader, runtime palette hooks, and a public font directory scaffold for `Jugendreisen`, `Louize`, `Ivar Script`, and `Sokoli`. The integration must remain dormant until each font is explicitly enabled.

Grill findings:
- The repo had no local font asset files and no house-font loading pipeline.
- The web preview and Remotion root have separate entry points, so both need the same bootstrap path.
- Runtime graph visibility only matters if the future asset drop can turn into a live lane without architecture churn.

Architecture decision:
Split licensed-font configuration into `house-font-registry.ts` and keep actual browser loading in `house-font-loader.tsx`. Extend the runtime palette registry with house-font palette IDs, but only treat them as active when their registry entries are enabled.

Files changed:
- `docs/Notes.md`
- `remotion-app/public/fonts/house/README.md`
- `remotion-app/public/fonts/house/jugendreisen/.gitkeep`
- `remotion-app/public/fonts/house/louize/.gitkeep`
- `remotion-app/public/fonts/house/ivar-script/.gitkeep`
- `remotion-app/public/fonts/house/sokoli/.gitkeep`
- `remotion-app/src/Root.tsx`
- `remotion-app/src/web-preview/main.tsx`
- `remotion-app/src/lib/cinematic-typography/house-font-registry.ts`
- `remotion-app/src/lib/cinematic-typography/house-font-loader.tsx`
- `remotion-app/src/lib/cinematic-typography/font-runtime-registry.ts`
- `remotion-app/src/lib/cinematic-typography/editorial-fonts.ts`
- `remotion-app/src/lib/motion-platform/motion-asset-preload.ts`

Dependencies:
None added.

Verification:
`npm run typography:graph` and `npm run typography:audit` both succeed after the scaffold lands.

Refactor notes:
All house font entries are intentionally disabled right now. The selector and graph stay truthful until real licensed files are present and explicitly activated.

Open risks or follow-ups:
- The graph still correctly reports `Jugendreisen`, `Louize`, `Ivar Script`, and `Sokoli` as missing runtime fonts because no files are enabled yet.
- Enabling those fonts should be followed by graph rerun and visual snapshot generation.
- Audit counts increased because the scaffold adds new registries and public font-structure files, so future audit interpretation should distinguish live fonts from scaffold metadata.

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
