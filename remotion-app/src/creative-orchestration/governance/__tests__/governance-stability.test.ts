import { CinematicGovernor } from "../cinematic-governor";
import { SubsystemProposal } from "../types";
import { CreativeMoment } from "../../types";
import { CinematicPriorityHierarchy } from "../cinematic-priority-hierarchy";

describe("Unified Cinematic Governance Stability Audit", () => {
  const governor = new CinematicGovernor();

  const mockMoments: CreativeMoment[] = [
    {
      id: "moment-1",
      startMs: 0,
      endMs: 2000,
      transcriptText: "The hook moment.",
      words: [],
      momentType: "hook",
      energy: 0.9,
      importance: 0.9,
      density: 0.8,
      suggestedIntensity: "hero",
    },
    {
      id: "moment-2",
      startMs: 2000,
      endMs: 4000,
      transcriptText: "A vulnerable explanation.",
      words: [],
      momentType: "explanation",
      energy: 0.2,
      importance: 0.8,
      density: 0.5,
      suggestedIntensity: "medium",
    },
  ];

  const mockProposals = new Map<string, SubsystemProposal[]>();
  mockProposals.set("moment-1", [
    {
      subsystemId: "motion-agent",
      momentId: "moment-1",
      intent: { aggression: 0.9, motion: 0.9 },
      priority: CinematicPriorityHierarchy.getPriority("motion-agent"),
      confidence: 0.9,
      reasoning: "High energy hook needs high motion.",
    },
    {
      subsystemId: "empathy-engine",
      momentId: "moment-1",
      intent: { aggression: 0.5 },
      priority: CinematicPriorityHierarchy.getPriority("empathy-engine"),
      confidence: 1.0,
      reasoning: "Keep it grounded.",
    },
  ]);

  mockProposals.set("moment-2", [
    {
      subsystemId: "text-agent",
      momentId: "moment-2",
      intent: { aggression: 0.8, scale: 0.8 },
      priority: CinematicPriorityHierarchy.getPriority("text-agent"),
      confidence: 0.9,
      reasoning: "Emphasize key words aggressively.",
    },
  ]);

  it("should resolve conflicts based on priority hierarchy", () => {
    const resolutions = governor.govern(mockMoments, mockProposals);
    
    // Moment 1: Empathy (Priority 100) vs Motion (Priority 50)
    // The base resolution is 0.624, but it is amplified by 1.3 because the state is "explosive"
    expect(resolutions[0].finalAggression).toBeGreaterThan(0.8);
    expect(resolutions[0].state.kind).toBe("explosive");
  });

  it("should enforce vulnerable state constraints", () => {
    const resolutions = governor.govern(mockMoments, mockProposals);
    
    // Moment 2: Vulnerable state (energy 0.2, importance 0.8)
    // The state machine should transition to vulnerable
    expect(resolutions[1].state.kind).toBe("vulnerable");
    // And even though text-agent wanted 0.8 aggression, the governor should dampen it
    expect(resolutions[1].finalAggression).toBeLessThan(0.6);
  });

  it("should generate explainability reports", () => {
    const resolutions = governor.govern(mockMoments, mockProposals);
    expect(resolutions[0].explainability.length).toBeGreaterThan(0);
    expect(resolutions[0].explainability.some(s => s.includes("explosive"))).toBe(true);
  });
});
