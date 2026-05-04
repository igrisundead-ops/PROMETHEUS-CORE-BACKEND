import React, {useMemo} from "react";
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";

import {TargetFocusRuntime, TargetFocusTarget} from "../components/TargetFocusRuntime";
import {
  createTargetFocusCue,
  type TargetFocusCue
} from "../lib/motion-platform/target-focus-engine";

const px = (value: number): string => `${value.toFixed(2)}px`;

export const TargetFocusZoomShowcase: React.FC = () => {
  const {width, height, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const currentTimeMs = (frame / fps) * 1000;

  const cues = useMemo<TargetFocusCue[]>(() => {
    const headlineBox = {
      left: width * 0.08,
      top: height * 0.12,
      width: width * 0.78,
      height: height * 0.16
    };
    const metaBox = {
      left: width * 0.08,
      top: height * 0.31,
      width: width * 0.62,
      height: height * 0.08
    };
    const coreBox = {
      left: width * 0.08,
      top: height * 0.46,
      width: width * 0.82,
      height: height * 0.18
    };
    const noteBox = {
      left: width * 0.62,
      top: height * 0.72,
      width: width * 0.28,
      height: height * 0.1
    };

    return [
      createTargetFocusCue({
        id: "showcase-headline-focus",
        label: "Headline focus",
        target: {
          id: "showcase-headline"
        },
        targetBox: headlineBox,
        startMs: 0,
        zoomScale: 1.18,
        timing: {
          delayMs: 100,
          focusMs: 760,
          holdMs: 520,
          returnMs: 560,
          loop: true,
          loopDelayMs: 420,
          easeIn: "power3.out",
          easeOut: "sine.inOut"
        },
        vignette: {
          opacity: 0.9,
          radius: 0.26,
          softness: 0.2,
          tint: "rgba(6, 8, 18, 1)"
        },
        triggerType: "timeline",
        notes: "Focus the headline by id."
      }),
      createTargetFocusCue({
        id: "showcase-meta-focus",
        label: "Meta row focus",
        target: {
          tag: "meta-row"
        },
        targetBox: metaBox,
        startMs: 2600,
        zoomScale: 1.12,
        timing: {
          delayMs: 80,
          focusMs: 640,
          holdMs: 440,
          returnMs: 500,
          loop: true,
          loopDelayMs: 360,
          easeIn: "power2.out",
          easeOut: "sine.inOut"
        },
        vignette: {
          opacity: 0.88,
          radius: 0.24,
          softness: 0.18,
          tint: "rgba(7, 11, 22, 1)"
        },
        triggerType: "timeline",
        notes: "Focus the secondary tagged component by tag."
      }),
      createTargetFocusCue({
        id: "showcase-core-focus",
        label: "Core word focus",
        target: {
          registryRef: "composite:core-replaceable-word"
        },
        targetBox: coreBox,
        startMs: 5200,
        zoomScale: 1.22,
        timing: {
          delayMs: 90,
          focusMs: 700,
          holdMs: 500,
          returnMs: 560,
          loop: true,
          loopDelayMs: 420,
          easeIn: "power3.out",
          easeOut: "sine.inOut"
        },
        vignette: {
          opacity: 0.92,
          radius: 0.3,
          softness: 0.22,
          tint: "rgba(4, 7, 16, 1)"
        },
        triggerType: ["word-level", "timeline"],
        notes: "Focus the core replaceable word pathway by registry reference."
      }),
      createTargetFocusCue({
        id: "showcase-note-focus",
        label: "Selector focus",
        target: {
          selector: ".showcase-note"
        },
        targetBox: noteBox,
        startMs: 7800,
        zoomScale: 1.1,
        timing: {
          delayMs: 70,
          focusMs: 540,
          holdMs: 420,
          returnMs: 420,
          loop: true,
          loopDelayMs: 320,
          easeIn: "power2.out",
          easeOut: "sine.inOut"
        },
        vignette: {
          opacity: 0.82,
          radius: 0.22,
          softness: 0.16,
          tint: "rgba(10, 12, 20, 1)"
        },
        triggerType: "timeline",
        notes: "Focus a selector-based note target."
      })
    ];
  }, [height, width]);

  return (
    <AbsoluteFill
      style={{
        background: [
          "radial-gradient(circle at 16% 14%, rgba(110, 146, 255, 0.24) 0%, rgba(110, 146, 255, 0) 34%)",
          "radial-gradient(circle at 84% 20%, rgba(247, 176, 96, 0.2) 0%, rgba(247, 176, 96, 0) 30%)",
          "radial-gradient(circle at 58% 82%, rgba(89, 220, 197, 0.16) 0%, rgba(89, 220, 197, 0) 28%)",
          "linear-gradient(160deg, #08101e 0%, #0a1020 45%, #0b1326 100%)"
        ].join(", ")
      }}
    >
      <TargetFocusRuntime
        cues={cues}
        currentTimeMs={currentTimeMs}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 44,
            border: "1px solid rgba(255,255,255,0.08)",
            background:
              "linear-gradient(180deg, rgba(12, 18, 34, 0.84), rgba(8, 12, 22, 0.68))",
            boxShadow:
              "0 32px 84px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "-12% -8%",
              background:
                "radial-gradient(circle at 18% 18%, rgba(117, 149, 255, 0.2) 0%, rgba(117, 149, 255, 0) 44%), radial-gradient(circle at 84% 74%, rgba(243, 177, 97, 0.18) 0%, rgba(243, 177, 97, 0) 42%)",
              filter: "blur(34px)",
              opacity: 0.72
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 28%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 14%)"
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "grid",
              gap: 32,
              padding: `${px(height * 0.08)} ${px(width * 0.08)}`
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                width: "fit-content",
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(230,239,255,0.82)",
                fontFamily: "\"DM Sans\", sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase"
              }}
            >
              Target focus runtime
              <span
                style={{
                  width: 42,
                  height: 3,
                  borderRadius: 999,
                  background: "linear-gradient(90deg, rgba(110,146,255,1), rgba(244,178,99,1))"
                }}
              />
            </div>

            <TargetFocusTarget
              as="h1"
              targetId="showcase-headline"
              registryRef="headline-target"
              tags={["headline", "focus-target", "editorial"]}
              style={{
                maxWidth: "12.8em",
                margin: 0,
                color: "#f7f9ff",
                fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
                fontSize: "clamp(70px, 8.4vw, 126px)",
                lineHeight: 0.92,
                letterSpacing: "-0.06em",
                textShadow: "0 18px 42px rgba(0,0,0,0.36)"
              }}
            >
              Target Focus Zoom
            </TargetFocusTarget>

            <TargetFocusTarget
              as="div"
              targetId="showcase-meta-row"
              registryRef="meta-row-target"
              tags={["meta-row", "author", "date", "focus-target"]}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                maxWidth: "min(70vw, 860px)",
                color: "rgba(228,236,250,0.78)",
                fontFamily: "\"DM Sans\", sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase"
              }}
            >
              <span style={{padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)"}}>
                Author: Joshua
              </span>
              <span style={{padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)"}}>
                Date: April 14, 2026
              </span>
              <span style={{padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)"}}>
                Category: Editorial motion
              </span>
            </TargetFocusTarget>

            <TargetFocusTarget
              as="div"
              targetId="showcase-core-word"
              registryRef="composite:core-replaceable-word"
              tags={["core-word-showcase", "word-showcase", "focus-target", "replaceable-word"]}
              style={{
                maxWidth: "min(74vw, 860px)",
                display: "grid",
                gap: 18,
                padding: "26px 28px",
                borderRadius: 30,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "linear-gradient(180deg, rgba(9,14,26,0.82), rgba(7,10,20,0.74))",
                boxShadow: "0 22px 52px rgba(0,0,0,0.22)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: "0.5em 0.18em",
                  fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
                  fontSize: "clamp(44px, 5vw, 74px)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.04em",
                  color: "#f7f9ff"
                }}
              >
                <span
                  style={{
                    padding: "0.08em 0.26em",
                    borderRadius: 999,
                    background: "linear-gradient(135deg, rgba(255, 211, 126, 0.98), rgba(243, 170, 89, 0.92))",
                    color: "#111827",
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 0 24px rgba(255, 193, 104, 0.22)"
                  }}
                >
                  CORE
                </span>
                <span
                  style={{
                    position: "relative",
                    paddingBottom: "0.18em"
                  }}
                >
                  replaceable
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 4,
                      borderRadius: 999,
                      background: "linear-gradient(90deg, rgba(112, 165, 255, 0.98), rgba(173, 207, 255, 0.88))",
                      filter: "blur(0.3px)"
                    }}
                  />
                </span>
                <span
                  style={{
                    position: "relative",
                    padding: "0 0.02em"
                  }}
                >
                  word
                  <span
                    style={{
                      position: "absolute",
                      left: -10,
                      right: -10,
                      top: -8,
                      bottom: -10,
                      borderRadius: "50%",
                      border: "2px solid rgba(160, 200, 255, 0.88)",
                      boxShadow: "0 0 0 8px rgba(160, 200, 255, 0.08)",
                      transform: "rotate(-7deg)"
                    }}
                  />
                </span>
              </div>
              <div
                style={{
                  color: "rgba(220, 231, 250, 0.8)",
                  fontFamily: "\"DM Sans\", sans-serif",
                  fontSize: 14,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase"
                }}
              >
                Syllabic break for core words, paired with underline, circle, and highlight compatibility.
              </div>
            </TargetFocusTarget>

            <div
              className="showcase-note"
              data-animation-target-id="showcase-note"
              data-animation-registry-ref="showcase-note"
              data-animation-tags="note focus-target"
              style={{
                maxWidth: 380,
                justifySelf: "end",
                padding: "14px 16px",
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(228,236,250,0.78)",
                fontFamily: "\"DM Sans\", sans-serif",
                fontSize: 14,
                lineHeight: 1.45
              }}
            >
              Selectable by id, tag, selector, or registry ref. The focus scale returns to normal after each loop.
            </div>
          </div>
        </div>
      </TargetFocusRuntime>
    </AbsoluteFill>
  );
};
