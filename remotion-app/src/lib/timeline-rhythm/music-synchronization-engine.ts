export type MusicInput = {
  beatMap: number[];
  waveformEnergy: number;
  currentTimeMs: number;
};

export type MusicOutput = {
  syncOffsetFrames: number;
  beatStrength: number;
  rationale: string[];
};

export const synchronizeMusic = (input: MusicInput): MusicOutput => {
  const { beatMap, waveformEnergy, currentTimeMs } = input;
  
  if (beatMap.length === 0) return { syncOffsetFrames: 0, beatStrength: 0, rationale: ["NO MUSIC DATA"] };

  // Find closest beat
  const closestBeat = beatMap.reduce((prev, curr) => 
    Math.abs(curr - currentTimeMs) < Math.abs(prev - currentTimeMs) ? curr : prev
  );

  const diffMs = closestBeat - currentTimeMs;
  const diffFrames = Math.round((diffMs / 1000) * 30); // Assume 30fps for engine calc

  // Decision: Align, Counter-Sync, or Drift
  let syncOffsetFrames = 0;
  let logic = "drift";

  if (waveformEnergy > 0.8 && Math.abs(diffFrames) < 10) {
    syncOffsetFrames = diffFrames;
    logic = "snap-to-beat";
  } else if (waveformEnergy < 0.3) {
    syncOffsetFrames = diffFrames + 5; // Intentional delay
    logic = "emotional-drift";
  }

  return {
    syncOffsetFrames,
    beatStrength: waveformEnergy,
    rationale: [
      `MUSIC SYNC: ${logic}`,
      Math.abs(diffFrames) < 2 ? "FRAME-PERFECT BEAT ALIGNMENT" : "RHYTHMIC ASYMMETRY"
    ]
  };
};
