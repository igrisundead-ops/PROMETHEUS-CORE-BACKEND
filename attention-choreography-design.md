# Phase 4 & 8: Attention Choreography & Silence Engine

The system currently processes chunks sequentially but forgets state. We must build `SequenceAttentionState` to track dominance fatigue across a scene.

## State Tracking
- `consecutiveAggressiveMoments`: How many hooks in a row?
- `timeSinceLastSilence`: When did the screen last breathe?
- `averageIntensity`: What is the running energy level?

## Suppress Typography Logic (Silence Engine)
If `timeSinceLastSilence > 10s` and we encounter a `pause` moment or a very slow `expansion`, the Engine must flag `suppressCaptions = true` to allow the footage/speaker to dominate completely. 

This state engine will be injected into `orchestrateSequence`.
