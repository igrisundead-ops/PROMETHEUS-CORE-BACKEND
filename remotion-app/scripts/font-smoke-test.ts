import {access, readFile} from "node:fs/promises";
import path from "node:path";
import {createRequire} from "node:module";

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

const require = createRequire(import.meta.url);

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

const tryBrowserFontLoad = async (record: RuntimeManifestRecord): Promise<{
  attempted: boolean;
  succeeded: boolean;
  mode: string;
  warning?: string;
}> => {
  let playwrightModuleName: string | null = null;
  for (const moduleName of ["playwright", "@playwright/test"]) {
    try {
      require.resolve(moduleName);
      playwrightModuleName = moduleName;
      break;
    } catch {
      // Keep probing.
    }
  }

  if (!playwrightModuleName) {
    return {
      attempted: false,
      succeeded: false,
      mode: "strict-path-css-smoke-test"
    };
  }

  try {
    const playwrightModule = await import(playwrightModuleName);
    const chromium = "chromium" in playwrightModule ? playwrightModule.chromium : null;
    if (!chromium) {
      return {
        attempted: false,
        succeeded: false,
        mode: "strict-path-css-smoke-test",
        warning: `Resolved ${playwrightModuleName}, but no chromium export was available.`
      };
    }

    const browser = await chromium.launch({headless: true});
    try {
      const page = await browser.newPage();
      const css = buildFontFaceCss(record);
      await page.setContent(
        [
          "<!doctype html>",
          "<html>",
          "<head>",
          "<style>",
          css,
          "</style>",
          "</head>",
          "<body>Font smoke test</body>",
          "</html>"
        ].join("")
      );
      const loadState = await page.evaluate(async (font: Pick<RuntimeManifestRecord, "weight" | "familyName">) => {
        const response = await document.fonts.load(`${font.weight ?? 400} 16px "${font.familyName}"`);
        return {
          loadedCount: response.length,
          status: document.fonts.status
        };
      }, record);

      return {
        attempted: true,
        succeeded: loadState.loadedCount > 0,
        mode: "browser-font-load"
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    return {
      attempted: false,
      succeeded: false,
      mode: "strict-path-css-smoke-test",
      warning: error instanceof Error ? error.message : String(error)
    };
  }
};

const main = async (): Promise<void> => {
  const manifestPath = path.join(process.cwd(), "public", "fonts", "library", "font-manifest-urls.json");
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
    await access(record.localPublicPath);
    const css = buildFontFaceCss(record);
    if (!css.includes(record.publicUrl)) {
      throw new Error(`Generated CSS for ${record.fontId} did not include its publicUrl.`);
    }
    if (!css.includes("@font-face")) {
      throw new Error(`Generated CSS for ${record.fontId} was missing an @font-face block.`);
    }
  }

  const browserCheck = await tryBrowserFontLoad(renderableRecords[0]!);

  console.log(
    JSON.stringify(
      {
        manifestPath,
        renderableRecords: renderableRecords.length,
        testedLocalPaths: renderableRecords.length,
        mode: browserCheck.mode,
        browserLoadAttempted: browserCheck.attempted,
        browserLoadSucceeded: browserCheck.succeeded,
        warning: browserCheck.warning ?? null,
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
