import type { CinematicState, CinematicStateKind, GlobalContextState } from "./types";
import type { CreativeMoment } from "../types";

export class CinematicStateMachine {
  private currentState: CinematicState;

  constructor(initialStartTime: number = 0) {
    this.currentState = {
      kind: "observational",
      intensity: 0.5,
      startTimeMs: initialStartTime,
      durationMs: 0,
      rationale: "Initial default state.",
    };
  }

  transition(moment: CreativeMoment, globalState: GlobalContextState): CinematicState {
    const nextKind = this.determineNextState(moment, globalState);
    
    if (nextKind !== this.currentState.kind) {
      this.currentState = {
        kind: nextKind,
        intensity: moment.energy,
        startTimeMs: moment.startMs,
        durationMs: moment.endMs - moment.startMs,
        rationale: `Transitioned to ${nextKind} based on moment energy (${moment.energy}) and importance (${moment.importance}).`,
      };
    } else {
      this.currentState.durationMs += (moment.endMs - moment.startMs);
    }

    return this.currentState;
  }

  private determineNextState(moment: CreativeMoment, globalState: GlobalContextState): CinematicStateKind {
    // 1. High energy + High importance -> Explosive or Confrontational
    if (moment.energy > 0.8 && moment.importance > 0.8) {
      return "explosive";
    }

    // 2. High importance + Low energy -> Vulnerable or Meditative
    if (moment.importance > 0.7 && moment.energy < 0.4) {
      return globalState.emotionalExhaustion > 0.6 ? "meditative" : "vulnerable";
    }

    // 3. Recovery from Explosive
    if (this.currentState.kind === "explosive" && moment.energy < 0.6) {
      return "recovery";
    }

    // 4. Transitional
    if (moment.momentType === "transition") {
      return "transitional";
    }

    // 5. Default
    return "observational";
  }

  getCurrentState(): CinematicState {
    return this.currentState;
  }
}
