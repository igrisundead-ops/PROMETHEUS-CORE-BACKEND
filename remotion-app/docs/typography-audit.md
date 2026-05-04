# Typography Audit

Generated: 2026-05-04T03:57:51.444Z

## Summary

- Files scanned: 408
- Font occurrences: 420
- Unique fonts: 35
- Dynamic occurrences: 187
- Hardcoded occurrences: 233
- Active runtime occurrences: 219
- Legacy occurrences: 201

## Issues

- [high] Too many condensed display sans fonts are competing for the same job: The audit found several tall, forceful sans faces occupying the same hero/headline territory. This is classic role duplication and will make the system feel random unless we retire most of them. Fonts: Bebas Neue, Anton, Oswald, League Gothic, Teko, Impact.
- [medium] Accent script territory is duplicated: Multiple script fonts are present, but script should be a rare accent role. Without strict limits, this becomes faux-luxury very quickly in motion. Fonts: Great Vibes, Allura, Ivar Script.
- [high] Hardcoded font choices are bypassing the typography intelligence layer: Several active runtime components still embed explicit font stacks instead of routing through a single governed font system. That makes consistency impossible even with better taste rules. Fonts: Bebas Neue, DM Sans, Anton, Oswald, Cormorant Garamond, Arial Narrow, Times New Roman, League Gothic, Sora, DM Serif Display, Playfair Display, Segoe UI, Fraunces.
- [high] A few fonts are carrying too many roles by repetition alone: The frequency pattern suggests convenience-driven reuse rather than deliberate hierarchy. That is the exact expression-over-structure trap we want to avoid. Fonts: Bebas Neue, DM Sans, Anton, Oswald, Cormorant Garamond, Arial Narrow, Times New Roman, League Gothic, Sora, DM Serif Display, Playfair Display, Bodoni Moda, Great Vibes.
- [high] Legacy and active typography systems are drifting apart: The repo still contains a strong legacy preset layer alongside the newer editorial selector. Until they share one governed font graph, Prometheus will keep producing split-brain typography.

## Missing Categories

- No outright category gaps were found.

## Governance Gaps

- neutral_sans exists, but it is not singular. DM Sans is still competing with Segoe UI and Arial Narrow in parts of the stack, so the missing piece is restriction, not discovery.
- hero typography is overcrowded. The system needs 2-3 elite hero faces, not a broad shelf of equally expressive options.
- accent usage is too open-ended. Script and decorative faces should be tightly quarantined to rare rhetorical moments.

## Removal Recommendations

- Bebas Neue
- Anton
- League Gothic
- Oswald
- Great Vibes
- Arial Narrow

## Font Inventory

| Font | Category | Uses | Role Bands | Flags |
| --- | --- | ---: | --- | --- |
| Bebas Neue | display-sans | 52 | support, unknown | limited-weight-range, overused |
| DM Sans | neutral-sans | 46 | accent, body, hero, support, unknown | overused, role-bleed |
| Anton | display-sans | 44 | unknown | limited-weight-range, overused |
| Oswald | display-sans | 38 | unknown | overused |
| Cormorant Garamond | display-serif | 32 | accent, hero, support, unknown | overused, role-bleed |
| Arial Narrow | neutral-sans | 28 | accent, hero, support, unknown | overused, premium-conflict, role-bleed |
| Times New Roman | display-serif | 25 | accent, hero, support, unknown | overused, role-bleed |
| League Gothic | display-sans | 21 | unknown | kerning-risk, limited-weight-range, overused |
| Sora | display-serif | 20 | unknown | overused |
| DM Serif Display | display-serif | 16 | body, hero, support | limited-weight-range, overused, role-bleed |
| Playfair Display | display-serif | 16 | accent, body, hero, support | overused, role-bleed |
| Bodoni Moda | display-serif | 15 | unknown | overused |
| Great Vibes | script | 12 | body, unknown | limited-weight-range, motion-noise-risk, overused, readability-risk |
| Allura | script | 6 | body, support, unknown | limited-weight-range, motion-noise-risk, readability-risk, role-bleed |
| Cinzel | display-serif | 6 | unknown | none |
| Segoe UI | neutral-sans | 5 | support | none |
| Teko | display-sans | 5 | unknown | kerning-risk, limited-weight-range |
| Fraunces | display-serif | 3 | accent, hero | none |
| Impact | display-sans | 3 | unknown | limited-weight-range |
| Arial | neutral-sans | 2 | accent, support | none |
| Blacker Pro | display-serif | 2 | unknown | none |
| Cascadia Code | mono | 2 | support | none |
| Crimson Pro | display-serif | 2 | accent, hero | none |
| Instrument Serif | display-serif | 2 | accent, hero | limited-weight-range |
| Ivar Script | script | 2 | accent | limited-weight-range, motion-noise-risk |
| Jugendreisen | display-serif | 2 | accent, hero | none |
| Lora | display-serif | 2 | accent, hero | none |
| Louize | display-serif | 2 | support | none |
| Noto Serif Display | display-serif | 2 | accent, hero | none |
| Sokoli | display-serif | 2 | accent, hero | none |
| Avelia Serif | display-serif | 1 | unknown | none |
| Fabringo | decorative | 1 | unknown | limited-weight-range |
| Freight Pro | decorative | 1 | unknown | limited-weight-range |
| Georgia | display-serif | 1 | support | none |
| Saint Monica | decorative | 1 | unknown | limited-weight-range |

