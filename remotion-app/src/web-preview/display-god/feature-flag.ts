const normalizeBooleanFlag = (value?: string | null): boolean => {
  if (!value) {
    return false;
  }

  return /^(1|true|yes|on)$/i.test(value.trim());
};

export const isDisplayGodPreviewEnabled = (): boolean => {
  const importMetaEnv = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  const importMetaFlag =
    importMetaEnv?.VITE_DISPLAY_GOD_PREVIEW?.trim() || importMetaEnv?.DISPLAY_GOD_PREVIEW?.trim();
  const processFlag =
    typeof process !== "undefined"
      ? process.env.DISPLAY_GOD_PREVIEW?.trim() || process.env.VITE_DISPLAY_GOD_PREVIEW?.trim()
      : undefined;

  return normalizeBooleanFlag(importMetaFlag ?? processFlag ?? "");
};

