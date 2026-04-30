import {
  archiveEntrySchema,
  type ArchiveEntry,
  type TreatmentGenomeV1
} from "../types";

const scoreGenome = (genome: TreatmentGenomeV1): number => {
  const balanceBonus = genome.noveltyLevel <= 0.82 && genome.consistencyLevel >= 0.35 ? 0.08 : 0;
  const retrievalBonus = genome.retrievalIntent === "reuse-existing" ? 0.08 : genome.retrievalIntent === "reuse-with-variation" ? 0.05 : 0.02;
  return Math.max(0, Math.min(1,
    genome.consistencyLevel * 0.34 +
    genome.noveltyLevel * 0.26 +
    (1 - Math.abs(genome.noveltyBias - genome.consistencyBias)) * 0.12 +
    (genome.godEscalationIntent === "forbidden" ? 0.08 : 0.02) +
    retrievalBonus +
    balanceBonus
  ));
};

export class QualityDiversityArchive {
  build(genomes: TreatmentGenomeV1[]): ArchiveEntry[] {
    const elites = new Map<string, ArchiveEntry>();
    genomes.forEach((genome) => {
      const plannerScore = scoreGenome(genome);
      const current = elites.get(genome.archiveCell.key);
      if (!current || plannerScore > current.plannerScore) {
        elites.set(genome.archiveCell.key, archiveEntrySchema.parse({
          cell: genome.archiveCell,
          genome,
          plannerScore,
          source: "generated"
        }));
      }
    });
    return [...elites.values()];
  }
}
