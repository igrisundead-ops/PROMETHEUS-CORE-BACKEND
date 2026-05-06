import { CinematicGovernor } from "../cinematic-governor";
import { SubsystemProposal } from "../types";
import { CreativeMoment } from "../../types";
import { CinematicPriorityHierarchy } from "../cinematic-priority-hierarchy";

describe("Controlled Cinematic Deviation Audit", () => {
  const governor = new CinematicGovernor();

  const generateMoments = (count: number): CreativeMoment[] => {
    const moments: CreativeMoment[] = [];
    for (let i = 0; i < count; i++) {
      moments.push({
        id: `moment-${i}`,
        startMs: i * 2000,
        endMs: (i + 1) * 2000,
        transcriptText: `Moment ${i}`,
        words: [],
        momentType: "explanation",
        energy: 0.9,
        importance: 0.9,
        density: 0.5,
        suggestedIntensity: "medium",
      });
    }
    return moments;
  };

  it("should establish expectations and then trigger a deviation", () => {
    // 10 restrained moments to establish an expectation of low dominance
    const moments = generateMoments(12);
    const proposalsByMoment = new Map<string, SubsystemProposal[]>();

    moments.forEach((m, index) => {
      proposalsByMoment.set(m.id, [{
        subsystemId: "text-agent",
        momentId: m.id,
        intent: { dominance: index < 10 ? 0.2 : 0.8, aggression: 0.5 },
        priority: CinematicPriorityHierarchy.getPriority("text-agent"),
        confidence: 0.9,
        reasoning: "Normal proposal.",
      }]);
    });

    const resolutions = governor.govern(moments, proposalsByMoment);
    
    // Check if any deviation occurred in the later moments
    const deviations = resolutions.filter(r => r.deviation !== null);
    expect(deviations.length).toBeGreaterThan(0);
    expect(deviations[0].deviation?.permitted).toBe(true);
    expect(deviations[0].deviation?.rationale).toContain("Deviation");
  });

  it("should apply deterministic humanization", () => {
    const moments = generateMoments(1);
    const proposalsByMoment = new Map<string, SubsystemProposal[]>();
    proposalsByMoment.set(moments[0].id, []);

    const res1 = governor.govern(moments, proposalsByMoment)[0];
    
    // Create a new governor instance to reset state
    const governor2 = new CinematicGovernor();
    const res2 = governor2.govern(moments, proposalsByMoment)[0];

    // Imperfections should be identical for the same momentId
    expect(res1.finalTiming).toBe(res2.finalTiming);
    expect(res1.finalAggression).toBe(res2.finalAggression);
  });

  it("should respect the surprise budget", () => {
    const moments = generateMoments(20);
    const proposalsByMoment = new Map<string, SubsystemProposal[]>();
    
    // Make every moment highly predictable and emotionally necessary to force deviation attempts
    moments.forEach((m) => {
      m.energy = 0.9;
      m.importance = 0.9;
      proposalsByMoment.set(m.id, [{
        subsystemId: "text-agent",
        momentId: m.id,
        intent: { dominance: 0.1, aggression: 0.1 },
        priority: CinematicPriorityHierarchy.getPriority("text-agent"),
        confidence: 1.0,
        reasoning: "Boring proposal.",
      }]);
    });

    const resolutions = governor.govern(moments, proposalsByMoment);
    const deviations = resolutions.filter(r => r.deviation !== null);
    
    // Default budget is 3
    expect(deviations.length).toBeLessThanOrEqual(5); // Allowing some budget replenishment
  });
});
