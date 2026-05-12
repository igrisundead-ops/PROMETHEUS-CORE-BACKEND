export type MotionPhysics = {
  velocity: number;
  damping: number;
  anticipation: number;
  exitDecay: number;
  opacityAcceleration: number;
  blurRelease: number;
  scaleInertia: number;
  motionAggression: number;
  cadenceDensity: number;
  cinematicDrag: number;
  silenceTension: number;
  easing: string; // Dynamic bezier or spring string
  durationMs: number;
};

export type MotionCompositionInput = {
  aggression: number; // 0 to 1
  restraint: number; // 0 to 1
  emotionalIntensity: number; // 0 to 1
  cinematicDrift: number; // 0 to 1
  dominance: number; // 0 to 1
  anticipationDelay: number; // 0 to 1
  cameraMotionEnergy: "static" | "calm" | "aggressive" | "handheld" | "cinematic-glide";
};

export const composeMotionPhysics = (input: MotionCompositionInput): MotionPhysics => {
  const {
    aggression,
    restraint,
    emotionalIntensity,
    cinematicDrift,
    dominance,
    anticipationDelay,
    cameraMotionEnergy
  } = input;

  // PHYSICS MAPPING
  // High aggression + high dominance = high velocity, low damping (snappy)
  // High restraint + low aggression = low velocity, high damping (smooth/calm)
  
  const baseVelocity = 0.5 + (aggression * 0.8) - (restraint * 0.4);
  const velocity = Math.max(0.2, Math.min(2.0, baseVelocity));
  
  const damping = 0.7 + (restraint * 0.5) - (aggression * 0.3);
  
  const anticipation = anticipationDelay * 0.4;
  const exitDecay = 0.8 + (cinematicDrift * 0.4);
  
  // High emotional intensity = slower opacity acceleration (revealing slowly) or faster if aggressive
  const opacityAcceleration = aggression > 0.7 ? 1.5 : (1.0 - emotionalIntensity * 0.5);
  
  const blurRelease = 12 * aggression * (1 - restraint);
  const scaleInertia = 0.05 * dominance * (1 + aggression);
  
  const cinematicDrag = 1.0 + (cinematicDrift * 2.0) + (restraint * 1.5);
  const durationMs = Math.round(300 * cinematicDrag);
  
  // CAMERA SYNC
  // If camera is handheld, we increase damping to "ground" the text.
  const cameraSyncDamping = cameraMotionEnergy === "handheld" ? 1.4 : 1.0;
  
  // Easing derivation
  // aggressive: cubic-bezier(0.05, 0.7, 0.1, 1.0)
  // calm: cubic-bezier(0.4, 0, 0.2, 1)
  let easing = "cubic-bezier(0.25, 0.1, 0.25, 1.0)"; // Default
  if (aggression > 0.75) {
    easing = "cubic-bezier(0.05, 0.7, 0.1, 1.0)"; // Snappy
  } else if (restraint > 0.75 || cameraMotionEnergy === "cinematic-glide") {
    easing = "cubic-bezier(0.4, 0, 0.2, 1)"; // Smooth
  }

  return {
    velocity,
    damping: damping * cameraSyncDamping,
    anticipation,
    exitDecay,
    opacityAcceleration,
    blurRelease,
    scaleInertia,
    motionAggression: aggression,
    cadenceDensity: 1.0 + (aggression * 0.5),
    cinematicDrag,
    silenceTension: emotionalIntensity * restraint,
    easing,
    durationMs
  };
};
