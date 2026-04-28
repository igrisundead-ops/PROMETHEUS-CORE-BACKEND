import React from "react";

import {HyperframesPreview} from "./HyperframesPreview";
import type {PreviewPlaybackHealth} from "./preview-telemetry";
import type {PreviewPerformanceMode} from "../lib/types";
import type {DisplayTimeline} from "./display-god/display-timeline";
import type {HyperframesPreviewManifest} from "./hyperframes/manifest-schema";

type DisplayGodPreviewStageProps = {
  readonly displayTimeline: DisplayTimeline;
  readonly manifest?: HyperframesPreviewManifest | null;
  readonly previewPerformanceMode: PreviewPerformanceMode;
  readonly onHealthChange?: (health: PreviewPlaybackHealth) => void;
  readonly onErrorMessageChange?: (message: string | null) => void;
  readonly onFallbackRequested?: (message: string) => void;
};

class DisplayGodPreviewErrorBoundary extends React.Component<
  {
    readonly onFatalError?: (message: string) => void;
    readonly children: React.ReactNode;
  },
  {hasError: boolean}
> {
  public state = {hasError: false};

  public static getDerivedStateFromError(): {hasError: boolean} {
    return {hasError: true};
  }

  public componentDidCatch(error: Error): void {
    this.props.onFatalError?.(error.message);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export const DisplayGodPreviewStage: React.FC<DisplayGodPreviewStageProps> = ({
  displayTimeline,
  manifest,
  previewPerformanceMode,
  onHealthChange,
  onErrorMessageChange,
  onFallbackRequested
}) => {
  return (
    <DisplayGodPreviewErrorBoundary onFatalError={onFallbackRequested}>
      <HyperframesPreview
        displayTimeline={displayTimeline}
        manifest={manifest}
        previewPerformanceMode={previewPerformanceMode}
        onHealthChange={onHealthChange}
        onErrorMessageChange={onErrorMessageChange}
      />
    </DisplayGodPreviewErrorBoundary>
  );
};
