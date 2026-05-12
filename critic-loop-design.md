# Phase 6 & 9: Real Critic Loop & Validation Pipeline

The goal is to stop trusting first-pass generation and to enforce an `inspect -> critique -> revise` loop. Since we operate inside a headless CLI generation context, we cannot run full WebGL Chrome headless captures easily *during* the sub-millisecond orchestrator loop. 

## Architectural Pivot
Instead of generating a JSON plan and praying it renders well, the Engine will generate multiple **Candidates** and run a mock spatial validation pass over them before returning the final decision. 

**True Runtime Spatial Validation:**
1. Given a chunk of words, font string, and size multiplier, estimate the physical bounding box `(x, y, w, h)`.
2. Given a mock `faceBoundingBox` from the visual field.
3. Determine `intersectionArea`.
4. If `intersectionArea > 0`, the candidate is rejected (restrained). 

We will implement this validation directly in the Sequence Director / Editorial Engine. 
