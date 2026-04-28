# SVG Typography v1 Style Book

## Source of truth
- One-time copied from: `C:\Users\HomePC\Downloads\TEXT SVG ANIMATIONS`
- Source folder is treated as read-only for this pipeline.
- Internal profile id: `svg_typography_v1`

## Variant mapping
| Internal variant id | Source preset id | Source variant | Slot schema |
| --- | --- | --- | --- |
| `cinematic_text_preset` | `cinematic-text-preset` | `single-word-chromatic` | `primary` |
| `cinematic_text_preset_1` | `cinematic-text-preset-1` | `single-word-char-stagger` | `primary` |
| `cinematic_text_preset_2` | `cinematic-text-preset-2` | `script-plus-bold` | `script+primary` |
| `cinematic_text_preset_3` | `cinematic-text-preset-3` | `slit-reveal-script-plus-bold` | `script+primary` |
| `cinematic_text_preset_4` | `cinematic-text-preset-4` | `script-left-right-wipe` | `script+primary+secondary` |
| `cinematic_text_preset_5` | `cinematic-text-preset-5` | `script-impact-split` | `script+primary+secondary` |
| `cinematic_text_preset_6` | `cinematic-text-preset-6` | `char-drop-pair` | `script+primary+secondary` |
| `cinematic_text_preset_7` | `cinematic-text-preset-7` | `script-big-small-blur` | `script+primary+secondary` |
| `cinematic_text_preset_8` | `cinematic-text-preset-8` | `script-big-small-elastic` | `script+primary+secondary` |
| `cinematic_text_preset_9` | `cinematic-text-preset-9` | `script-plus-fog-word` | `script+primary` |
| `cinematic_text_preset_10` | `cinematic-text-preset-10` | `triple-script-plus-bold` | `script_1+script_2+script_3+primary` |
| `cinematic_text_preset_11` | `cinematic-text-preset-11` | `typing-name-cursor` | `script+primary+secondary` |

## Runtime notes
- Variant routing is deterministic from chunk text + chunk index + semantic intent.
- SVG renderer is frame-native and does not depend on GSAP.
- Existing profiles (`slcp`, `hormozi_word_lock_v1`) are unchanged and remain fully supported.

