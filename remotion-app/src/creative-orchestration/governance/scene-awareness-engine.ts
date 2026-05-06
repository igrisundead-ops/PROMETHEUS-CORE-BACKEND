import type { CreativeMoment } from "../types";

export type Scene = {
  id: string;
  moments: CreativeMoment[];
  startMs: number;
  endMs: number;
  dominantMomentType: string;
};

export class SceneAwarenessEngine {
  private scenes: Scene[] = [];

  analyze(moments: CreativeMoment[]): Scene[] {
    const scenes: Scene[] = [];
    let currentScene: Scene | null = null;

    for (const moment of moments) {
      if (!currentScene || this.isNewScene(moment, currentScene)) {
        currentScene = {
          id: `scene-${scenes.length}`,
          moments: [moment],
          startMs: moment.startMs,
          endMs: moment.endMs,
          dominantMomentType: moment.momentType,
        };
        scenes.push(currentScene);
      } else {
        currentScene.moments.push(moment);
        currentScene.endMs = moment.endMs;
      }
    }

    this.scenes = scenes;
    return scenes;
  }

  private isNewScene(moment: CreativeMoment, currentScene: Scene): boolean {
    // 1. Large gap between moments
    if (moment.startMs - currentScene.endMs > 2000) {
      return true;
    }

    // 2. Strong transition moment
    if (moment.momentType === "transition") {
      return true;
    }

    // 3. Significant energy shift
    const avgEnergy = currentScene.moments.reduce((sum, m) => sum + m.energy, 0) / currentScene.moments.length;
    if (Math.abs(moment.energy - avgEnergy) > 0.5) {
      return true;
    }

    return false;
  }

  getSceneForMoment(momentId: string): Scene | undefined {
    return this.scenes.find((s) => s.moments.some((m) => m.id === momentId));
  }
}
