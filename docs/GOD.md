# GOD

GOD stands for **governed on-demand asset generation**.

It is the subsystem that creates custom modular motion assets only when the existing library is not strong enough for a scene. The goal is not to generate more assets by default, but to generate better assets when the moment demands a more precise visual answer.

## When GOD is invoked

The backend evaluates the scene context first:

- semantic fit
- stylistic fit
- motion fit
- composition fit
- emotional / editorial fit
- premium quality threshold

If the existing library is sufficient, the system reuses it. If the match is close but not exact, GOD can generate a variation. If the match is ambiguous or too weak, the system can escalate for manual review instead of generating immediately.

The main entry points are:

- `POST /api/god/evaluate`
- `POST /api/god/generate`
- `POST /api/god/assets/:reviewId/approve`
- `POST /api/god/assets/:reviewId/reject`
- `POST /api/god/assets/:reviewId/variation`

## Governance model

GOD is governed in layers:

1. existing-library-first matching
2. brief construction with strong constraints
3. provider fallback orchestration
4. hard validation checks
5. benchmark gating
6. human approval before permanent promotion

Transparent background is the default for overlay-style assets. The generated output must be compositable, reusable, and clean at the edges.

## Provider abstraction

Provider integration is intentionally provider-agnostic.

The current implementation supports:

- a local premium HTML/CSS template provider
- a remote JSON provider endpoint behind a thin contract

The provider router can fall back automatically if the first provider fails, times out, or returns a low-confidence / malformed result.

To add another provider, implement the same provider interface in `backend/src/god/providers.ts` and add it to the provider chain.

## Validation and benchmark gates

Generated assets are checked for:

- transparent background requirements
- compositing cleanliness
- JS-free output
- watermark / branding contamination
- technical validity
- aesthetic threshold
- stylistic adherence
- motion suitability
- reuse potential

The benchmark gate controls whether the asset can enter the permanent collection. End-user approval is decisive for promotion.

## Collection ingestion

Approved assets are written into the permanent collection folder and catalog:

- asset file
- preview file
- metadata sidecar
- benchmark results
- origin trace
- tags and categories
- reuse annotations

The permanent catalog lives at:

- `remotion-app/src/data/god-assets.generated.json`

The review bundle lives under the backend GOD review directory.

## Example flow

The real end-to-end helper is:

- `backend/src/god/example-flow.ts`

It demonstrates the actual sequence:

1. inspect existing assets
2. invoke GOD if needed
3. validate the returned asset
4. wait for user approval
5. promote to the collection folder
6. make it discoverable by future motion planning

## Environment variables

Useful settings:

- `GOD_PROVIDER_KIND`
- `GOD_PROVIDER_ENDPOINT`
- `GOD_PROVIDER_API_KEY`
- `GOD_PROVIDER_MODEL`
- `GOD_PROVIDER_TIMEOUT_MS`
- `GOD_COLLECTION_DIR`
- `GOD_COLLECTION_MANIFEST_PATH`
- `GOD_REVIEW_DIR`
- `GOD_MIN_TECHNICAL_SCORE`
- `GOD_MIN_COMPOSITING_SCORE`
- `GOD_MIN_AESTHETIC_SCORE`
- `GOD_MIN_STYLE_SCORE`
- `GOD_MIN_MOTION_SCORE`
- `GOD_MIN_REUSE_SCORE`
- `GOD_MIN_OVERALL_SCORE`
- `GOD_MAX_BRIEF_SIMILARITY`
- `GOD_AUTO_PROMOTE`

## Discovery

Approved GOD assets are loaded into the normal motion-asset discovery path through:

- `backend/src/motion-plan.ts`
- `remotion-app/src/lib/motion-platform/asset-catalog.ts`
- `remotion-app/src/lib/motion-platform/motion-asset-registry.ts`
- `remotion-app/src/lib/motion-platform/showcase-asset-catalog.ts`

That keeps GOD assets usable by the existing motion engine instead of isolating them in a side channel.
