import {randomBytes} from "node:crypto";

export const createJobId = (): string => {
  const stamp = Date.now().toString(36);
  const entropy = randomBytes(5).toString("hex");
  return `job_${stamp}_${entropy}`;
};

export const createEditSessionId = (): string => {
  const stamp = Date.now().toString(36);
  const entropy = randomBytes(5).toString("hex");
  return `edit_${stamp}_${entropy}`;
};
