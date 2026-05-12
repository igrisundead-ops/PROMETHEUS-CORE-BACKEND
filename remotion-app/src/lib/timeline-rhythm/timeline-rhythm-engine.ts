export type TimelineRhythmState = {
  impactDelayFrames: number;
  cadenceCompression: number;
  anticipationWindow: number;
  emotionalPauseDuration: number;
  silencePressure: number;
  escalationCurve: number;
  releaseCurve: number;
  tensionCurve: number;
  visualRecoveryTime: number;
  rhythmAggression: number;
  holdDurationFrames: number;
  interruptionMoments: boolean;
  restraintMoments: boolean;
  impactFramePriority: number;
  emotionalDecayCurve: number;
  viewerBreathingWindow: number;
  rationale: string[];
};

export type TimelineRhythmInput = {
  transcriptTiming: { startMs: number; endMs: number };
  transcriptCadence: number; // words per second
  semanticDensity: number; // importance of words
  emotionalIntensity: number;
  silenceWindows: Array<{ startMs: number; endMs: number }>;
  speakerDeliverySpeed: number;
  musicBeatMap: number[]; // timestamps of beats
  waveformEnergy: number;
  cameraMotionEnergy: number;
  sceneTransitions: number[]; // timestamps
  previousRhythmHistory: any[];
  pacingFatigue: number;
  attentionFatigue: number;
  visualComplexity: number;
  shotContinuity: number;
};

import { calculateTemporalTension } from "./temporal-tension-engine";
import { analyzeCadence } from "./cadence-intelligence-engine";
import { synchronizeMusic } from "./music-synchronization-engine";
import { rhythmMemory } from "./timeline-rhythm-memory";
import { evaluateViewerFatigue } from "./viewer-fatigue-engine";
import { applyCinematicEmpathy } from "./cinematic-empathy-engine";
import { exerciseEditorialCourage } from "./editorial-courage-engine";
import { applyHumanImperfection } from "./human-rhythm-imperfection";

export const resolveTimelineRhythm = (input: TimelineRhythmInput): TimelineRhythmState => {
  const {
    transcriptTiming,
    emotionalIntensity,
    pacingFatigue,
    attentionFatigue,
    visualComplexity
  } = input;

  // 1. Cadence & Tension
  const cadence = analyzeCadence({
    deliverySpeed: input.speakerDeliverySpeed,
    emotionalIntensity
  });

  const tension = calculateTemporalTension({
    emotionalIntensity,
    cadenceScore: cadence.cadenceScore,
    history: input.previousRhythmHistory
  });

  // 2. Music & Fatigue
  const music = synchronizeMusic({
    beatMap: input.musicBeatMap,
    waveformEnergy: input.waveformEnergy,
    currentTimeMs: transcriptTiming.startMs
  });

  const fatigue = evaluateViewerFatigue({
    pacingFatigue,
    attentionFatigue,
    visualComplexity
  });

  // 3. Empathy & Courage
  const empathy = applyCinematicEmpathy({
    speakerEmotion: "neutral", // Mocked for now
    subjectEnergy: input.waveformEnergy,
    visualChaos: visualComplexity
  });

  const courage = exerciseEditorialCourage({
    importance: input.semanticDensity,
    tensionScore: tension.tensionScore,
    fatigueScore: fatigue.fatigueScore
  });

  // 4. Final Rhythm Synthesis
  const baseAggression = (emotionalIntensity * 0.6) + (cadence.cadenceScore * 0.4);
  const rhythmAggression = Math.max(0, baseAggression - (fatigue.fatigueScore * 0.3) - (courage.restraintScore * 0.5));

  const state: TimelineRhythmState = {
    impactDelayFrames: Math.round(music.syncOffsetFrames + (tension.tensionScore * 5) + empathy.timingOffset),
    cadenceCompression: 1.0 + (rhythmAggression * 0.2),
    anticipationWindow: 150 * tension.tensionScore,
    emotionalPauseDuration: 300 * empathy.breathingRoom,
    silencePressure: tension.tensionScore * (1 - courage.restraintScore),
    escalationCurve: tension.escalation,
    releaseCurve: 1 - tension.tensionScore,
    tensionCurve: tension.tensionScore,
    visualRecoveryTime: 200 * fatigue.fatigueScore,
    rhythmAggression,
    holdDurationFrames: Math.round(10 * (1 + rhythmAggression)),
    interruptionMoments: cadence.isInterrupted,
    restraintMoments: courage.shouldUnderplay,
    impactFramePriority: music.beatStrength * (1 - fatigue.fatigueScore),
    emotionalDecayCurve: 0.8 * (1 - rhythmAggression),
    viewerBreathingWindow: 500 * fatigue.fatigueScore,
    rationale: [
      ...cadence.rationale,
      ...tension.rationale,
      ...music.rationale,
      ...fatigue.rationale,
      ...empathy.rationale,
      ...courage.rationale
    ]
  };

  // 5. Apply Human Imperfection
  const finalState = applyHumanImperfection(state);

  // 6. Record in Memory
  rhythmMemory.record(finalState);

  return finalState;
};
