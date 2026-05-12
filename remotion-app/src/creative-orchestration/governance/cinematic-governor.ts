import type { CreativeMoment, CreativeContext } from "../types";
import type { GlobalContextState, GovernorResolution, SubsystemProposal } from "./types";
import { CinematicStateMachine } from "./cinematic-state-machine";
import { SceneAwarenessEngine } from "./scene-awareness-engine";
import { EmotionalContinuityEngine } from "./emotional-continuity-engine";
import { LongformStabilityEngine } from "./longform-stability-engine";
import { CinematicGroundingEngine } from "./cinematic-grounding-engine";
import { RenderBudgetGovernor } from "./render-budget-governor";
import { EditorialRestraintGovernor } from "./editorial-restraint-governor";
import { CinematicDecisionGraph } from "./cinematic-decision-graph";
import { CinematicExplainability } from "./cinematic-explainability";
import { ControlledDeviationEngine } from "./deviation/controlled-deviation-engine";

export class CinematicGovernor {
  private stateMachine = new CinematicStateMachine();
  private sceneEngine = new SceneAwarenessEngine();
  private continuityEngine = new EmotionalContinuityEngine();
  private stabilityEngine = new LongformStabilityEngine();
  private groundingEngine = new CinematicGroundingEngine();
  private budgetGovernor = new RenderBudgetGovernor();
  private restraintGovernor = new EditorialRestraintGovernor();
  private decisionGraph = new CinematicDecisionGraph();
  private deviationEngine = new ControlledDeviationEngine();

  private globalState: GlobalContextState;

  constructor(initialStartTime: number = 0) {
    this.globalState = {
      activeState: this.stateMachine.getCurrentState(),
      unresolvedTension: 0,
      escalationMomentum: 0,
      emotionalExhaustion: 0,
      vulnerabilityPersistence: 0,
      pacingSaturation: 0,
      renderComplexity: 0,
      recentTreatments: [],
      surpriseBudget: 3,
      expectations: {
        recentAggressionAverage: 0.5,
        recentMotionAverage: 0.5,
        recentSilenceAverage: 0.5,
        recentDominanceAverage: 0.5,
        recentScaleAverage: 0.5,
        recentAsymmetryDirection: "center",
        asymmetryPersistenceCount: 0,
        restraintPersistenceCount: 0,
        pacingPredictability: 0,
      },
    };
  }

  govern(
    moments: CreativeMoment[],
    subsystemProposalsByMoment: Map<string, SubsystemProposal[]>
  ): GovernorResolution[] {
    const resolutions: GovernorResolution[] = [];
    
    // 1. Analyze Scenes
    this.sceneEngine.analyze(moments);

    // 2. Stateful Forward Pass
    for (const moment of moments) {
      const sourceProposals = subsystemProposalsByMoment.get(moment.id) ?? [];
      
      // Update State Machine
      this.globalState.activeState = this.stateMachine.transition(moment, this.globalState);

      // Apply Governance Chain
      let proposals = [...sourceProposals];
      
      proposals = this.groundingEngine.enforceProportionality(moment, proposals);
      proposals = this.stabilityEngine.stabilize(moment, proposals, this.globalState);
      proposals = this.restraintGovernor.applyRestraint(moment, proposals, this.globalState);
      proposals = this.budgetGovernor.govern(proposals, this.globalState);

      // Resolve Conflicts
      let resolution = this.decisionGraph.resolve(moment.id, proposals, this.globalState.activeState);

      // 4. Deviation Pass
      const deviationResult = this.deviationEngine.evaluate(resolution, this.globalState.activeState, this.globalState.expectations);
      resolution = deviationResult.resolution;
      resolution.deviation = deviationResult.deviation;

      // Generate Explanation
      resolution.explainability = CinematicExplainability.generateReport(resolution, proposals);
      
      resolutions.push(resolution);

      // Update Emotional Continuity & Global State
      const continuityUpdates = this.continuityEngine.update(moment, proposals, this.globalState);
      const complexity = this.budgetGovernor.calculateNewComplexity(this.globalState.renderComplexity, proposals);
      const saturation = this.stabilityEngine.updateGlobalPacing(moment, this.globalState);
      const updatedExpectations = this.deviationEngine.updateExpectations(resolution);

      this.globalState = {
        ...this.globalState,
        ...continuityUpdates,
        renderComplexity: complexity,
        pacingSaturation: saturation,
        surpriseBudget: this.deviationEngine.getBudget(),
        expectations: updatedExpectations,
      };
    }

    return resolutions;
  }

  getAuditLog(): string[][] {
    // Collect all explainability reports for system-wide audit
    return []; // Implementation of persistent audit log would go here
  }
}
