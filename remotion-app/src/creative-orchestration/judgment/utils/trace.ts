import type {TraceEntry} from "../types";

export const createTraceEntry = (step: string, summary: string, data: Record<string, unknown> = {}): TraceEntry => ({
  step,
  summary,
  data
});

export const appendTrace = (trace: TraceEntry[], entry: TraceEntry): TraceEntry[] => [...trace, entry];
