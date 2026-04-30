import {describe, expect, it} from "vitest";

import type {DisplayTimelineLayer} from "../display-god/display-timeline";
import {
  filterCompetingHyperframesTextLayers,
  shouldSuppressNativeCaptionsForHyperframes
} from "../hyperframes/text-governance";

const createLayer = (overrides: Partial<DisplayTimelineLayer> = {}): DisplayTimelineLayer => ({
  id: overrides.id ?? "layer-1",
  kind: overrides.kind ?? "creative-track",
  mediaKind: overrides.mediaKind ?? "none",
  label: overrides.label ?? "layer",
  startMs: overrides.startMs ?? 0,
  endMs: overrides.endMs ?? 1000,
  zIndex: overrides.zIndex ?? 4,
  visual: overrides.visual ?? true,
  syncQuality: overrides.syncQuality ?? "not-applicable",
  styleMetadata: overrides.styleMetadata ?? {}
});

describe("hyperframes text governance", () => {
  it("keeps only the dominant creative text layer when multiple text tracks overlap", () => {
    const captainKeyword = createLayer({
      id: "captain-keyword",
      styleMetadata: {
        trackType: "text",
        mode: "keyword-only",
        visualRole: "captain",
        text: "BRAIN"
      }
    });
    const supportCaption = createLayer({
      id: "support-caption",
      styleMetadata: {
        trackType: "text",
        mode: "full-caption",
        visualRole: "support",
        text: "THE INTRICACIES OF THE BRAIN"
      }
    });
    const assetLayer = createLayer({
      id: "asset-layer",
      kind: "motion-asset",
      mediaKind: "image",
      styleMetadata: {
        role: "foreground"
      }
    });

    const filtered = filterCompetingHyperframesTextLayers([
      supportCaption,
      assetLayer,
      captainKeyword
    ]);

    expect(filtered.map((layer) => layer.id)).toEqual(["asset-layer", "captain-keyword"]);
  });

  it("suppresses native captions when a visible creative text layer is present", () => {
    const textLayer = createLayer({
      styleMetadata: {
        trackType: "text",
        mode: "keyword-only",
        visualRole: "captain",
        text: "DECISION"
      }
    });

    expect(shouldSuppressNativeCaptionsForHyperframes([textLayer])).toBe(true);
  });

  it("keeps native captions available when no visible creative text layer exists", () => {
    const noTextLayer = createLayer({
      styleMetadata: {
        trackType: "text",
        mode: "no-text",
        visualRole: "restraint",
        text: ""
      }
    });
    const assetLayer = createLayer({
      id: "asset-layer",
      kind: "motion-asset",
      mediaKind: "image",
      styleMetadata: {
        role: "foreground"
      }
    });

    expect(shouldSuppressNativeCaptionsForHyperframes([noTextLayer, assetLayer])).toBe(false);
  });
});
