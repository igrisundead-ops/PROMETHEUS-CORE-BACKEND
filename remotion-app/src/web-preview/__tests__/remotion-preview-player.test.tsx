import path from "node:path";
import {readFileSync} from "node:fs";

import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import {RemotionPreviewPlayer} from "../RemotionPreviewPlayer";

const playerSnapshots: Array<{componentName: string; motionTier: string}> = [];

vi.mock("@remotion/player", async () => {
  return {
    Player: ({component, inputProps}: {component: React.ComponentType<unknown>; inputProps: Record<string, unknown>}) => {
      playerSnapshots.push({
        componentName: component.displayName ?? component.name ?? "unknown",
        motionTier: String(inputProps.motionTier ?? "")
      });

      return (
        <div
          data-component-name={component.displayName ?? component.name ?? "unknown"}
          data-motion-tier={String(inputProps.motionTier ?? "")}
        />
      );
    }
  };
});

const videoMetadata = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 12,
  durationInFrames: 360
} as const;

const createMotionModel = (tier: "minimal" | "premium") => ({
  tier,
  motion3DPlan: {
    enabled: tier === "premium"
  },
  captionBias: "auto",
  chunks: []
}) as any;

describe("RemotionPreviewPlayer", () => {
  it("routes the active preview through the generic project-scoped composition", () => {
    const markup = renderToStaticMarkup(
      <RemotionPreviewPlayer
        videoSrc="http://127.0.0.1:8000/api/edit-sessions/project-a/source"
        videoMetadata={videoMetadata}
        motionModel={createMotionModel("premium")}
        captionProfileId="longform_svg_typography_v1"
        previewPerformanceMode="balanced"
      />
    );

    expect(markup).toContain("data-component-name=\"ProjectScopedPreviewComposition\"");
    expect(playerSnapshots.at(-1)?.componentName).toBe("ProjectScopedPreviewComposition");
  });

  it("does not derive a Player reset key from changing preview props", () => {
    const sourcePath = path.resolve("src/web-preview/RemotionPreviewPlayer.tsx");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toMatch(/<Player[\s\S]*?\bkey=/);
    expect(source).toContain("data-player-instance-id");
  });
});
