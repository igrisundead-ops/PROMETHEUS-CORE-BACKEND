import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";

import type {FontManifestRecord} from "./types";
import {slugify} from "./utils";

const specimenMarkup = (font: FontManifestRecord, relativeFontPath: string): string => {
  const fontName = font.observed.fullName ?? font.observed.postscriptName ?? font.observed.filename;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${fontName} specimen</title>
    <style>
      @font-face {
        font-family: "PrometheusSpecimen";
        src: url("${relativeFontPath.replace(/\\/g, "/")}");
      }
      :root {
        color-scheme: light;
        font-family: "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        background: linear-gradient(135deg, #faf7f1, #efe8dc);
        color: #171410;
      }
      main {
        max-width: 980px;
        margin: 0 auto;
        padding: 48px 32px 64px;
      }
      .sample {
        font-family: "PrometheusSpecimen", serif;
      }
      .headline {
        font-size: 72px;
        line-height: 0.95;
        letter-spacing: 0.01em;
        margin: 0 0 20px;
      }
      .subtitle {
        font-size: 28px;
        line-height: 1.15;
        margin: 0 0 24px;
      }
      .body {
        font-size: 20px;
        line-height: 1.5;
        max-width: 60ch;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 32px;
      }
      .card {
        padding: 16px;
        border-radius: 18px;
        background: rgba(255,255,255,0.75);
        box-shadow: 0 14px 34px rgba(23, 20, 16, 0.08);
      }
      .meta {
        font-size: 14px;
        line-height: 1.45;
      }
      .alphabet {
        font-size: 24px;
        line-height: 1.35;
      }
    </style>
  </head>
  <body>
    <main>
      <h1 class="sample headline">Command attention. Keep the frame premium.</h1>
      <p class="sample subtitle">Prometheus typography specimen for ${fontName}.</p>
      <p class="sample body">This specimen shows how the face behaves across hero, subtitle, and support scenarios so the descriptor and compatibility graph can be checked against the actual rhythm of the type.</p>
      <section class="grid">
        <article class="card">
          <div class="meta"><strong>Roles</strong><br />${font.inferred.roles.join(", ")}</div>
        </article>
        <article class="card">
          <div class="meta"><strong>Personality</strong><br />${font.inferred.personality.join(", ")}</div>
        </article>
        <article class="card">
          <div class="meta"><strong>Metrics</strong><br />Weight ${font.observed.weightClass ?? "unknown"} / Width ${font.observed.widthClass ?? "unknown"} / Italic ${font.observed.italic === true ? "yes" : "no"}</div>
        </article>
      </section>
      <section class="card" style="margin-top: 24px;">
        <div class="sample alphabet">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789 135,790.24</div>
      </section>
    </main>
  </body>
</html>
`;
};

export const createFontSpecimen = async ({
  font,
  specimensDir
}: {
  font: FontManifestRecord;
  specimensDir: string;
}): Promise<string> => {
  const familySlug = slugify(font.observed.familyName ?? font.familyId);
  const fontDir = path.join(specimensDir, familySlug);
  await mkdir(fontDir, {recursive: true});
  const specimenPath = path.join(fontDir, `${slugify(font.fontId)}.html`);
  const relativeFontPath = path.relative(path.dirname(specimenPath), font.observed.extractedAbsolutePath);
  await writeFile(specimenPath, specimenMarkup(font, relativeFontPath), "utf-8");
  return specimenPath;
};
