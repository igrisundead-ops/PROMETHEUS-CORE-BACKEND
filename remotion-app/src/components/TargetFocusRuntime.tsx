import React, {type CSSProperties, type ElementType, type ReactNode, useMemo} from "react";
import {useVideoConfig} from "remotion";

import {
  buildTargetFocusSelectionLabel,
  resolveTargetFocusState,
  selectActiveTargetFocusCueAtTime,
  type TargetFocusCue
} from "../lib/motion-platform/target-focus-engine";

type TargetFocusRuntimeProps = {
  cues: TargetFocusCue[];
  currentTimeMs: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
};

type TargetFocusTargetProps<T extends ElementType = "div"> = {
  as?: T;
  targetId: string;
  tags?: string[];
  registryRef?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

const buildTagString = (tags: string[]): string | undefined => {
  const filtered = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  return filtered.length > 0 ? filtered.join(" ") : undefined;
};

export const TargetFocusTarget = <T extends ElementType = "div">({
  as,
  targetId,
  tags = [],
  registryRef,
  className,
  style,
  children
}: TargetFocusTargetProps<T>): React.ReactElement => {
  const Tag = as ?? "div";
  return (
    <Tag
      id={targetId}
      data-animation-target-id={targetId}
      data-animation-tags={buildTagString(tags)}
      data-animation-registry-ref={registryRef}
      data-focus-target="true"
      className={className}
      style={style}
    >
      {children}
    </Tag>
  );
};

export const TargetFocusRuntime: React.FC<TargetFocusRuntimeProps> = ({
  cues,
  currentTimeMs,
  children,
  className,
  style,
  contentClassName,
  contentStyle,
  overlayClassName,
  overlayStyle
}) => {
  const {width, height} = useVideoConfig();
  const activeCue = useMemo(
    () => selectActiveTargetFocusCueAtTime(cues, currentTimeMs),
    [currentTimeMs, cues]
  );
  const state = useMemo(
    () => resolveTargetFocusState({
      cue: activeCue,
      currentTimeMs,
      viewportWidth: width,
      viewportHeight: height
    }),
    [activeCue, currentTimeMs, height, width]
  );
  const focusSelection = activeCue ? buildTargetFocusSelectionLabel(activeCue.target) : "none";
  const rootStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    isolation: "isolate",
    ...style
  };

  return (
    <div
      className={className}
      style={rootStyle}
      data-animation-tags="target-focus-runtime focus-runtime camera-focus"
      data-focus-active={state.active ? "true" : "false"}
      data-focus-phase={state.phase}
      data-focus-target={focusSelection}
    >
      <div
        className={contentClassName}
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          transform: `translate3d(${state.translateX.toFixed(2)}px, ${state.translateY.toFixed(2)}px, 0) scale(${state.scale.toFixed(4)})`,
          willChange: "transform",
          ...contentStyle
        }}
      >
        {children}
      </div>
      {state.vignetteStyle ? (
        <div
          className={overlayClassName}
          style={{
            ...state.vignetteStyle,
            ...overlayStyle
          }}
        />
      ) : null}
    </div>
  );
};

export type {
  TargetFocusCue,
  TargetFocusSelection,
  TargetFocusTargetBox
} from "../lib/motion-platform/target-focus-engine";
