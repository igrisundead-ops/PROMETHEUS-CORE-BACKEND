const DEFAULT_BACKEND_API_BASE_URL = "http://localhost:8000";

const normalizeBaseUrl = (value: string): string => {
  return value.trim().replace(/\/+$/, "");
};

const readConfiguredBaseUrl = (): string | null => {
  const importMetaEnv = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  const importMetaBaseUrl =
    importMetaEnv?.VITE_API_BASE_URL?.trim() || importMetaEnv?.NEXT_PUBLIC_API_BASE_URL?.trim();
  const processBaseUrl =
    typeof process !== "undefined"
      ? process.env.VITE_API_BASE_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
      : undefined;

  return importMetaBaseUrl || processBaseUrl || null;
};

export const getBackendApiBaseUrl = (): string => {
  return normalizeBaseUrl(readConfiguredBaseUrl() ?? DEFAULT_BACKEND_API_BASE_URL);
};

export const joinBackendApiUrl = (path: string): string => {
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(path)) {
    return path;
  }

  const baseUrl = getBackendApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
};

export const backendFetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(joinBackendApiUrl(path), {
    cache: "no-store",
    ...init
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const suffix = body.trim().length > 0 ? `: ${body}` : "";
    throw new Error(`Backend request failed with ${response.status} ${response.statusText}${suffix}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as unknown as T;
  }

  return (await response.json()) as T;
};

