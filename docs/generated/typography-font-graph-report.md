# Typography Font Graph Report

Generated: 2026-05-04T03:57:47.196Z

## Phase Status

- Phase 1: done
- Phase 2: started
- Phase 3: not-started
- Phase 4: not-started

## Lane Audit

- Missing runtime fonts: `Jugendreisen`, `Louize`, `Ivar Script`, `BS Acapulko`, `Sokoli`
- Fully doctrine-only lanes: `hero_serif_primary`, `script_accent_rare`, `display_sans_pressure_release`
- Partial-runtime lanes: `hero_serif_alternate`

## Role Nodes

- `hero_serif_primary`: status=doctrine-only; benchmark=jugendreisen; active=none; doctrine-only=jugendreisen
- `hero_serif_alternate`: status=partial-runtime; benchmark=louize; active=noto-serif-display; doctrine-only=louize
- `editorial_serif_support`: status=runtime-ready; benchmark=fraunces; active=playfair-display, fraunces, crimson-pro, instrument-serif; doctrine-only=none
- `neutral_sans_core`: status=runtime-ready; benchmark=dm-sans; active=dm-sans; doctrine-only=none
- `script_accent_rare`: status=doctrine-only; benchmark=ivar-script; active=none; doctrine-only=ivar-script, bs-acapulko
- `display_sans_pressure_release`: status=doctrine-only; benchmark=none; active=none; doctrine-only=sokoli, anton, bebas-neue

## Font Nodes

- `Jugendreisen`: roles=hero_serif_primary; stage=benchmark; runtime=doctrine-only
- `Louize`: roles=hero_serif_alternate; stage=candidate; runtime=doctrine-only
- `Noto Serif Display`: roles=hero_serif_alternate; stage=candidate; runtime=active-runtime via noto-display
- `Playfair Display`: roles=editorial_serif_support; stage=candidate; runtime=active-runtime via playfair-contrast
- `Cormorant Garamond`: roles=editorial_serif_support; stage=legacy; runtime=legacy-runtime via cormorant-salon
- `Fraunces`: roles=editorial_serif_support; stage=candidate; runtime=active-runtime via fraunces-editorial
- `Crimson Pro`: roles=editorial_serif_support; stage=candidate; runtime=active-runtime via crimson-voice
- `Instrument Serif`: roles=editorial_serif_support; stage=candidate; runtime=active-runtime via instrument-nocturne
- `DM Sans`: roles=neutral_sans_core; stage=approved; runtime=active-runtime via dm-sans-core
- `Ivar Script`: roles=script_accent_rare; stage=candidate; runtime=doctrine-only
- `BS Acapulko`: roles=script_accent_rare; stage=candidate; runtime=doctrine-only
- `Sokoli`: roles=display_sans_pressure_release; stage=candidate; runtime=doctrine-only
- `Anton`: roles=display_sans_pressure_release; stage=legacy; runtime=doctrine-only
- `Bebas Neue`: roles=display_sans_pressure_release; stage=legacy; runtime=doctrine-only

## Strongest Pairings

- `Jugendreisen` -> `DM Sans` (supports, 0.96): This is the current north-star pairing: prestige hero serif anchored by clean neutral utility support.
- `Fraunces` -> `DM Sans` (supports, 0.89): Excellent editorial support pairing with warmth and readable utility balance.
- `Fraunces` -> `Crimson Pro` (fallback, 0.87): Crimson Pro is the clearest documentary understudy when Fraunces would feel too warm, too luxe, or too voiced.
- `Crimson Pro` -> `DM Sans` (supports, 0.85): Strong documentary and explanatory support relationship.
- `Jugendreisen` -> `Louize` (fallback, 0.81): Louize can act as a softer alternate hero serif if it stays visibly distinct from the benchmark.
- `Jugendreisen` -> `Ivar Script` (contrast, 0.78): Promising luxury contrast, but only for very rare accent insertions.
- `Fraunces` -> `Instrument Serif` (fallback, 0.74): Instrument Serif can soften support moments, but it belongs in a hush-luxury support lane rather than competing for hero authority.
- `Jugendreisen` -> `Noto Serif Display` (fallback, 0.73): Noto Serif Display can serve monumental statement duty, but it must not flatten into a generic substitute.

## Unresolved Placeholders

- `Jugendreisen` for hero_serif_primary
- `Louize` for hero_serif_alternate
- `Ivar Script` for script_accent_rare
- `BS Acapulko` for script_accent_rare
- `Sokoli` for display_sans_pressure_release

## What Should Be Loaded Next

- `Jugendreisen` for `hero_serif_primary`: Benchmark for hero_serif_primary exists only in doctrine right now.
- `Louize` for `hero_serif_alternate`: Benchmark for hero_serif_alternate exists only in doctrine right now.
- `Ivar Script` for `script_accent_rare`: Benchmark for script_accent_rare exists only in doctrine right now.
- `Sokoli` for `display_sans_pressure_release`: Pressure-release lane has no active runtime house face.
