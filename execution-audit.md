# Phase 1: Execution Trace Audit

| FIELD | GENERATED? | CONSUMED? | RUNTIME EFFECT? | PIXEL EFFECT? | REAL or THEATER? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| placementPlan.strategy | Yes (VisualFieldEngine) | No | None | None | **THEATER** |
| placementPlan.coordinates | Yes (VisualFieldEngine) | No | None | None | **THEATER** |
| breathingSpaceFactor | Yes (VisualFieldEngine) | No | None | None | **THEATER** |
| opacityMultiplier | Yes (VisualFieldEngine) | Yes (CSS Var) | Partial | Yes (Opacity change) | **REAL** (but weak) |
| scaleModifier | Yes (VisualFieldEngine) | Yes (EditorialEngine) | Yes | Yes (Size change) | **REAL** |
| shotType | Yes (VisualFieldEngine) | Yes (VisualFieldEngine) | Yes (Modifies scale) | Yes (Size change) | **REAL** |
| dominanceStrategy | Yes (VisualFieldEngine) | No | None | None | **THEATER** |
| cameraMotionEnergy | Yes (Mock CV) | Yes (MotionSync) | None (MotionSync ignored) | None | **THEATER** |
| visualComplexityScore| Yes (Mock CV) | Yes (Opacity Mod) | Yes | Yes | **REAL** |
| eyeGravityMap | Yes (VisualFieldEngine) | Yes (PlacementPlan)| None (Placement ignored) | None | **THEATER** |
| fontRoleQuery | Yes (SeqDirector) | No (Orphaned) | None | None | **THEATER** |
| compatibilityRelationships| Yes (Graph) | No | None | None | **THEATER** |
| semanticReductionAllowed| Yes (SeqDirector) | Yes (SemanticEngine) | Yes | Yes (Line breaks) | **REAL** |

## Conclusion
The renderer is ignoring `placementPlan` and `motionSynchronizationPlan`. The `SequenceDirector` font queries are entirely orphaned. We must wire these directly into `NativePreviewStage` and the Font Resolver immediately.