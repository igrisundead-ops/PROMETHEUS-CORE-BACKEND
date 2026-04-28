# Joshua's Motion Graphics Intuition Brain

Status: living draft

Alias note:
- "Eve typography" is the working name for the long-form SVG caption family currently represented in code as `longform_svg_typography_v1`.
- `svg_typography_v1` stays the short-form SVG typography profile for now.
- The selective, speech-breathing motion path is the separate long-form sidecall system, currently represented by `longform_semantic_sidecall_v1` plus the governor and trigger engines.
- The active Pattern Memory policy now lives in [`pattern-memory-policy.md`](./pattern-memory-policy.md) and should be treated as the restraint rulebook for redundancy, tagging, reinforcement, and asset onboarding.

## Purpose
- Let the speaker breathe.
- Trigger motion only at the moments that carry semantic weight.
- Prefer one strong cue over many weak cues.
- Protect the face, the subtitles, and the next beat.
- Keep the frame feeling designed, not regimented.

## Current Code Anchors
| Layer | Current identifier | What it does |
| --- | --- | --- |
| Long-form SVG captions | `longform_svg_typography_v1` | Full long-form SVG caption path, currently the thing we are calling Eve typography. |
| Short-form SVG captions | `svg_typography_v1` | Shorter SVG caption stylebook with tighter word-bucket routing. |
| Selective semantic sidecall | `longform_semantic_sidecall_v1` | Lets speech breathe and only punctuates the important beats. |
| Sidecall governor | `semantic-sidecall-governor.ts` | Scores semantic cues and decides whether they become text-only, template, or asset-backed inserts. |
| Sidecall visual family | `SemanticSidecallCueVisual.tsx` | Renders graph, KPI, timeline, blueprint, and typography-only sidecall cards. |
| Camera trigger brain | `semantic-camera-trigger-engine.ts` | Finds camera emphasis beats around direct address, identity, definition, and instruction cues. |
| Transition brain | `transition-brain.ts` | Handles transition punctuation between beats without crushing dialog. |
| Grade profiles | `grade-profiles.ts` | Holds the reusable grade presets and finishing profile math. |
| Shared semantics | `types.ts`, `longform-semantic-sidecall.ts` | Carries chunk intent, emphasis, entity, and step-sequence metadata. |

## Signal Weight Ladder
| Priority band | Signal class | Default score band | What counts as a hit | What should suppress it | Best visual families |
| --- | --- | --- | --- | --- | --- |
| 1 | Hook statement | 90-100 | Short, standalone, quotable line with the most semantic weight in the moment. | Long setup lines, filler, or anything that only works with the next sentence. | Circle word reveal, side quote card, chapter divider. |
| 2 | Quote | 88-98 | Explicit quotation or clear attribution of someone else's line. | Paraphrase, vague attribution, or a quote that is too long to breathe. | Side quote card, quote pull, portrait postcard. |
| 3 | CTA | 86-96 | Direct instruction to the viewer: subscribe, sign up, buy, follow, tap, download. | Third-party instructions, soft narration, or a CTA that arrives too early. | CTA card, icon support badge, lower-third prompt. |
| 4 | Entity mention | 82-96 | Person, product, organization, location, or event with recognizability. | Generic nouns, weak names, or unsupported references. | Lower third, portrait postcard, image reference card. |
| 5 | Objection | 82-94 | Counterpoint language: but, however, you might think, the problem is. | Plain contrast that does not feel like a real objection. | Split card, listed-versus card, side quote card. |
| 6 | Number / stats | 84-96 | Real metric, amount, percentage, count, or KPI. | Incidental number with no narrative weight. | Statistics card, graph popping, number counter. |
| 7 | Timeline / year | 74-88 | Year, date, time span, chronology, or historical pivot. | Stray date that does not matter structurally. | Chapter divider, timeline card, year stamp. |
| 8 | Repeated phrase | 76-90 | Same term or idea returns across multiple beats and gains force. | Repetition that is only filler or accidental echo. | Echo stamp, repeated underline, side quote card. |
| 9 | Key phrase emphasis | 68-86 | A phrase inside a longer line suddenly carries extra semantic load. | Speech is moving too quickly or the line is already crowded. | Animated underline, circle reveal, keyboard highlight. |
| 10 | List / steps | 66-84 | Step numbering, sequenced actions, checklist language, or clear process structure. | Loose enumeration with no real internal order. | Blueprint workflow, listed-versus card, step row or stack. |
| 11 | Ambient accent | 40-65 | Low-stakes emphasis when the frame still has room to breathe. | Busy scenes, face overlap, or high speech density. | Ambient flair, background texture takeover, subtle highlight. |

## Signal Log

### Hook statement
- Trigger conditions: opening line, closing line, or a line that is clearly the strongest standalone thought in the set.
- Contraindications: do not treat every loud or emotional line as a hook if it needs the surrounding paragraph to make sense.
- Placement variants: center hero, side quote card, lower-third opener, or chapter opener.
- Intensity variants: whisper, editorial, hero.
- Timing presets: short entry, brief hold, clean exit. Prefer around 3-8 words, with a hard ceiling around 12 if the line stays readable.
- Asset requirements: one strong type treatment, optional quote marks, underline, or circle reveal.

### Key phrase emphasis
- Trigger conditions: a noun phrase, verb phrase, or descriptor suddenly matters more than neighboring words.
- Contraindications: do not over-annotate every syllable; if the speech is too fast, keep it simple or suppress it.
- Placement variants: inline underline, word circle, small badge, or sidecall accent.
- Intensity variants: light emphasis, medium emphasis, hard emphasis.
- Timing presets: quick in, short hold, quick out.
- Asset requirements: underline path, mask, glow, or compact text accent.

### Repeated phrase emphasis
- Trigger conditions: the same phrase, concept, or name repeats across nearby beats and starts to carry extra force.
- Contraindications: skip it if the repetition is only verbal filler or the repeats are too close together to matter.
- Placement variants: echo underline, repeat stamp, stacked callout, or return card.
- Intensity variants: subtle echo, clear echo, chapter return.
- Timing presets: usually on the second or third meaningful repeat.
- Asset requirements: repeat-safe typography, duplicate mask, or a small echo motif.

### Quote
- Trigger conditions: explicit quotation marks, attributed speech, reported speech, or a line that is clearly being borrowed.
- Contraindications: do not fake a quote treatment for a paraphrase.
- Placement variants: side quote card, centered quote pull, lower-third attribution.
- Intensity variants: editorial, premium, full quote card.
- Timing presets: enough time for the viewer to read the quoted line without rushing.
- Asset requirements: quotation marks, attribution rail, optional speaker image or citation line.

### Objection
- Trigger conditions: pushback language, skepticism, counterpoint, or a line that sets up tension against the current argument.
- Contraindications: ordinary contrast is not the same as a real objection.
- Placement variants: split card, counterpoint card, side quote card, versus card.
- Intensity variants: soft objection, sharp objection, confrontational objection.
- Timing presets: place on the turn, not after the moment has already passed.
- Asset requirements: contrast divider, opposing label, or minimal typographic split.

### Punchline
- Trigger conditions: setup and payoff, reveal, twist, or a line that resolves tension with a hit.
- Contraindications: do not force a punchline treatment without a real setup.
- Placement variants: center pop, circle reveal, full-width accent, or texture burst.
- Intensity variants: subtle, punch, full hero.
- Timing presets: short lead-in, immediate reveal, then a clean hold.
- Asset requirements: burst line, pop mask, accent stroke, or a compact impact card.

### CTA
- Trigger conditions: verbs aimed directly at the viewer, including subscribe, sign up, buy, follow, join, comment, tap, or download.
- Contraindications: narration about a third party does not count as a CTA.
- Placement variants: lower-third prompt, end card, button-like card, or side badge.
- Intensity variants: soft ask, firm ask, hard ask.
- Timing presets: usually late in the beat or at the end of the section.
- Asset requirements: CTA card, button frame, arrow, or icon badge.

### Number / stats
- Trigger conditions: numeric figure, KPI, ratio, large quantity, dollar amount, percent, or a figure that matters on its own.
- Contraindications: incidental dates and casual numbers should not steal the frame.
- Placement variants: number-counter card, stat tile, graph card, or inline number emphasis.
- Intensity variants: light stat, medium stat, hero KPI.
- Timing presets: give the number enough time to count or resolve.
- Asset requirements: animated counter, chart line, graph frame, or KPI plate.

### Timeline / year
- Trigger conditions: years, dates, spans, historical pivots, or chronology that changes how the story is read.
- Contraindications: a random year mention without narrative function should stay quiet.
- Placement variants: chapter divider, year stamp, horizontal timeline, or calendar card.
- Intensity variants: year stamp, timeline card, chapter divider.
- Timing presets: short enough to punctuate, long enough to orient.
- Asset requirements: divider rule, calendar marker, year label, or timeline track.

### List / steps
- Trigger conditions: step one, first / second / third, checklist language, or a sequence that has internal order.
- Contraindications: loose lists without clear sequence should not get a full workflow card.
- Placement variants: listed-versus card, step row, step stack, or blueprint workflow.
- Intensity variants: two-item, three-item, full stack.
- Timing presets: usually when the list begins, not after it has already rushed by.
- Asset requirements: row rails, numbered markers, workflow nodes, or stacked layout pieces.

### Entity mention
- Trigger conditions: named people, organizations, products, locations, or events that deserve a visual anchor.
- Contraindications: common nouns and weak references should not trigger an asset search.
- Placement variants: lower third, portrait postcard, person intro card, or image reference card.
- Intensity variants: text-only, supported, portrait-backed, hero identity card.
- Timing presets: on first meaningful mention or at the strongest re-mention.
- Asset requirements: portrait, logo, icon, research-backed image, or sourced reference card.

### Ambient accent
- Trigger conditions: the frame still has room, the cue is light, and the goal is atmosphere rather than instruction.
- Contraindications: skip when the scene is busy, the face is crowded, or the speech is moving too fast.
- Placement variants: periphery, background, corner, or texture layer.
- Intensity variants: whisper, soft, medium.
- Timing presets: low, quick, and mostly non-blocking.
- Asset requirements: ambient flair, subtle texture, tiny highlight, or faint glow.

## Treatment Library
| Treatment | Trigger conditions | Contraindications | Placement variants | Intensity variants | Timing presets | Asset requirements |
| --- | --- | --- | --- | --- | --- | --- |
| Subtle keyboard highlight | Small emphasis, a spoken UI cue, or a phrase that should feel tactile without becoming loud. | Do not use when the line needs a stronger card or when the frame is already busy. | Inline, near the word, or in the lower third. | Whisper, soft, medium. | Very short in and out, usually under a second. | Keycap shapes, micro glow, or narrow highlight bars. |
| Animated underline | Key phrase emphasis, objection language, or repeated emphasis. | Skip if the sentence is already multi-line or crowded. | Under a single word, a phrase, or a short line. | Thin, brush, neon, or glow. | Fast entry, short hold. | Stroke path, mask, or glow line. |
| Circle word reveal | Hook statement, punchline, quote anchor, or CTA verb. | Avoid when the phrase is not isolated enough to read cleanly. | Around one word or a very short two-word unit. | Soft, medium, hero. | Quick reveal with a short hold. | Circular stroke, mask, or burst ring. |
| Side quote card | Quote, hook statement, objection, or punchline that needs air. | Skip if the line is too long or the frame is too dense. | Left, right, or slightly off-center sidecall. | Compact, editorial, full. | Slightly slower entry so the viewer can read it. | Quote marks, attribution rail, framing rule. |
| Person intro lower third | Person entity, interviewer, expert callout, or first-time name reveal. | Avoid if the face already occupies the lower third or the shot is cramped. | Lower third, sidecall, or offset nameplate. | Subtle, editorial, hero. | Medium pace, readable but not heavy. | Nameplate, portrait trim, optional title line. |
| Portrait postcard name | Recognizable person mention with a usable portrait or strong identity asset. | Avoid if there is no reliable portrait or the asset is weak. | Side postcard, lower third, or centered identity plate. | Editorial, premium, hero. | Enough time for portrait recognition. | Portrait, name, role line, and framing border. |
| Statistics card | Number / stats, money, percent, growth, or KPI moments. | Avoid if the number is incidental or not the point of the line. | Center tile, side panel, or stacked stat card. | Light stat, medium stat, hero KPI. | Long enough for the number to count and settle. | Counter, unit label, chart stem, or KPI plate. |
| Graph popping | Growth, comparison, trend, or a metric that benefits from shape. | Skip if there is no trend story or if the number is one-off. | Side chart, inset chart, or full small card. | Subtle, medium, hero. | Slightly longer than a plain stat card. | Graph line, bar set, axis hint, or glow point. |
| Image reference card | Entity mention with a known visual, product, place, or reference image. | Avoid if the asset search is weak or likely to distract. | Sidecall, lower third, or small reference plate. | Editorial, compact, premium. | Fast enough to support the line, not overpower it. | Image, citation line, label, or corner badge. |
| Icon support badge | Supporting concept, small reinforcement, or a low-stakes entity reference. | Do not use when the cue needs a full card. | Corner, inline edge, or side badge. | Soft, subtle. | Very quick accent timing. | Icon, badge frame, or small label. |
| Chapter divider | Timeline/year, section shift, or a strong structural turn. | Avoid for minor transitions or when the speech pace is too fast. | Full width, center band, or edge-to-edge rule. | Subtle divider, strong divider, hero divider. | Short to medium, with a clean exit. | Divider line, chapter title, year marker. |
| Listed-versus card | List of items, steps, compare-and-contrast structure, or process language. | Skip if the list is not actually structured or only has one item. | Split panel, stacked rows, or side-by-side contrast. | Compact, medium, hero. | Enough breathing room to show structure. | Numbered rails, boxes, or split panels. |
| CTA card | Direct viewer instruction at the end of a point or section. | Avoid if the tone is too early or too soft to justify it. | Lower third, end card, or full lower band. | Soft ask, firm ask, hard ask. | Late beat, or immediately after the payoff. | Button frame, arrow, badge, or prompt text. |
| Background texture takeover | Strong beat, mood reset, or a punchline that can tolerate a bigger atmosphere shift. | Avoid if the face is crowded or if other foreground elements are already heavy. | Full frame background, edge wash, or texture bed. | Low, medium, high. | Longer than a tiny accent, but still respectful of speech. | Texture plate, grain, blur wash, or light leak. |
| Ambient accent flair | Low-priority emphasis, breathing space, or a gentle design cue. | Do not use when the scene is already visually busy. | Periphery, corner, or edge glow. | Whisper, soft. | Very short and non-blocking. | Small flare, glow dust, or faint accent line. |

## Video Grading Brain

### Core grading intent
- The grading layer should make the footage feel clearer, richer, and more cinematic without looking cooked.
- The engine should treat grading as a controlled finishing decision, not a random filter pass.
- The speaker must still feel natural; perceived sharpness and premium polish matter more than dramatic stylization.

### Base recipe: Clear Sky cinematic polish
- Shadow: `+26`
- Saturation: `+5`
- Filter: `Clear Sky`
- Filter intensity: `+88`
- Vignette: `-83`
- Tone: `+21`
- Contrast: `+3`
- Intended feel: open shadows, slightly richer color, brighter tonal separation, reduced corner heaviness, and a crisp pseudo-4K finish.

### Why this recipe matters
- The shadow lift opens the face and clothing detail instead of letting the shot sit muddy.
- The saturation bump is deliberately small so the frame feels richer without turning skin radioactive.
- The strong `Clear Sky` push is doing most of the cinematic polish work.
- The negative vignette is important here: even if vignette is usually nice, this recipe wants a more open, less boxed-in frame.
- The tone lift plus light contrast increase should create cleaner separation before the frame starts to feel harsh.

### Trigger conditions
- Talking-head footage that feels a bit flat, compressed, muddy, or lower-end than the desired premium look.
- Footage where the face is readable but the image still needs more perceived depth and finish.
- Long-form speaker clips where the engine wants clarity and polish more than aggressive mood stylization.

### Contraindications
- Already heavily graded footage with crushed highlights or neon color response.
- Shots with visible shadow noise; lifting shadows too hard may expose compression or sensor mess.
- Clips where the frame is already too bright, too airy, or too washed out.
- Very dark moody scenes where removing vignette pressure would kill the intended atmosphere.

### Implementation rules
- Treat this as a base preset, not a universal law.
- Apply it as the default premium-clean grading candidate when the footage needs uplift but not a dramatic color identity shift.
- Preserve skin realism first; if skin starts looking synthetic, reduce filter intensity before reducing everything else.
- If the footage is noisy in the blacks, back off the shadow lift before touching tone or contrast.
- If the frame feels too empty after `vignette -83`, reintroduce only a light finishing vignette rather than restoring a heavy dark edge.
- If highlights begin to feel brittle, reduce tone before reducing saturation.

### Intensity variants
- Light polish: shadow `+16 to +20`, saturation `+3`, clear sky `+55 to +70`, vignette `-45 to -60`, tone `+12 to +16`, contrast `+2`.
- Default polish: shadow `+26`, saturation `+5`, clear sky `+88`, vignette `-83`, tone `+21`, contrast `+3`.
- Assertive polish: shadow `+28 to +32`, saturation `+6`, clear sky `+90 to +96`, vignette `-70 to -85`, tone `+22 to +26`, contrast `+4 to +5`.

### Ordering rules
- Open the shadows first.
- Then set the overall filter identity.
- Then reduce vignette pressure.
- Then fine-tune tone.
- Then finish with a very light contrast correction.
- Saturation stays small and should not become the main source of perceived quality.

### Risk governors for grading
- Noise risk: if shadow lift reveals ugly compression, downshift the preset immediately.
- Skin risk: if skin tone starts glowing unnaturally, reduce filter intensity first.
- Highlight brittleness risk: if bright regions start clipping or looking glassy, lower tone before lowering contrast.
- Atmosphere risk: if a dramatic scene loses emotional weight, restore some edge density and stop chasing the pseudo-4K feel.
- Over-processing risk: if the grade becomes the first thing you notice, it is too much.

### Working default for engine translation
- Give this preset a working identity such as `clear-sky-polish`.
- Use it as a premium-clean grade option inside the grading brain, especially for long-form speaker-led footage.
- Treat the target result as "clearer and more cinematic," not literally guaranteed 4K.

## Risk Governors
- Screen pressure: treat the frame as crowded when there is already a major card, subtitles, and another foreground cue competing for the same view.
- Face obstruction risk: never let the cue sit on top of the speaker's face or the most face-dominant region of the frame.
- Subtitle conflict: avoid placements that collide with the caption zone or force the viewer to choose between reading the cue and reading the transcript.
- Timing pressure: if there is not enough breathing room, prefer a small accent, then a smaller card, then suppress the cue entirely.
- Visual clutter risk: downshift when more than one dominant foreground element wants the same beat.
- Safe-zone heuristic: if no face map exists, bias major text below the midline, roughly 10 percent lower than the midpoint, and push it toward the bottom third when the speaker is centered.
- Cleanup rule: if the cue can be expressed as an underline, badge, or small callout instead of a full-screen move, prefer the smaller form first.
- Priority rule: the speaker always wins, then subtitles, then the cue, then ambient flair.

## Working Defaults For Later Calibration
- Strong trigger threshold: 90 and above.
- Safe candidate threshold: 80 to 89 when the frame is breathable.
- Light candidate threshold: 70 to 79 when the cue is useful but not urgent.
- Suppress threshold: below 70 unless the scene is extremely clean.
- Major card timing floor: roughly 900 ms of breathing room.
- Full background treatment timing floor: roughly 1300 ms of breathing room.
- Small accent timing floor: roughly 500 ms of breathing room.

## Open Calibration Notes
- We should decide whether "Eve typography" stays as a human alias only or eventually becomes a code-level rename.
- We should decide which cue classes stay inside the selective sidecall brain and which ones deserve their own dedicated treatment packs.
- We should decide how aggressive repeated phrase emphasis should be before it starts to feel like noise.
- We should decide whether quote handling should prefer explicit quote markers, attribution, or both.
- We should decide how often entity mentions should trigger asset research versus staying text-only.
- We should decide whether timeline/year mentions should prefer chapter dividers or lighter year stamps when the frame is busy.
- We should decide how much of the motion library should be text-first versus asset-first.
- We should decide whether this grading recipe becomes the default long-form premium-clean preset or stays as an optional branch inside the grading brain.

## 3D Camera Layering Brain

### Core intent
- Treat 3D as an editorial compositing tool, not a game engine.
- The camera is a storyteller. Depth exists to guide attention.
- Most motion still happens in 2D layers; 3D is for premium emphasis moments.

### System split (what runs where)
- Lightweight motion layer: GSAP + CSS transforms for most text/cards/overlays.
- Scene choreography layer: GSAP timelines for multi-object sequencing.
- Depth layer: Three.js only for parallax, camera drift, and staged focus moments.

### Trigger conditions
- Use 3D when a scene needs depth staging: comparison panels, quote cards, stat callouts, or person references.
- Prefer 3D when a camera cue exists or a focus target is clearly defined.
- If the scene already has strong 2D motion, keep 3D subtle or skip it.

### Contraindications
- Avoid 3D on fast, dense segments where legibility would drop.
- Avoid aggressive rotations or large camera moves.
- Skip 3D when assets are missing or screen pressure is already high.

### Camera motion rules
- Default: subtle push-in or gentle drift.
- Only allow wider pans for comparisons.
- Keep max rotation under 3-4 degrees.
- Maintain readable scale; no steep perspective on text.

### Depth staging rules
- Background: soft texture or backing plate, low opacity, low parallax.
- Mid: cards, panels, supporting assets.
- Foreground: focus text or key card, highest opacity.

### Parallax & sequencing
- Foreground moves more than mid; mid more than background.
- Parallax must feel deliberate, never jittery.
- Text reveals should happen before the heaviest camera move.

### Preset families
- `subtlePushIn`
- `subtlePullBack`
- `comparisonPan`
- `focusDriftLeft`
- `focusDriftRight`
- `quoteRevealCameraEase`
- `cardDepthSlide`
- `parallaxHold`
- `heroLayerPush`
- `gentleOrbit`

### Safety governors
- If text is at risk of distortion, reduce camera motion first.
- If the frame feels busy, reduce depth spread and drop far layers.
- If the viewer could lose focus, lock the camera and let only the foreground breathe.

### Implementation notes
- Use GSAP timelines for sequencing; avoid per-element scattered tweens.
- Use Three.js for planes in depth; keep geometry simple.
- Prefer transform/opacity; avoid layout-based animation.
- Provide a feature flag so 3D can be disabled per composition.

## Scene Choreography Brain

### Core intent
- The motion system should direct the scene, not merely animate isolated assets.
- Text, cards, overlays, and depth all answer to one sequence.
- The premium feel comes from relation, order, and continuity.

### Scene classes
- `comparison`
- `quote`
- `stat`
- `feature-highlight`
- `cta`

### Preset behavior
- Comparison: panel-first entry, labels second, camera sweep laterally, focus carries across states.
- Quote: quote block leads, support accent follows, camera drift stays mild.
- Stat: value or numeric phrase leads, support object trails, shallow push-in reinforces the number.
- Feature highlight: headline leads, object enters in relation to headline, subtle depth slide.
- CTA: message leads, support object follows, hold time is slightly longer and calmer.

### Continuity rules
- Entering elements may settle into a held anchor instead of disappearing immediately.
- The next scene may inherit a reduced form of the prior camera offset.
- If a focus object matters in scene A, scene B may borrow part of that offset to avoid a hard reset.

### Primitive registry
- `typewriter`
- `blur-reveal`
- `highlight-word`
- `circle-reveal`

### Primitive policy
- These primitives are generic and reusable.
- They should not be welded to one scene type.
- The external HTML prototypes can later be translated into typed React/GSAP components without changing preset logic.

### Preview parity rule
- Native preview does not need full WebGL parity.
- It must preserve ordering, depth implication, camera drift, and object holding behavior with a lightweight approximation.
- Turbo preview may skip the heavier approximation, but balanced/full preview should stay directionally truthful.



