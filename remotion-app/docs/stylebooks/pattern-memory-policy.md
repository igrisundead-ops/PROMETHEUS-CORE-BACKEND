# Pattern Memory Policy

Pattern Memory is the editorial memory and constraint layer for the motion system. It is allowed to recommend, reinforce, and block, but it is not allowed to create visual clutter or repeat a concept just because it scored well once.

## Core Rules

- Prefer less motion over more motion.
- Never show the same semantic idea twice in a narrow window.
- Use underline, circle, and bubble/card treatments sparingly.
- Treat numeric emphasis as a single dominant representation.
- If a scene is dense, hold back new emphasis unless the goal is restraint.
- A single concept should own the frame whenever possible.

## Asset Tagging Policy

Every new motion asset entering `C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\STRUCTURED ANIMATION` is scanned and normalized into the prototype catalog.

Each asset should carry:

- semantic tags
- function tags
- retrieval phrases
- intensity and visual weight
- placement preference
- reuse budget
- conflict rules
- structural region metadata
- partial reveal hints
- coverage status
- metadata confidence

If the system cannot infer enough metadata, the asset is flagged for review instead of being treated as fully trusted.

## Structural Metadata

Assets are not black boxes.

The metadata layer may describe:

- labels and text blocks
- number slots and percent signs
- graph bars and chart regions
- icons and accent chips
- step indicators and connector lines
- comparison sides and separators
- target regions for focus effects
- progressive reveal sections
- optional sections that can remain hidden

This allows the motion brain to choose a whole asset, a partial asset, or a background-support role depending on context.

## Reinforcement Rules

Pattern Memory may reinforce a pattern when:

- the selection improved clarity or hierarchy
- the scene stayed readable
- the effect was context-appropriate
- the asset did not compete with captions or speech

Patterns gain strength slowly. Human approval increases confidence more than an automated success does.

## Rejection Rules

Pattern Memory must record rejection reasons such as:

- redundancy
- clutter risk
- timing conflict
- poor hierarchy
- caption collision
- speaker obstruction
- overuse
- duplicate semantic emphasis

Rejected patterns are not ignored. They are remembered and downranked so the system becomes more selective over time.

## New Asset Onboarding

When a new asset is added:

1. The scanner detects it.
2. The tagger infers meaning from filename, directory, content, and data attributes.
3. Structural regions are inferred when possible.
4. The asset receives a coverage status.
5. Low-confidence assets are flagged for review.
6. Retrieval can still see them, but selection remains conservative.

## Operational Contract

- Backend and preview share the same pattern-memory snapshot.
- The backend writes ledger events for reinforcement and rejection.
- Preview and render use the same freshness fingerprint.
- The system should become calmer and more disciplined after each job, not more chaotic.
