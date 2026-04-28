import {mkdir, readFile, readdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";

import {config as loadDotenv} from "dotenv";

const ROOT = process.cwd();
const DEFAULT_SOURCE_DIR = path.join(ROOT, "public", "showcase-assets");
const DEFAULT_MANIFEST_PATH = path.join(ROOT, "src", "data", "showcase-assets.supabase.json");

type UploadCliArgs = {
  sourceDir: string;
  manifestOut: string;
  bucket: string;
  prefix: string;
  createBucket: boolean;
  publicBucket: boolean;
  upsert: boolean;
};

type UploadedFileRecord = {
  localPath: string;
  objectPath: string;
  publicUrl: string;
  contentType: string;
  bytes: number;
};

const getEnv = (key: string): string => {
  return (process.env[key] ?? "").trim();
};

const readArgValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  const candidate = args[index + 1];
  return candidate?.trim() || undefined;
};

const readBooleanFlag = (args: string[], flag: string, fallback: boolean): boolean => {
  const value = readArgValue(args, flag);
  if (!value) {
    return fallback;
  }

  return value.toLowerCase() !== "false";
};

const normalizePrefix = (value: string): string => {
  return value.replace(/^\/+|\/+$/g, "");
};

const parseArgs = (): UploadCliArgs => {
  const args = process.argv.slice(2);
  const sourceDir = readArgValue(args, "--source-dir");
  const manifestOut = readArgValue(args, "--manifest-out");
  const bucket = readArgValue(args, "--bucket") ?? getEnv("SUPABASE_STORAGE_BUCKET");
  const envPrefix = getEnv("SUPABASE_STORAGE_PREFIX");
  const prefix = readArgValue(args, "--prefix") || envPrefix || "showcase-assets";

  return {
    sourceDir: sourceDir ? path.resolve(ROOT, sourceDir) : DEFAULT_SOURCE_DIR,
    manifestOut: manifestOut ? path.resolve(ROOT, manifestOut) : DEFAULT_MANIFEST_PATH,
    bucket,
    prefix: normalizePrefix(prefix),
    createBucket: readBooleanFlag(args, "--create-bucket", true),
    publicBucket: readBooleanFlag(args, "--public", true),
    upsert: readBooleanFlag(args, "--upsert", true)
  };
};

const ensureDirectory = async (filePath: string): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
};

const listFilesRecursively = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, {withFileTypes: true});
  const discovered = await Promise.all(
    entries.map(async (entry) => {
      const resolvedPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursively(resolvedPath);
      }
      if (entry.isFile()) {
        return [resolvedPath];
      }
      return [];
    })
  );

  return discovered.flat().sort((left, right) => left.localeCompare(right));
};

const inferContentType = (filePath: string): string => {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".mp4":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
};

const encodeStoragePath = (value: string): string => {
  return value
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
};

const buildObjectPath = ({
  sourceDir,
  filePath,
  prefix
}: {
  sourceDir: string;
  filePath: string;
  prefix: string;
}): string => {
  const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, "/");
  return prefix ? `${prefix}/${relativePath}` : relativePath;
};

const getAuthHeaders = (token: string): Record<string, string> => {
  return {
    apikey: token,
    Authorization: `Bearer ${token}`
  };
};

const ensureBucketExists = async ({
  supabaseUrl,
  token,
  bucket,
  createBucket,
  publicBucket
}: {
  supabaseUrl: string;
  token: string;
  bucket: string;
  createBucket: boolean;
  publicBucket: boolean;
}): Promise<"existing" | "created"> => {
  const listResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    headers: {
      ...getAuthHeaders(token),
      Accept: "application/json"
    }
  });

  if (!listResponse.ok) {
    throw new Error(`Supabase bucket lookup failed (${listResponse.status} ${listResponse.statusText}).`);
  }

  const buckets = (await listResponse.json()) as Array<{name?: string; id?: string}>;
  const alreadyExists = buckets.some((entry) => entry.name === bucket || entry.id === bucket);
  if (alreadyExists) {
    return "existing";
  }

  if (!createBucket) {
    throw new Error(`Supabase bucket "${bucket}" was not found and --create-bucket=false was set.`);
  }

  const createResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: publicBucket
    })
  });

  if (!createResponse.ok) {
    throw new Error(
      `Supabase bucket creation failed (${createResponse.status} ${createResponse.statusText}): ${await createResponse.text()}`
    );
  }

  return "created";
};

const uploadFileToBucket = async ({
  supabaseUrl,
  token,
  bucket,
  objectPath,
  filePath,
  upsert
}: {
  supabaseUrl: string;
  token: string;
  bucket: string;
  objectPath: string;
  filePath: string;
  upsert: boolean;
}): Promise<UploadedFileRecord> => {
  const bytes = await readFile(filePath);
  const contentType = inferContentType(filePath);
  const encodedBucket = encodeURIComponent(bucket);
  const encodedObjectPath = encodeStoragePath(objectPath);

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedObjectPath}`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(token),
      "Content-Type": contentType,
      "Cache-Control": "3600",
      "x-upsert": upsert ? "true" : "false"
    },
    body: bytes
  });

  if (!response.ok) {
    throw new Error(
      `Supabase upload failed for ${objectPath} (${response.status} ${response.statusText}): ${await response.text()}`
    );
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${encodedBucket}/${encodedObjectPath}`;
  return {
    localPath: filePath,
    objectPath,
    publicUrl,
    contentType,
    bytes: bytes.byteLength
  };
};

const run = async (): Promise<void> => {
  loadDotenv();
  const cliArgs = parseArgs();
  const supabaseUrl = getEnv("SUPABASE_URL").replace(/\/$/, "");
  const token =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("SUPABASE_ANON_KEY");

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is required to upload files to Supabase Storage.");
  }
  if (!token) {
    throw new Error(
      "A Supabase key is required. Prefer SUPABASE_SERVICE_ROLE_KEY for server-side uploads."
    );
  }
  if (!cliArgs.bucket) {
    throw new Error("SUPABASE_STORAGE_BUCKET or --bucket is required.");
  }

  await stat(cliArgs.sourceDir);
  await ensureDirectory(cliArgs.manifestOut);

  const bucketStatus = await ensureBucketExists({
    supabaseUrl,
    token,
    bucket: cliArgs.bucket,
    createBucket: cliArgs.createBucket,
    publicBucket: cliArgs.publicBucket
  });

  const files = await listFilesRecursively(cliArgs.sourceDir);
  const uploads: UploadedFileRecord[] = [];

  for (const filePath of files) {
    const objectPath = buildObjectPath({
      sourceDir: cliArgs.sourceDir,
      filePath,
      prefix: cliArgs.prefix
    });
    const uploaded = await uploadFileToBucket({
      supabaseUrl,
      token,
      bucket: cliArgs.bucket,
      objectPath,
      filePath,
      upsert: cliArgs.upsert
    });
    uploads.push(uploaded);
    console.log(`Uploaded ${uploaded.objectPath}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    supabaseUrl,
    bucket: cliArgs.bucket,
    prefix: cliArgs.prefix,
    bucketStatus,
    uploadCount: uploads.length,
    uploads
  };

  await writeFile(cliArgs.manifestOut, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  console.log(`Uploaded ${uploads.length} files to bucket "${cliArgs.bucket}".`);
  console.log(`Manifest written to ${cliArgs.manifestOut}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
