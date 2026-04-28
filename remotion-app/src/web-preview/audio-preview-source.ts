export type AudioPreviewSourceFileLike = {
  name?: string | null;
  type?: string | null;
};

export type AudioPreviewSourcePlan =
  | {
      kind: "missing";
    }
  | {
      kind: "direct";
      src: string;
    }
  | {
      kind: "backend";
      sourcePath: string | null;
      sourceFile?: AudioPreviewSourceFileLike;
    };

const AUDIO_FILE_EXTENSION_PATTERN = /\.(aac|flac|m4a|mp3|oga|ogg|opus|wav|weba)$/i;
const VIDEO_FILE_EXTENSION_PATTERN = /\.(avi|m4v|mov|mp4|mpeg|mpg|webm)$/i;

export const isLikelyAudioFileLike = (file: AudioPreviewSourceFileLike | null | undefined): boolean => {
  const mimeType = file?.type?.trim().toLowerCase() ?? "";
  if (mimeType.startsWith("audio/")) {
    return true;
  }

  const fileName = file?.name?.trim() ?? "";
  return AUDIO_FILE_EXTENSION_PATTERN.test(fileName);
};

export const isLikelyVideoFileLike = (file: AudioPreviewSourceFileLike | null | undefined): boolean => {
  const mimeType = file?.type?.trim().toLowerCase() ?? "";
  if (mimeType.startsWith("video/")) {
    return true;
  }

  const fileName = file?.name?.trim() ?? "";
  return VIDEO_FILE_EXTENSION_PATTERN.test(fileName);
};

export const planAudioPreviewSource = ({
  sourceAudioSrc,
  sourceFile,
  sourcePath
}: {
  sourceAudioSrc?: string | null;
  sourceFile?: AudioPreviewSourceFileLike | null;
  sourcePath?: string | null;
}): AudioPreviewSourcePlan => {
  const trimmedAudioSrc = sourceAudioSrc?.trim() ?? "";
  const trimmedSourcePath = sourcePath?.trim() ?? "";

  if (sourceFile) {
    if (trimmedAudioSrc && isLikelyAudioFileLike(sourceFile)) {
      return {
        kind: "direct",
        src: trimmedAudioSrc
      };
    }

    return {
      kind: "backend",
      sourceFile,
      sourcePath: trimmedSourcePath || null
    };
  }

  if (trimmedSourcePath) {
    return {
      kind: "backend",
      sourcePath: trimmedSourcePath
    };
  }

  if (trimmedAudioSrc) {
    return {
      kind: "direct",
      src: trimmedAudioSrc
    };
  }

  return {
    kind: "missing"
  };
};

export const resolveAudioPreviewUrl = (apiBase: string, audioUrl: string): string => {
  if (/^https?:\/\//i.test(audioUrl)) {
    return audioUrl;
  }

  const normalizedBase = apiBase.replace(/\/+$/, "");
  const normalizedPath = audioUrl.startsWith("/") ? audioUrl : `/${audioUrl}`;
  return `${normalizedBase}${normalizedPath}`;
};

export const resolveEditSessionSourceUrl = (apiBase: string, sessionId: string): string => {
  const normalizedBase = apiBase.replace(/\/+$/, "");
  const normalizedSessionId = sessionId.trim();
  return `${normalizedBase}/api/edit-sessions/${normalizedSessionId}/source`;
};
