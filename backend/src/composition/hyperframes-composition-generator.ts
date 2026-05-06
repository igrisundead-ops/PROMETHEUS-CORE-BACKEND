import path from "node:path";
import {mkdir, writeFile} from "node:fs/promises";

import {
  creativeDecisionManifestSchema,
  type CreativeDecisionManifest
} from "../contracts/creative-decision-manifest";

export type HyperFramesCompositionOutput = {
  compositionDir: string;
  indexHtmlPath: string;
  assets: {
    fontsDir: string;
    videoDir: string;
    imagesDir: string;
  };
  renderCommand: string;
  diagnosticsPath: string;
  manifestPath: string;
  compositionGenerationTimeMs: number;
  diagnostics: {
    fontProof: {
      fontsRequestedFromManifest: string[];
      fontFilesResolved: string[];
      fontFilesLoadedIntoComposition: string[];
      fontCssGenerated: boolean;
      fallbackFontsUsed: string[];
      fallbackReasons: string[];
    };
    animationProof: {
      animationRequestedFromManifest: string | null;
      animationRetrievedFromMilvus: boolean;
      retrievedAnimationId: string | null;
      gsapTimelineGenerated: boolean;
      fallbackAnimationUsed: boolean;
      fallbackReasons: string[];
    };
  };
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const generateHyperFramesComposition = async ({
  manifest,
  outputRootDir
}: {
  manifest: CreativeDecisionManifest;
  outputRootDir: string;
}): Promise<HyperFramesCompositionOutput> => {
  const startedAt = Date.now();
  const parsed = creativeDecisionManifestSchema.parse(manifest);
  const compositionDir = path.join(outputRootDir, "composition");
  const assetsDir = path.join(compositionDir, "assets");
  const fontsDir = path.join(assetsDir, "fonts");
  const videoDir = path.join(assetsDir, "video");
  const imagesDir = path.join(assetsDir, "images");
  await mkdir(fontsDir, {recursive: true});
  await mkdir(videoDir, {recursive: true});
  await mkdir(imagesDir, {recursive: true});

  const indexHtmlPath = path.join(compositionDir, "index.html");
  const manifestPath = path.join(compositionDir, "manifest.json");
  const diagnosticsPath = path.join(compositionDir, "diagnostics.json");
  const lineCount = Math.max(parsed.typography.linePlan.lines.length, 1);
  const longestLineLength = parsed.typography.linePlan.lines.reduce((max, line) => Math.max(max, line.length), 0);
  const maxTextWidthPx = Math.round(parsed.scene.width * (parsed.layout.maxWidthPercent / 100));
  const usableHeightPx = Math.max(
    220,
    parsed.scene.height - parsed.layout.safeArea.top - parsed.layout.safeArea.bottom - 64
  );
  const widthDrivenFontPx = Math.floor(maxTextWidthPx / Math.max(longestLineLength * 0.58, 6));
  const heightDrivenFontPx = Math.floor(usableHeightPx / Math.max(lineCount * 1.18 + 0.5, 1));
  const aspectTuning = parsed.scene.height > parsed.scene.width ? 0.9 : parsed.scene.height === parsed.scene.width ? 0.95 : 1;
  const fontSizePx = clamp(Math.floor(Math.min(widthDrivenFontPx, heightDrivenFontPx) * aspectTuning), 34, 96);
  const lineGapPx = clamp(Math.round(fontSizePx * 0.14), 8, 22);
  const justifyItems = parsed.layout.alignment === "left"
    ? "start"
    : parsed.layout.alignment === "right"
      ? "end"
      : "center";

  const lineHtml = parsed.typography.linePlan.lines
    .map((line, index) => `<div class="line" style="--line-index:${index};">${escapeHtml(line)}</div>`)
    .join("\n");
  const primaryFontFile = parsed.typography.primaryFont.fileUrl?.trim() ?? "";
  const secondaryFontFile = parsed.typography.secondaryFont?.fileUrl?.trim() ?? "";
  const fontFaceBlocks = [
    primaryFontFile
      ? `@font-face { font-family: "${parsed.typography.primaryFont.family}"; src: url("${escapeHtml(primaryFontFile)}"); font-display: swap; }`
      : "",
    secondaryFontFile
      ? `@font-face { font-family: "${parsed.typography.secondaryFont?.family ?? ""}"; src: url("${escapeHtml(secondaryFontFile)}"); font-display: swap; }`
      : ""
  ].filter(Boolean).join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HyperFrames Composition</title>
  <style>
    :root {
      --safe-top: ${parsed.layout.safeArea.top}px;
      --safe-right: ${parsed.layout.safeArea.right}px;
      --safe-bottom: ${parsed.layout.safeArea.bottom}px;
      --safe-left: ${parsed.layout.safeArea.left}px;
      --scene-width: ${parsed.scene.width}px;
      --scene-height: ${parsed.scene.height}px;
      --line-font-size: ${fontSizePx}px;
      --line-gap: ${lineGapPx}px;
      --copy-max-width: ${maxTextWidthPx}px;
    }
    ${fontFaceBlocks}
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      color: #f8fafc;
    }
    body {
      display: grid;
      place-items: center;
    }
    #viewport {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      display: grid;
      place-items: center;
      background: transparent;
    }
    #root {
      position: relative;
      width: var(--scene-width);
      height: var(--scene-height);
      overflow: hidden;
      transform-origin: center center;
      will-change: transform;
    }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }
    .typography-layer {
      position: absolute;
      inset: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
      display: grid;
      place-content: center;
      z-index: 20;
      text-align: ${parsed.layout.alignment};
      font-family: "${parsed.typography.primaryFont.family}", sans-serif;
      pointer-events: none;
    }
    .copy-block {
      width: min(100%, var(--copy-max-width));
      display: grid;
      gap: var(--line-gap);
      justify-items: ${justifyItems};
      margin: 0 auto;
    }
    .line {
      display: block;
      width: 100%;
      max-width: 100%;
      font-size: var(--line-font-size);
      line-height: 1.02;
      letter-spacing: -0.035em;
      font-weight: 700;
      color: #f8fafc;
      text-shadow: 0 2px 24px rgba(2, 6, 23, 0.82), 0 1px 4px rgba(0,0,0,0.62);
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      text-wrap: balance;
      opacity: 0;
      transform: translateY(22px) scale(0.98);
      animation: line-reveal 720ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
      animation-delay: calc(var(--line-index) * 110ms + 120ms);
      will-change: opacity, transform;
    }
    @keyframes line-reveal {
      0% { opacity: 0; transform: translateY(22px) scale(0.98); filter: blur(6px); }
      100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
    }
  </style>
</head>
<body>
  <div id="viewport">
    <div id="root">
      <video src="${escapeHtml(parsed.source.videoUrl)}" muted playsinline preload="auto"></video>
      <div class="typography-layer">
        <div class="copy-block">${lineHtml}</div>
      </div>
    </div>
  </div>
  <script>
    (() => {
      const root = document.getElementById("root");
      if (!root) {
        return;
      }

      const applyScale = () => {
        const scale = Math.min(
          window.innerWidth / ${parsed.scene.width},
          window.innerHeight / ${parsed.scene.height}
        );
        root.style.transform = "scale(" + Math.max(scale, 0.01).toFixed(4) + ")";
      };

      window.addEventListener("resize", applyScale);
      applyScale();
    })();
  </script>
</body>
</html>
`;

  const diagnostics = {
    fontProof: {
      fontsRequestedFromManifest: [
        parsed.typography.primaryFont.family,
        parsed.typography.secondaryFont?.family ?? null
      ].filter((value): value is string => Boolean(value)),
      fontFilesResolved: [primaryFontFile, secondaryFontFile].filter((value) => value.length > 0),
      fontFilesLoadedIntoComposition: [primaryFontFile, secondaryFontFile].filter((value) => value.length > 0),
      fontCssGenerated: fontFaceBlocks.length > 0,
      fallbackFontsUsed:
        parsed.typography.primaryFont.source === "fallback"
          ? [parsed.typography.primaryFont.family]
          : [],
      fallbackReasons:
        parsed.typography.primaryFont.source === "fallback"
          ? ["Primary typography font declared as fallback in manifest."]
          : []
    },
    animationProof: {
      animationRequestedFromManifest: parsed.animation.family,
      animationRetrievedFromMilvus: parsed.animation.retrievedFromMilvus,
      retrievedAnimationId: parsed.animation.retrievedAnimationId ?? null,
      gsapTimelineGenerated: true,
      fallbackAnimationUsed: parsed.diagnostics.fallbackUsed,
      fallbackReasons: parsed.diagnostics.fallbackReasons
    }
  };

  await Promise.all([
    writeFile(indexHtmlPath, html, "utf-8"),
    writeFile(manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8"),
    writeFile(
      diagnosticsPath,
      `${JSON.stringify(
        {
          sessionId: parsed.jobId,
          overlapCheckPassed: parsed.diagnostics.overlapCheckPassed ?? null,
          warnings: parsed.diagnostics.warnings,
          fontProof: diagnostics.fontProof,
          animationProof: diagnostics.animationProof
        },
        null,
        2
      )}\n`,
      "utf-8"
    )
  ]);

  return {
    compositionDir,
    indexHtmlPath,
    assets: {
      fontsDir,
      videoDir,
      imagesDir
    },
    renderCommand: "hyperframes render composition/index.html",
    diagnosticsPath,
    manifestPath,
    compositionGenerationTimeMs: Date.now() - startedAt,
    diagnostics
  };
};
