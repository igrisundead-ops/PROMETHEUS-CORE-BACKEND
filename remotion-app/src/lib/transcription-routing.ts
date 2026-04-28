import type {PresentationMode} from "./types";
import {sha256Text} from "./hash";

export type TranscriptionMode = "assemblyai";
export type TranscriptionProvider = "assemblyai";

export const getDefaultTranscriptionMode = (
  _presentationMode: PresentationMode
): TranscriptionMode => {
  return "assemblyai";
};

export const normalizeTranscriptionMode = (
  rawMode: string | undefined,
  presentationMode: PresentationMode
): TranscriptionMode => {
  if (rawMode === "assemblyai") {
    return "assemblyai";
  }

  return getDefaultTranscriptionMode(presentationMode);
};

export const getTranscriptionProviderOrder = (
  mode: TranscriptionMode
): TranscriptionProvider[] => {
  return [mode];
};

export const buildTranscriptSettingsFingerprint = ({
  provider
}: {
  provider: TranscriptionProvider;
}): string => {
  return "assemblyai:best";
};

export const buildTranscriptCacheKey = ({
  sourceVideoHash,
  provider,
  settingsFingerprint
}: {
  sourceVideoHash: string;
  provider: TranscriptionProvider;
  settingsFingerprint: string;
}): string => {
  return sha256Text(`${sourceVideoHash}|${provider}|${settingsFingerprint}`);
};
