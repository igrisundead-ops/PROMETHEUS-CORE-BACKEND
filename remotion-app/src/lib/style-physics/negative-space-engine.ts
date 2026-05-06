export type VisualSafetyQuadrant = {
  x: number;
  y: number;
  width: number;
  height: number;
  safetyScore: number; // 0 (occupied/unreadable) to 1 (safe/empty)
  edgeDensity: number;
  brightnessVariance: number;
  faceOccupancy: number;
};

export type VisualSafetyMap = {
  quadrants: VisualSafetyQuadrant[];
  bestQuadrant: VisualSafetyQuadrant;
  overallComplexity: number;
};

export type NegativeSpaceInput = {
  faceBoundingBoxes: Array<{x: number; y: number; width: number; height: number}>;
  edgeDensityMap?: number[][]; // 3x3 grid
  luminanceMap?: number[][]; // 3x3 grid
  motionDensityMap?: number[][]; // 3x3 grid
};

export const analyzeNegativeSpace = (input: NegativeSpaceInput): VisualSafetyMap => {
  const { faceBoundingBoxes, edgeDensityMap, luminanceMap, motionDensityMap } = input;

  const quadrants: VisualSafetyQuadrant[] = [];
  const rows = 3;
  const cols = 3;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c / cols;
      const y = r / rows;
      const width = 1 / cols;
      const height = 1 / rows;

      const edgeDensity = edgeDensityMap ? edgeDensityMap[r][c] : 0.2;
      const brightnessVariance = luminanceMap ? Math.abs(luminanceMap[r][c] - 0.5) : 0.1;
      
      // Calculate face occupancy for this quadrant
      let faceOccupancy = 0;
      for (const face of faceBoundingBoxes) {
        const overlapX = Math.max(0, Math.min(x + width, face.x + face.width) - Math.max(x, face.x));
        const overlapY = Math.max(0, Math.min(y + height, face.y + face.height) - Math.max(y, face.y));
        faceOccupancy += (overlapX * overlapY) / (width * height);
      }

      // Safety Score: High if low face occupancy, low edge density, and moderate brightness variance.
      const safetyScore = Math.max(0, 1.0 - (faceOccupancy * 2.0) - (edgeDensity * 1.5) - (brightnessVariance * 0.5));

      quadrants.push({
        x, y, width, height,
        safetyScore,
        edgeDensity,
        brightnessVariance,
        faceOccupancy
      });
    }
  }

  const bestQuadrant = quadrants.reduce((prev, current) => (prev.safetyScore > current.safetyScore ? prev : current));

  return {
    quadrants,
    bestQuadrant,
    overallComplexity: quadrants.reduce((acc, q) => acc + q.edgeDensity, 0) / quadrants.length
  };
};
