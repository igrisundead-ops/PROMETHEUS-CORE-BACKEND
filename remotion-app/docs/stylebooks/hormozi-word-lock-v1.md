# Hormozi Word-Lock v1 Style Book

## Identity
- `id`: `hormozi_word_lock_v1`
- `displayName`: `Hormozi Word-Lock v1`
- `profileMode`: additive profile (coexists with SLCP)

## Canonical Tokens
- `font-family`: `"Anton", "Bebas Neue", "Impact", sans-serif`
- `font-weight`: `800`
- `text-transform`: `uppercase`
- `letter-spacing`: `0.02em`
- `inactive-text-color`: `rgba(255, 255, 255, 0.92)` (hex base `#FFFFFF @ 92%`)
- `active-rect-fill`: `#FFD400`
- `active-text-color`: `#111111`
- `active-rect-radius`: `4px`
- `active-rect-padding-x`: `0.18em`
- `active-rect-padding-y`: `0.08em`

## Timing Contract
- Source of truth is transcript word timing (`caption.words[].startMs`, `caption.words[].endMs`).
- Word lock boundary mode is `start-inclusive` / `end-exclusive`.
- Highlight state switches only on word boundary timestamps.
- If a word has invalid duration (`endMs <= startMs`), clamp to a minimum of one frame duration (`1000 / fps` ms).
- Same timing contract must be used by both Remotion and SVG engines.

## Grouping Contract
- Hard bounds: `1-4` words per chunk.
- Soft target: `2-3` words per chunk.
- Pause-aware boundaries:
  - `pauseBreakMs`: `260`
  - `strongPauseMs`: `480`
- Readability bounds:
  - `maxLineChars`: `20`
  - `hardMaxLineChars`: `24`

## Remotion Mapping
- Style key: `hormozi_word_lock_base`
- Motion key: `hormozi_word_lock_snap`
- Layout variant: `inline`
- Rendering semantics:
  - Inactive words remain white (92% opacity equivalent).
  - Active word gets a solid yellow rectangle and dark text.
  - No eased carry-over between active words.

## SVG Contract Mapping
- Text attributes:
  - `font-family` -> stylebook `font-family`
  - `font-weight` -> stylebook `font-weight`
  - `text-transform` -> stylebook `text-transform`
  - `letter-spacing` -> stylebook `letter-spacing`
- Active rectangle attributes:
  - `fill` -> `active-rect-fill`
  - `rx` -> `active-rect-radius`
  - `data-padding-x-em` -> `active-rect-padding-x`
  - `data-padding-y-em` -> `active-rect-padding-y`
- Active word text:
  - `fill` -> `active-text-color`
