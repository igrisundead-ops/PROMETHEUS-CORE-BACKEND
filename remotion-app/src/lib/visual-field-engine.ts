export type ShotType =
  | "close-up"
  | "medium"
  | "wide"
  | "interview"
  | "product"
  | "landscape"
  | "documentary"
  | "talking-head"
  | "action"
  | "b-roll";

export type MotionEnergy = "calm" | "aggressive" | "handheld" | "cinematic-glide" | "static";

export type DominanceTarget = "speaker" | "typography" | "product" | "environment" | "emotion";

export type VisualFieldAnalysis = {
  dominantSubjectRegion: {x: number; y: number; width: number; height: number} | null;
  faceBoundingBoxes: Array<{x: number; y: number; width: number; height: number}>;
  motionVectors: {dx: number; dy: number; magnitude: number};
  brightnessHeatmap: number[][]; // Simplified 3x3 grid
  edgeDensity: number; // 0 to 1
  negativeSpaceRegions: Array<{x: number; y: number; width: number; height: number; score: number}>;
  dominantDirection: "left" | "right" | "up" | "down" | "center";
  cameraMotionEnergy: MotionEnergy;
  visualComplexityScore: number; // 0 to 1
  focalPoint: {x: number; y: number} | null;
  shotType: ShotType;
};

export type PlacementPlan = {
  strategy: "rule-of-thirds" | "asymmetric-left" | "asymmetric-right" | "center" | "lower-third" | "top-third" | "avoidance";
  coordinates: {x: number; y: number};
  margins: {top: number; bottom: number; left: number; right: number};
  opticalAlignmentOffset: {x: number; y: number};
  breathingSpaceFactor: number;
};

export type EyeGravityMap = {
  primaryGravity: {x: number; y: number};
  tensionVector: {dx: number; dy: number};
  avoidanceZones: Array<{x: number; y: number; radius: number}>;
};

export type VisualOrchestrationResult = {
  visualFieldAnalysis: VisualFieldAnalysis;
  eyeGravityMap: EyeGravityMap;
  placementPlan: PlacementPlan;
  cinematicCompositionProfile: string;
  shotType: ShotType;
  dominanceStrategy: DominanceTarget;
  motionSynchronizationPlan: {
    typographyMotionEnergy: MotionEnergy;
    syncOffsetMs: number;
  };
  typographyPlan: {
    scaleModifier: number;
    opacityMultiplier: number;
  };
  restraintPlan: {
    reasons: string[];
    isRestrained: boolean;
  };
};

export const analyzeVisualField = (/* mock inputs for now */): VisualFieldAnalysis => {
  // In a real system, this would ingest CV frame data.
  // For the architecture, we mock a standard talking-head medium shot.
  return {
    dominantSubjectRegion: {x: 0.3, y: 0.2, width: 0.4, height: 0.6}, // Center-ish
    faceBoundingBoxes: [{x: 0.4, y: 0.25, width: 0.2, height: 0.2}],
    motionVectors: {dx: 0.05, dy: 0.01, magnitude: 0.1},
    brightnessHeatmap: [[0.2, 0.4, 0.2], [0.3, 0.8, 0.3], [0.1, 0.5, 0.1]],
    edgeDensity: 0.45,
    negativeSpaceRegions: [
      {x: 0.05, y: 0.1, width: 0.25, height: 0.8, score: 0.85}, // Left third
      {x: 0.7, y: 0.1, width: 0.25, height: 0.8, score: 0.80}  // Right third
    ],
    dominantDirection: "right",
    cameraMotionEnergy: "static",
    visualComplexityScore: 0.5,
    focalPoint: {x: 0.5, y: 0.35}, // Eyes
    shotType: "medium"
  };
};

export const calculateEyeGravity = (field: VisualFieldAnalysis): EyeGravityMap => {
  // Gravity pulls towards faces and high motion
  const faceGravity = field.faceBoundingBoxes.length > 0 ? {x: field.faceBoundingBoxes[0].x + field.faceBoundingBoxes[0].width / 2, y: field.faceBoundingBoxes[0].y + field.faceBoundingBoxes[0].height / 2} : null;
  const primaryGravity = faceGravity ?? field.focalPoint ?? {x: 0.5, y: 0.5};

  // Tension vectors point away from gravity or along motion lines
  const tensionVector = {
    dx: field.dominantDirection === "right" ? -1 : field.dominantDirection === "left" ? 1 : 0,
    dy: 0
  };

  const avoidanceZones = field.faceBoundingBoxes.map(box => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    radius: Math.max(box.width, box.height) * 1.5 // Keep text away from faces
  }));

  return {
    primaryGravity,
    tensionVector,
    avoidanceZones
  };
};

export const generatePlacementPlan = (
  field: VisualFieldAnalysis,
  gravity: EyeGravityMap,
  isHook: boolean
): PlacementPlan => {
  let strategy: PlacementPlan["strategy"] = "lower-third";
  let x = 0.5;
  let y = 0.8;
  let breathingSpaceFactor = 1.0;

  // Semantic layout constraints
  if (field.shotType === "close-up") {
    strategy = "lower-third";
    y = 0.85; // Push lower to avoid face
    breathingSpaceFactor = 0.8; // Cramped
  } else if (field.shotType === "wide") {
    strategy = isHook ? "center" : "asymmetric-left";
    breathingSpaceFactor = 1.5; // Cinematic space
  } else if (field.shotType === "talking-head" || field.shotType === "medium") {
    // If gravity is center, push text to a negative space region (rule of thirds tension)
    if (gravity.primaryGravity.x > 0.4 && gravity.primaryGravity.x < 0.6) {
       // Face is center. Pick best negative space.
       const bestSpace = field.negativeSpaceRegions.sort((a, b) => b.score - a.score)[0];
       if (bestSpace && bestSpace.x < 0.5) {
           strategy = "asymmetric-left";
           x = 0.2; // roughly left third
       } else {
           strategy = "asymmetric-right";
           x = 0.8;
       }
    }
  }

  // Optical corrections (simulated)
  const opticalAlignmentOffset = {x: 0, y: strategy === "center" ? -0.05 : 0}; // Lift center slightly

  return {
    strategy,
    coordinates: {x, y},
    margins: {top: 0.1, bottom: 0.1, left: 0.1, right: 0.1},
    opticalAlignmentOffset,
    breathingSpaceFactor
  };
};

export const determineDominance = (field: VisualFieldAnalysis, momentType: string): DominanceTarget => {
  if (momentType === "hook" || momentType === "cta") return "typography";
  if (field.shotType === "product") return "product";
  if (field.shotType === "landscape") return "environment";
  return "speaker";
};

export const synchronizeMotion = (cameraEnergy: MotionEnergy, momentType: string): {typographyMotionEnergy: MotionEnergy; syncOffsetMs: number} => {
  if (cameraEnergy === "calm" || cameraEnergy === "static") {
    return {typographyMotionEnergy: momentType === "hook" ? "aggressive" : "calm", syncOffsetMs: 0};
  }
  if (cameraEnergy === "handheld") {
    // Ground the text to contrast the shaky camera
    return {typographyMotionEnergy: "static", syncOffsetMs: 0};
  }
  if (cameraEnergy === "cinematic-glide") {
    return {typographyMotionEnergy: "cinematic-glide", syncOffsetMs: 200}; // Slight delay
  }
  return {typographyMotionEnergy: "aggressive", syncOffsetMs: 0};
};

export type Rectangle = {x: number; y: number; width: number; height: number};

export const calculateIntersection = (a: Rectangle, b: Rectangle): number => {
  const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return overlapX * overlapY;
};

export const estimateTextBoundingBox = (
  placement: PlacementPlan,
  scaleModifier: number,
  wordCount: number
): Rectangle => {
  // Rough spatial approximation
  const width = Math.min(0.65, 0.15 + wordCount * 0.05) * scaleModifier;
  const height = 0.1 * scaleModifier;
  
  let x = placement.coordinates.x - width / 2;
  if (placement.strategy === "asymmetric-left") x = 0.12;
  if (placement.strategy === "asymmetric-right") x = 1 - 0.12 - width;
  
  const y = placement.coordinates.y - height; // y is bottom anchor

  return {x, y, width, height};
};

export const orchestrateVisualField = (
  momentType: string,
  emotionalWeight: number,
  wordCount: number = 5,
  styleProfile: "iman_like" | "codie_like" | "apple_like" = "iman_like"
): VisualOrchestrationResult => {
  const field = analyzeVisualField();
  const gravity = calculateEyeGravity(field);
  const isHook = momentType === "hook";
  let placement = generatePlacementPlan(field, gravity, isHook);
  const dominance = determineDominance(field, momentType);
  const motionSync = synchronizeMotion(field.cameraMotionEnergy, momentType);

  const restraintReasons: string[] = [];
  let scaleModifier = 1.0;
  let opacityMultiplier = 1.0;

  if (styleProfile === "apple_like") {
    scaleModifier = 0.7; // Smaller, whispering text
    restraintReasons.push("apple_like style enforces typography whisper");
  } else if (styleProfile === "iman_like" && isHook) {
    scaleModifier = 1.2; // Maximum hook dominance
  }

  if (field.shotType === "close-up") {
    scaleModifier *= 0.8;
    restraintReasons.push("Close-up shot type restricts typography scale");
  }

  if (field.visualComplexityScore > 0.8) {
    opacityMultiplier = 0.85; // Don't fight too hard with busy bg
    restraintReasons.push("High visual complexity behind text");
  }

  // THE SPATIAL CRITIC LOOP
  const textBounds = estimateTextBoundingBox(placement, scaleModifier, wordCount);
  let overlapFound = false;

  for (const face of field.faceBoundingBoxes) {
    if (calculateIntersection(textBounds, face) > 0.01) {
      overlapFound = true;
      break;
    }
  }

  if (overlapFound) {
    restraintReasons.push("CRITIQUE REVISION: Text intersected face. Forcing lower-third avoidance.");
    placement.strategy = "lower-third";
    placement.coordinates.y = 0.9; // Push to bottom safe
    scaleModifier *= 0.85; // Shrink to fit
  }

  return {
    visualFieldAnalysis: field,
    eyeGravityMap: gravity,
    placementPlan: placement,
    cinematicCompositionProfile: styleProfile,
    shotType: field.shotType,
    dominanceStrategy: dominance,
    motionSynchronizationPlan: motionSync,
    typographyPlan: {
      scaleModifier,
      opacityMultiplier
    },
    restraintPlan: {
      reasons: restraintReasons,
      isRestrained: restraintReasons.length > 0
    }
  };
};
