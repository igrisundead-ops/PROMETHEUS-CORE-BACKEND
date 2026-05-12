import type { 
  GovernorResolution, 
  CinematicState, 
  CinematicExpectations, 
  DeviationResult,
  DeviationType 
} from "../types";
import { ExpectationMemoryEngine } from "./expectation-memory-engine";
import { DeviationScoringEngine } from "./deviation-scoring-engine";
import { SurpriseBudgetEngine } from "./surprise-budget-engine";
import { CreatorIdentityEngine } from "./creator-identity-engine";
import { CinematicCourageEngine } from "./cinematic-courage-engine";
import { AntiOverdesignEngine } from "./anti-overdesign-engine";
import { OpticalHumanizationEngine } from "./optical-humanization-engine";

export class ControlledDeviationEngine {
  private expectationEngine = new ExpectationMemoryEngine();
  private scoringEngine = new DeviationScoringEngine();
  private budgetEngine = new SurpriseBudgetEngine();
  private identityEngine = new CreatorIdentityEngine();
  private courageEngine = new CinematicCourageEngine();
  private antiOverdesignEngine = new AntiOverdesignEngine();
  private humanizationEngine = new OpticalHumanizationEngine();

  evaluate(
    resolution: GovernorResolution,
    state: CinematicState,
    expectations: CinematicExpectations
  ): { resolution: GovernorResolution; deviation: DeviationResult | null } {
    
    // 1. Scoring
    const scoringInput = {
      emotionalNecessity: state.intensity,
      tensionSaturation: state.intensity > 0.8 ? 0.9 : 0.4, // Simplified proxy
      audienceAdaptation: expectations.pacingPredictability > 0.7 ? 0.8 : 0.3,
      pacingPredictability: expectations.pacingPredictability,
      visualFatigue: 0.2, // Placeholder
      climaxProximity: state.kind === "explosive" ? 0.8 : 0.2,
      isVulnerable: state.kind === "vulnerable",
    };

    const scoring = this.scoringEngine.score(scoringInput);
    
    // 2. Courage Check (Risky but not necessarily a "deviation" from rules, more of an extreme application)
    const courageResult = this.courageEngine.allowRiskyDecision(resolution, state);
    let finalResolution = courageResult.resolution;

    // 3. Anti-Overdesign Pass
    const overdesignResult = this.antiOverdesignEngine.detect(finalResolution, state);
    finalResolution = overdesignResult.simplifiedResolution;

    // 4. Deviation Triggering
    let finalDeviation: DeviationResult | null = null;
    if (scoring.permitted && this.budgetEngine.hasBudget()) {
      const type = this.identityEngine.getPreferredDeviation();
      const deviationResult = this.applyDeviation(type, finalResolution, expectations);
      
      if (deviationResult.permitted) {
        this.budgetEngine.consume();
        finalResolution = deviationResult.updatedResolution;
        finalDeviation = { 
          type: deviationResult.type, 
          score: scoring.score, 
          permitted: true, 
          rationale: deviationResult.rationale 
        };
      }
    }

    // 5. Optical Humanization (Final Pass)
    finalResolution = this.humanizationEngine.apply(finalResolution);

    return { resolution: finalResolution, deviation: finalDeviation };
  }

  private applyDeviation(
    type: DeviationType,
    resolution: GovernorResolution,
    expectations: CinematicExpectations
  ): { type: DeviationType; updatedResolution: GovernorResolution; permitted: boolean; rationale: string } {
    const updated = { ...resolution };
    let rationale = "";
    let permitted = false;

    switch (type) {
      case "dominance-reversal":
        // If recently restrained, detonate
        if (expectations.recentDominanceAverage < 0.4) {
          updated.finalDominance = 1.0;
          updated.finalScale = 1.5;
          updated.finalAggression = 1.0;
          rationale = "Deviation: Dominance Reversal (detonating after prolonged restraint).";
          permitted = true;
        }
        break;

      case "rhythm-snap":
        // Intentionally delay timing
        updated.finalTiming = 300; // 300ms delay
        rationale = "Deviation: Rhythm Snap (intentional timing delay to break predictability).";
        permitted = true;
        break;

      case "motion-collapse":
        // Suddenly remove motion after high energy
        if (expectations.recentMotionAverage > 0.7) {
          updated.finalMotion = 0.0;
          rationale = "Deviation: Motion Collapse (sudden stillness after high-energy motion).";
          permitted = true;
        }
        break;

      case "typography-fragility":
        // Break visual hierarchy for vulnerability
        updated.finalScale = 0.4;
        updated.finalOpacity = 0.6;
        updated.finalAggression = 0.1;
        rationale = "Deviation: Typography Fragility (intentional weakness for emotional resonance).";
        permitted = true;
        break;
      
      default:
        break;
    }

    return { type, updatedResolution: updated, permitted, rationale };
  }

  updateExpectations(resolution: GovernorResolution): CinematicExpectations {
    return this.expectationEngine.update(resolution);
  }

  getBudget(): number {
    return this.budgetEngine.getRemainingBudget();
  }
}
