# UNIVERSE HAND

UNIVERSE HAND is the pre-run rulebook for this Prometheus workspace.

Use it before every code run, feature build, bug fix, refactor, or dependency decision.

Until the approval gate is cleared, do not write code.

## Core Rule

Before writing code, grill the spec.

Find:

- unclear requirements
- missing edge cases
- bad architectural assumptions
- security risks
- performance traps
- dependency risks
- places where this could break in production

Ask the hard questions first.

## Mandatory Flow

Idea -> PRD -> Grill -> Architecture -> File map -> Implementation -> Test -> Refactor -> Notes.md

Implementation does not begin until the pre-implementation steps are complete and the user approves.

## Pre-Implementation Checklist

For every feature request:

1. Read the current repo structure.
2. Identify the relevant frontend, backend, and shared files.
3. Summarize the existing architecture.
4. Write a mini PRD for the feature.
5. Grill the PRD and expose unclear assumptions.
6. Propose the implementation as one coherent module, not scattered micro-edits.
7. List all files to create or modify.
8. List any dependencies needed and justify each one.
9. Wait for approval before implementation.

## Repo Map

This workspace is not a small single-app repo. It is a media-heavy Prometheus workspace with a few active code surfaces and many asset folders.

Primary code surfaces:

- `backend/src`
  Fastify backend for uploads, jobs, edit sessions, preview routes, asset retrieval, GOD routes, and orchestration.

- `remotion-app/src/web-preview`
  Main browser control room for live preview, render lane control, backend polling, and preview UX.

- `remotion-app/src/components`
  Remotion and overlay runtime components.

- `remotion-app/src/compositions`
  Renderable Remotion compositions.

- `remotion-app/src/lib`
  Shared frontend/runtime utilities for captions, motion planning, assets, vector retrieval, backend integration, and preview logic.

- `remotion-app/src/creative-orchestration`
  In-app orchestration logic for creative direction, judgment, segmentation, and rendering transforms.

- `remotion-app/src/data`
  Generated and semi-generated artifacts such as captions, manifests, motion maps, and asset indexes. Treat these as outputs unless the task explicitly targets them.

- `src/creative-orchestration`
  A second orchestration tree exists at the workspace root. Verify which tree is the source of truth before touching anything that looks shared.

- `docs/GOD.md`
  Existing governance doc for governed on-demand asset generation.

Mostly non-code or asset-heavy surfaces:

- `assets`, `STATIC ASSETS`, `TRANSITION`, `PROMETHEUS_SONGS`, `SVG animations`, `TEXT SVG ANIMATIONS`, and similar folders
- large experimental or archive areas such as `static, motion, gsap MANHUNTER`

## Current Architecture Summary

Backend:

- `backend/src/app.ts` wires the Fastify app, CORS, multipart uploads, in-process queueing, edit-session routes, upload routes, GOD routes, pattern-memory routes, local preview routes, and job routes.
- `backend/src/service.ts` normalizes JSON and multipart requests, creates job records, writes input manifests, and hands work to the processing pipeline.
- Backend state is file-backed and queue-driven, with local storage plus optional external services such as AssemblyAI, Groq, R2, Milvus, and embedding providers.

Frontend:

- `remotion-app/src/web-preview/PreviewApp.tsx` is the main interactive UI for live compositor preview and final render control.
- `remotion-app/src/web-preview/main.tsx` mounts the preview app with a root error boundary.
- `remotion-app/src/lib/backend-api.ts` centralizes backend base URL and JSON fetching behavior.
- `remotion-app/vite.config.ts` also exposes a dev-only draft preview API path.

Boundary reality:

- The backend owns uploads, job orchestration, preview status, persistent artifacts, and service integration.
- The Remotion app owns preview UX, player state, overlay rendering, and composition/runtime behavior.
- Shared logic is not formally isolated into a dedicated package, so boundary discipline must be enforced manually.

## Guardrails

- Do not break existing routes.
- Do not rewrite unrelated systems.
- Do not add dependencies unless necessary.
- Keep frontend/backend boundaries clean.
- Prefer modular architecture.
- Add comments only where logic is non-obvious.
- Include tests or verification steps.

Repo-specific guardrails:

- Protect existing backend routes including `/health`, `/api/jobs`, `/api/generate-viral-clips`, `/api/local-preview/*`, `/api/edit-sessions/*`, `/api/god/*`, `/api/upload-url`, and `/api/process`.
- Treat user-supplied file paths, uploads, and remote URLs as risky inputs.
- Check whether a change belongs in `backend/src`, `remotion-app/src`, or both before editing.
- Confirm whether `remotion-app/src/creative-orchestration` or root `src/creative-orchestration` is active before changing orchestration code.
- Avoid casual edits to generated data under `remotion-app/src/data`.
- Remember the workspace root is not a Git repository, so change tracking cannot depend on root-level Git status.

Editorial guardrails:

- Treat each moment like a coordinated team decision, not a pile of independent effects.
- Once a moment chooses a visual captain such as typography, asset, background stage, or restraint, the other layers must support that captain instead of competing with it.
- Concept reduction is allowed when it improves the treatment. Do not force literal transcription if a hero word or hero phrase communicates the idea more powerfully.
- Support tools such as highlight, circle, and underline are subordinate tools, not hero tools.
- Enforce anti-repetition on premium tricks, hero text moves, and flashy support cues.
- Behind-speaker text or asset treatment is premium and should stay rare.
- Prefer clarity over literal asset matching when the noun is abstract or the literal asset would feel confusing.

## Mini PRD Template

For each feature, produce:

- Feature name
- User goal
- Why this matters
- In scope
- Out of scope
- Existing routes or contracts affected
- Success criteria
- Constraints
- Verification plan

## Grill Checklist

Ask these before implementation.

Requirements:

- What is the exact user flow?
- What does success look like in the UI, API, or output artifact?
- What must stay unchanged?
- What happens when required inputs are missing or malformed?

Edge cases:

- Empty file selection
- bad local path
- unsupported media type
- transcript missing or partial
- long-form vs reel mismatch
- concurrent jobs
- stale generated JSON
- backend offline during frontend actions

Architecture:

- Does this belong in backend, frontend, or a shared utility?
- Are we extending an existing route or inventing a new one without need?
- Are we duplicating logic that already exists elsewhere?
- Is the change coherent as one module or spread across unrelated files?

Security:

- Can user input escape path boundaries?
- Are uploads size-limited and type-checked?
- Are secrets or provider keys exposed to the client?
- Are public URLs or generated assets unintentionally discoverable?

Performance:

- Does this add polling, synchronous file IO, heavy parsing, or large memory use?
- Will it slow render startup, preview interaction, or background jobs?
- Does it multiply work per frame, per caption, or per asset lookup?

Dependency risk:

- Can the task be done with existing packages?
- Does a new package add native build friction, version drift, or runtime instability?
- Is the dependency compatible with the current React, Remotion, Fastify, and TypeScript stack?

Production break risk:

- Could this drift API contracts already used by the preview UI?
- Could it fail when env vars are absent or partially configured?
- Could it corrupt generated artifacts or session storage?
- Could the in-process queue become a bottleneck or dead-end?

## Delivery Packet Template

Before implementation, present the feature like this:

- Idea
- Relevant frontend files
- Relevant backend files
- Relevant shared or generated files
- Existing architecture summary
- Mini PRD
- Grill findings
- Proposed architecture
- File map
- Dependency list with justification
- Verification plan
- Approval status: waiting

## Approval Gate

Stop after the delivery packet.

Do not implement until the user approves.

## Implementation Rules After Approval

Once approved:

1. Implement the change as one coherent module.
2. Keep edits scoped to the agreed file map.
3. Test or verify at the same level as the risk.
4. Refactor only what is necessary to keep the module clean.
5. Record the result in `docs/Notes.md`.

## Resource Gap Escalation

If implementation quality is limited by missing creative resources, do not silently fake confidence.

Raise a concrete resource-gap request to the user when the system is missing things such as:

- GSAP animation families or reusable motion logic
- static asset categories
- matte-friendly cutout assets
- b-roll categories
- support-motion variants
- cleaner background treatments
- transparent overlays
- generated image variants for an existing asset family

When raising the gap, state:

- what is missing
- what decision quality it limits
- what exact asset or pack would improve it
- whether GOD, image generation, matting, or tagging work is the best next move

## Notes.md Rule

Every approved implementation should leave a short entry in `docs/Notes.md` with:

- date
- feature
- PRD summary
- grill findings that mattered
- files changed
- dependencies added or rejected
- verification performed
- follow-up risks or open questions
