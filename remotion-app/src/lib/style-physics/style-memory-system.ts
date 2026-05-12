export type CinematicAction = {
  strategy: string;
  motionEnergy: string;
  fontFamily: string;
  scale: number;
  quadrantIndex: number;
};

export class SequenceTasteHistory {
  private history: CinematicAction[] = [];
  private readonly maxHistory = 10;

  record(action: CinematicAction) {
    this.history.push(action);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  isRepetitive(action: CinematicAction): { repetitive: boolean; reason?: string } {
    if (this.history.length === 0) return { repetitive: false };

    const last = this.history[this.history.length - 1];

    // Check for "Center Stack Syndrome"
    const recentCenterCount = this.history.slice(-3).filter(h => h.strategy === "center").length;
    if (action.strategy === "center" && recentCenterCount >= 2) {
      return { repetitive: true, reason: "center-stack-syndrome-detected" };
    }

    // Check for repetitive motion energy
    const recentMotionCount = this.history.slice(-3).filter(h => h.motionEnergy === action.motionEnergy).length;
    if (recentMotionCount >= 3) {
      return { repetitive: true, reason: `motion-energy-monotony-${action.motionEnergy}` };
    }

    // Check for repetitive quadrant occupancy
    const recentQuadrantCount = this.history.slice(-4).filter(h => h.quadrantIndex === action.quadrantIndex).length;
    if (recentQuadrantCount >= 3) {
      return { repetitive: true, reason: "spatial-quadrant-monotony" };
    }

    return { repetitive: false };
  }

  getRecentAverages() {
    if (this.history.length === 0) return { scale: 1.0 };
    const sumScale = this.history.reduce((acc, h) => acc + h.scale, 0);
    return {
      scale: sumScale / this.history.length
    };
  }
}

// Global instance for sequence session
export const sequenceTasteHistory = new SequenceTasteHistory();
