export type PriorityLevel =
  | "EMOTIONAL_INTEGRITY"
  | "VIEWER_READABILITY"
  | "CINEMATIC_RHYTHM"
  | "SUBJECT_VISIBILITY"
  | "RESTRAINT"
  | "MOTION_STYLE"
  | "TYPOGRAPHY_STYLING"
  | "MICRO_EFFECTS";

export const PRIORITY_MAP: Record<PriorityLevel, number> = {
  EMOTIONAL_INTEGRITY: 100,
  VIEWER_READABILITY: 90,
  CINEMATIC_RHYTHM: 80,
  SUBJECT_VISIBILITY: 70,
  RESTRAINT: 60,
  MOTION_STYLE: 50,
  TYPOGRAPHY_STYLING: 40,
  MICRO_EFFECTS: 30,
};

export const SUBSYSTEM_PRIORITY_ASSIGNMENT: Record<string, number> = {
  "empathy-engine": PRIORITY_MAP.EMOTIONAL_INTEGRITY,
  "critic-engine": PRIORITY_MAP.VIEWER_READABILITY,
  "timeline-rhythm": PRIORITY_MAP.CINEMATIC_RHYTHM,
  "layout-agent": PRIORITY_MAP.SUBJECT_VISIBILITY,
  "restraint-governor": PRIORITY_MAP.RESTRAINT,
  "motion-agent": PRIORITY_MAP.MOTION_STYLE,
  "text-agent": PRIORITY_MAP.TYPOGRAPHY_STYLING,
  "sound-agent": PRIORITY_MAP.MICRO_EFFECTS,
};

export class CinematicPriorityHierarchy {
  static getPriority(subsystemId: string): number {
    return SUBSYSTEM_PRIORITY_ASSIGNMENT[subsystemId] ?? 10;
  }

  static resolve(p1: number, p2: number): number {
    return Math.max(p1, p2);
  }
}
