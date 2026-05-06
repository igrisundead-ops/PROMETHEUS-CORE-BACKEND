import type { DeviationType } from "../types";

export type CreatorIdentity = "iman" | "codie" | "apple" | "documentary";

export class CreatorIdentityEngine {
  private identity: CreatorIdentity;

  constructor(identity: CreatorIdentity = "codie") {
    this.identity = identity;
  }

  getBias(): Record<string, number> {
    switch (this.identity) {
      case "iman":
        return { aggressionBias: 1.2, motionBias: 1.1, silenceBias: 0.8 };
      case "codie":
        return { aggressionBias: 1.0, motionBias: 0.9, silenceBias: 1.1 };
      case "apple":
        return { aggressionBias: 0.7, motionBias: 0.7, silenceBias: 1.5 };
      case "documentary":
        return { aggressionBias: 0.5, motionBias: 0.5, silenceBias: 1.3 };
      default:
        return { aggressionBias: 1.0, motionBias: 1.0, silenceBias: 1.0 };
    }
  }

  getPreferredDeviation(): DeviationType {
    switch (this.identity) {
      case "iman":
        return "dominance-reversal";
      case "codie":
        return "rhythm-snap";
      case "apple":
        return "typography-fragility";
      case "documentary":
        return "motion-collapse";
      default:
        return "rhythm-snap";
    }
  }

  getIdentityLabel(): string {
    return this.identity;
  }
}
