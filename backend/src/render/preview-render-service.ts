import path from "node:path";
import {stat} from "node:fs/promises";

import type {CreativeDecisionManifest} from "../contracts/creative-decision-manifest";
import {generateHyperFramesComposition} from "../composition/hyperframes-composition-generator";
import type {RenderAdapter} from "./adapters/render-adapter";
import {LocalHyperFramesRenderAdapter} from "./adapters/local-hyperframes-render-adapter";

export type PreviewArtifactResult = {
  previewUrl: string;
  localPath: string;
  renderTimeMs: number;
  engine: "hyperframes" | "remotion";
  artifactKind: "html_composition" | "video";
  contentType: string;
  compositionGenerationTimeMs: number;
  diagnostics: {
    warnings: string[];
    compositionDir: string;
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

export class PreviewRenderService {
  private readonly adapter: RenderAdapter;

  public constructor(adapter?: RenderAdapter) {
    this.adapter = adapter ?? new LocalHyperFramesRenderAdapter();
  }

  public async createPreviewArtifact({
    manifest,
    sessionRenderDir,
    sourceMediaPath
  }: {
    manifest: CreativeDecisionManifest;
    sessionRenderDir: string;
    sourceMediaPath?: string | null;
  }): Promise<PreviewArtifactResult> {
    const composition = await generateHyperFramesComposition({
      manifest,
      outputRootDir: sessionRenderDir
    });
    const renderResult = await this.adapter.render({
      sessionId: manifest.jobId,
      compositionDir: composition.compositionDir,
      outputDir: sessionRenderDir,
      manifest,
      sourceMediaPath
    });
    await stat(renderResult.localPath);
    return {
      previewUrl: renderResult.previewUrl,
      localPath: renderResult.localPath,
      renderTimeMs: renderResult.renderTimeMs,
      engine: renderResult.engine,
      artifactKind: renderResult.artifactKind,
      contentType: renderResult.contentType,
      compositionGenerationTimeMs: composition.compositionGenerationTimeMs,
      diagnostics: {
        warnings: renderResult.warnings,
        compositionDir: path.relative(sessionRenderDir, composition.compositionDir) || "composition",
        fontProof: composition.diagnostics?.fontProof ?? {
          fontsRequestedFromManifest: [],
          fontFilesResolved: [],
          fontFilesLoadedIntoComposition: [],
          fontCssGenerated: false,
          fallbackFontsUsed: [],
          fallbackReasons: []
        },
        animationProof: composition.diagnostics?.animationProof ?? {
          animationRequestedFromManifest: null,
          animationRetrievedFromMilvus: false,
          retrievedAnimationId: null,
          gsapTimelineGenerated: false,
          fallbackAnimationUsed: false,
          fallbackReasons: []
        }
      }
    };
  }
}
