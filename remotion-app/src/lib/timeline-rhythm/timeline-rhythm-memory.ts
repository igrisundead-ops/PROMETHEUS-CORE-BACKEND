import { TimelineRhythmState } from "./timeline-rhythm-engine";

class TimelineRhythmMemory {
  private history: TimelineRhythmState[] = [];
  private readonly MAX_HISTORY = 10;

  record(state: TimelineRhythmState) {
    this.history.push(state);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }
  }

  getHistory() {
    return [...this.history];
  }

  isRepetitive(): boolean {
    if (this.history.length < 3) return false;
    const last3 = this.history.slice(-3);
    const firstImpact = last3[0].impactDelayFrames;
    return last3.every(h => h.impactDelayFrames === firstImpact);
  }
}

export const rhythmMemory = new TimelineRhythmMemory();
