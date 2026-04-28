import {writeFile} from "node:fs/promises";

import type {CreativeOrchestrationDebugReport} from "../types";

export const buildProposalDebugReport = (report: CreativeOrchestrationDebugReport): CreativeOrchestrationDebugReport => {
  return report;
};

export const writeProposalDebugReport = async (filePath: string, report: CreativeOrchestrationDebugReport): Promise<void> => {
  await writeFile(filePath, JSON.stringify(report, null, 2), "utf8");
};

