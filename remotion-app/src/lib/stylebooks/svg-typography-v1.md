# SVG Typography v1 Rulebook

Source-of-truth note:
- Preset behavior was copied one-time from `C:\Users\HomePC\Downloads\TEXT SVG ANIMATIONS`.
- The source folder is treated as read-only and is not live-synced.
- Runtime parity constants in `SvgCaptionOverlay.tsx` are canonical for Remotion render behavior.

Variant mapping:

| Source preset ID | Internal variant ID | Slot schema |
| --- | --- | --- |
| `cinematic-text-preset` | `cinematic_text_preset` | `primary` |
| `cinematic-text-preset-1` | `cinematic_text_preset_1` | `primary` |
| `cinematic-text-preset-2` | `cinematic_text_preset_2` | `script+primary` |
| `cinematic-text-preset-3` | `cinematic_text_preset_3` | `script+primary` |
| `cinematic-text-preset-4` | `cinematic_text_preset_4` | `script+primary+secondary` |
| `cinematic-text-preset-5` | `cinematic_text_preset_5` | `script+primary+secondary` |
| `cinematic-text-preset-6` | `cinematic_text_preset_6` | `script+primary+secondary` |
| `cinematic-text-preset-7` | `cinematic_text_preset_7` | `script+primary+secondary` |
| `cinematic-text-preset-8` | `cinematic_text_preset_8` | `script+primary+secondary` |
| `cinematic-text-preset-9` | `cinematic_text_preset_9` | `script+primary` |
| `cinematic-text-preset-10` | `cinematic_text_preset_10` | `script_1+script_2+script_3+primary` |
| `cinematic-text-preset-11` | `cinematic_text_preset_11` | `script+primary+secondary` |

Compatibility routing order:
1. Slot schema filter.
2. Character-range compatibility filter.
3. Intent compatibility filter.
4. Deterministic hash pick inside remaining candidates.
