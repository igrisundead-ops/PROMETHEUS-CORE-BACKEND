import {access, readFile} from "node:fs/promises";
import path from "node:path";

type RuntimeManifestRecord = {
  fontId: string;
  familyId: string;
  familyName: string;
  fileName: string;
  originalFileName: string | null;
  weight: number | null;
  style: string;
  format: "ttf" | "otf" | "woff" | "woff2";
  publicUrl: string;
  localPublicPath: string;
  renderable: boolean;
};

const cssFormatLabel = (format: RuntimeManifestRecord["format"]): string => {
  if (format === "ttf") {
    return "truetype";
  }
  if (format === "otf") {
    return "opentype";
  }
  return format;
};

const buildFontFaceCss = (record: RuntimeManifestRecord): string => {
  const escapedFamily = record.familyName.replace(/(["\\])/g, "\\$1");
  return [
    "@font-face {",
    `  font-family: "${escapedFamily}";`,
    `  src: url("${record.publicUrl}") format("${cssFormatLabel(record.format)}");`,
    `  font-style: ${record.style};`,
    `  font-weight: ${record.weight ?? 400};`,
    "  font-display: swap;",
    "}"
  ].join("\n");
};

const main = async (): Promise<void> => {
  const remotionRoot = process.cwd();
  const manifestPath = path.join(remotionRoot, "public", "fonts", "library", "font-manifest-urls.json");
  await access(manifestPath);

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as RuntimeManifestRecord[];
  if (!Array.isArray(manifest)) {
    throw new Error(`Expected an array in ${manifestPath}.`);
  }

  const renderableRecords = manifest.filter((record) => record.renderable === true);
  if (renderableRecords.length === 0) {
    throw new Error("Expected at least one renderable font record in the runtime manifest.");
  }

  for (const record of renderableRecords) {
    if (!record.publicUrl.startsWith("/fonts/library/")) {
      throw new Error(`Invalid publicUrl for ${record.fontId}: ${record.publicUrl}`);
    }
    const resolvedPath = path.resolve(remotionRoot, record.localPublicPath);
    await access(resolvedPath);
    const css = buildFontFaceCss(record);
    if (!css.includes(record.publicUrl)) {
      throw new Error(`Generated CSS for ${record.fontId} did not include its publicUrl.`);
    }
    if (!css.includes("@font-face")) {
      throw new Error(`Generated CSS for ${record.fontId} was missing an @font-face block.`);
    }
  }

  console.log(
    JSON.stringify(
      {
        manifestPath,
        renderableRecords: renderableRecords.length,
        testedLocalPaths: renderableRecords.length,
        mode: "strict-path-css-smoke-test",
        browserLoadAttempted: false,
        browserLoadSucceeded: false,
        warning: null,
        sampleCss: buildFontFaceCss(renderableRecords[0]!)
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(`[font-smoke-test] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
