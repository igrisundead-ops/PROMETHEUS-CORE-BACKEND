import {buildSpatialConstraints} from "../rules/spatial-constraints";
import {judgmentEngineInputSchema, type JudgmentEngineInput, type SpatialConstraints} from "../types";

export class FrameConstraintEngine {
  evaluate(input: JudgmentEngineInput): SpatialConstraints {
    const parsed = judgmentEngineInputSchema.parse(input);
    return buildSpatialConstraints(parsed);
  }
}
