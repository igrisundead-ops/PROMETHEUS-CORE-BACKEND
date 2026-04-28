import React, {type CSSProperties} from "react";

import {AzureGAnimatedCounter} from "./AzureGAnimatedCounter";
import type {MotionShowcaseCue, TemplateGraphicCategory} from "../lib/types";

type SemanticSidecallCueVisualProps = {
  cue: MotionShowcaseCue;
  visibility: number;
  translateY: number;
  scale: number;
  rotation: number;
  style?: CSSProperties;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getCueAccent = (cue: MotionShowcaseCue): {
  primary: string;
  secondary: string;
  glow: string;
  text: string;
} => {
  if (cue.templateGraphicCategory === "graph-chart") {
    return {
      primary: "#8bb6ff",
      secondary: "#4d72ff",
      glow: "rgba(123, 169, 255, 0.34)",
      text: "#f6fbff"
    };
  }
  if (cue.templateGraphicCategory === "number-counter-kpi") {
    return {
      primary: "#f2c67a",
      secondary: "#f08c4f",
      glow: "rgba(242, 181, 105, 0.32)",
      text: "#fff7ec"
    };
  }
  if (cue.templateGraphicCategory === "timeline-calendar") {
    return {
      primary: "#8ae2d0",
      secondary: "#48b39d",
      glow: "rgba(110, 220, 197, 0.28)",
      text: "#effffb"
    };
  }
  if (cue.templateGraphicCategory === "blueprint-workflow") {
    return {
      primary: "#d2c2ff",
      secondary: "#7b72ff",
      glow: "rgba(160, 142, 255, 0.28)",
      text: "#fbf9ff"
    };
  }

  return {
    primary: "#d9c289",
    secondary: "#718dff",
    glow: "rgba(132, 169, 255, 0.3)",
    text: "#f7f8ff"
  };
};

const truncateWords = (value: string, maxWords: number): string => {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  return words.slice(0, maxWords).join(" ");
};

const toTitleLike = (value: string): string => {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
};

const PERSON_REFERENCE_BLOCKLIST = new Set([
  "the",
  "this",
  "that",
  "these",
  "those",
  "here",
  "there",
  "what",
  "when",
  "where",
  "why",
  "how",
  "one",
  "two",
  "three",
  "four",
  "five",
  "reference",
  "figure",
  "person",
  "named",
  "showcase",
  "keyword",
  "title"
]);

const looksLikePersonReference = (cue: MotionShowcaseCue): boolean => {
  const text = `${cue.canonicalLabel} ${cue.matchedText}`.trim();
  const matches = text.match(/\b([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*){1,3})\b/g) ?? [];
  return matches.some((match) => {
    const tokens = match
      .split(/\s+/)
      .map((token) => token.replace(/[^A-Za-z0-9']/g, ""))
      .filter(Boolean);
    return tokens.length >= 2 && !PERSON_REFERENCE_BLOCKLIST.has((tokens[0] ?? "").toLowerCase());
  });
};

const extractMetricText = (value: string): string | null => {
  const numericMatch = value.match(/\$?\d[\d,]*(?:\.\d+)?%?/);
  if (numericMatch) {
    return numericMatch[0];
  }
  const wordNumberMatch = value.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion|figures?)\b/i
  );
  return wordNumberMatch?.[0] ?? null;
};

const getDisplayPhrase = (cue: MotionShowcaseCue): string => {
  if (cue.cueSource === "typography-only") {
    return truncateWords(cue.matchedText, 4);
  }
  if (cue.templateGraphicCategory === "number-counter-kpi") {
    return extractMetricText(cue.matchedText) ?? truncateWords(cue.matchedText, 3);
  }
  return truncateWords(cue.matchedText, 5);
};

const getDescriptor = (cue: MotionShowcaseCue): string => {
  if (cue.templateGraphicCategory === "graph-chart") {
    return "Trend signal";
  }
  if (cue.templateGraphicCategory === "number-counter-kpi") {
    return "Key metric";
  }
  if (cue.templateGraphicCategory === "timeline-calendar") {
    return "Time marker";
  }
  if (cue.templateGraphicCategory === "blueprint-workflow") {
    return "Process cue";
  }
  return "Keyword cue";
};

const getFrameWidth = (cue: MotionShowcaseCue): string => {
  if (cue.templateGraphicCategory === "graph-chart") {
    return "min(23vw, 320px)";
  }
  if (cue.templateGraphicCategory === "blueprint-workflow") {
    return "min(23vw, 312px)";
  }
  if (cue.templateGraphicCategory === "timeline-calendar") {
    return "min(21vw, 288px)";
  }
  if (cue.templateGraphicCategory === "number-counter-kpi") {
    return "min(20vw, 272px)";
  }
  return "min(19vw, 252px)";
};

const cardShellStyle = ({
  cue,
  visibility,
  translateY,
  scale,
  rotation,
  style
}: SemanticSidecallCueVisualProps): CSSProperties => {
  const accent = getCueAccent(cue);

  return {
    position: "relative",
    width: getFrameWidth(cue),
    minWidth: cue.templateGraphicCategory ? 220 : 190,
    padding: cue.templateGraphicCategory ? "18px 18px 16px" : "16px 16px 14px",
    borderRadius: cue.templateGraphicCategory ? 26 : 22,
    border: `1px solid ${accent.glow.replace(/0\.\d+\)$/, "0.22)")}`,
    background: [
      "radial-gradient(circle at 12% 14%, rgba(255,255,255,0.16), rgba(255,255,255,0) 34%)",
      `radial-gradient(circle at 86% 18%, ${accent.glow}, rgba(255,255,255,0) 42%)`,
      "linear-gradient(180deg, rgba(12, 15, 24, 0.94), rgba(9, 11, 19, 0.82))"
    ].join(", "),
    boxShadow: `0 24px 60px rgba(0, 0, 0, 0.34), 0 0 0 1px ${accent.glow.replace(/0\.\d+\)$/, "0.14)")}`,
    backdropFilter: "blur(18px)",
    opacity: visibility,
    transform: `translate3d(-50%, -22%, 0) translateY(${translateY}px) scale(${scale}) rotate(${rotation}deg)`,
    transformOrigin: "center center",
    overflow: "hidden",
    color: accent.text,
    willChange: "transform, opacity",
    pointerEvents: "none",
    ...style
  };
};

const headerStyle = (cue: MotionShowcaseCue): CSSProperties => {
  const accent = getCueAccent(cue);
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    color: accent.primary,
    fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
    fontSize: "0.66rem",
    fontWeight: 800,
    letterSpacing: "0.16em",
    textTransform: "uppercase"
  };
};

const headerBarStyle = (cue: MotionShowcaseCue): CSSProperties => {
  const accent = getCueAccent(cue);
  return {
    width: 42,
    height: 3,
    borderRadius: 999,
    background: `linear-gradient(90deg, ${accent.primary}, ${accent.secondary})`,
    boxShadow: `0 0 20px ${accent.glow}`
  };
};

const buildTagStyle = (cue: MotionShowcaseCue): CSSProperties => {
  const accent = getCueAccent(cue);
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${accent.glow.replace(/0\.\d+\)$/, "0.2)")}`,
    color: "rgba(241, 246, 255, 0.82)",
    fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
    fontSize: "0.64rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase"
  };
};

const GraphicHeader: React.FC<{cue: MotionShowcaseCue}> = ({cue}) => {
  return (
    <div style={headerStyle(cue)}>
      <span>{getDescriptor(cue)}</span>
      <div style={headerBarStyle(cue)} />
    </div>
  );
};

const TypographyPlate: React.FC<{cue: MotionShowcaseCue}> = ({cue}) => {
  const accent = getCueAccent(cue);
  const phrase = getDisplayPhrase(cue);
  return (
    <div style={{display: "grid", gap: 10}}>
      <GraphicHeader cue={cue} />
      <div
        style={{
          display: "grid",
          gap: 6,
          padding: "4px 0 2px"
        }}
      >
        <div
          style={{
            color: accent.text,
            fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
            fontSize: "clamp(28px, 2.8vw, 44px)",
            lineHeight: 0.92,
            letterSpacing: "-0.04em",
            textWrap: "balance",
            textShadow: `0 0 24px ${accent.glow}, 0 10px 26px rgba(0, 0, 0, 0.24)`
          }}
        >
          {toTitleLike(phrase)}
        </div>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
          <span style={buildTagStyle(cue)}>{cue.canonicalLabel}</span>
          <span style={buildTagStyle(cue)}>{cue.governorAction === "text-only-accent" ? "Typography" : "Sidecall"}</span>
        </div>
      </div>
      <div
        style={{
          height: 1,
          background: "linear-gradient(90deg, rgba(255,255,255,0.2), rgba(255,255,255,0.02))"
        }}
      />
    </div>
  );
};

const PersonCalloutGraphic: React.FC<{cue: MotionShowcaseCue}> = ({cue}) => {
  const accent = getCueAccent(cue);
  const personPhrase = toTitleLike(truncateWords(cue.matchedText || cue.canonicalLabel, 4));

  return (
    <div style={{display: "grid", gap: 14}}>
      <GraphicHeader cue={cue} />
      <div
        style={{
          display: "grid",
          gap: 10,
          padding: "4px 0 2px"
        }}
      >
        <div
          style={{
            color: "rgba(241, 246, 255, 0.84)",
            fontFamily: "\"Great Vibes\", \"Allura\", cursive",
            fontSize: "clamp(1.2rem, 2vw, 1.6rem)",
            lineHeight: 1,
            letterSpacing: "0.02em"
          }}
        >
          Reference person
        </div>
        <div
          style={{
            color: accent.text,
            fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
            fontSize: "clamp(30px, 3vw, 48px)",
            lineHeight: 0.92,
            letterSpacing: "-0.05em",
            textShadow: `0 0 24px ${accent.glow}, 0 10px 26px rgba(0, 0, 0, 0.24)`,
            textWrap: "balance"
          }}
        >
          {personPhrase}
        </div>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
          <span style={buildTagStyle(cue)}>Named cue</span>
          <span style={buildTagStyle(cue)}>Person</span>
          <span style={buildTagStyle(cue)}>{cue.governorAction === "text-only-accent" ? "Typography" : "Showcase"}</span>
        </div>
      </div>
      <div
        style={{
          height: 1,
          background: "linear-gradient(90deg, rgba(255,255,255,0.24), rgba(255,255,255,0.02))"
        }}
      />
    </div>
  );
};

const GraphChartGraphic: React.FC<{cue: MotionShowcaseCue}> = ({cue}) => {
  const accent = getCueAccent(cue);
  const phrase = getDisplayPhrase(cue);
  const chartPoints = [72, 64, 58, 48, 38];

  return (
    <div style={{display: "grid", gap: 14}}>
      <GraphicHeader cue={cue} />
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 10
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "grid",
            gap: 6
          }}
        >
          <div
            style={{
              color: accent.text,
              fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
              fontSize: "clamp(25px, 2.5vw, 38px)",
              lineHeight: 0.96,
              letterSpacing: "-0.04em",
              textWrap: "balance"
            }}
          >
            {toTitleLike(phrase)}
          </div>
          <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
            <span style={buildTagStyle(cue)}>Graph</span>
            <span style={buildTagStyle(cue)}>Momentum</span>
          </div>
        </div>
        <div
          style={{
            position: "relative",
            width: 112,
            height: 78,
            borderRadius: 18,
            padding: "14px 10px 12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "10px",
              borderLeft: "1px solid rgba(255,255,255,0.12)",
              borderBottom: "1px solid rgba(255,255,255,0.12)"
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 14,
              right: 12,
              bottom: 16,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 6
            }}
          >
            {chartPoints.map((height, index) => (
              <div
                key={`${cue.id}-bar-${index}`}
                style={{
                  width: 12,
                  height,
                  borderRadius: 999,
                  background: index === chartPoints.length - 1
                    ? `linear-gradient(180deg, ${accent.primary}, ${accent.secondary})`
                    : "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
                  boxShadow: index === chartPoints.length - 1 ? `0 0 18px ${accent.glow}` : undefined
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const NumberCounterGraphic: React.FC<{cue: MotionShowcaseCue; visibility: number}> = ({
  cue,
  visibility
}) => {
  const accent = getCueAccent(cue);

  return (
    <div style={{display: "grid", gap: 14}}>
      <GraphicHeader cue={cue} />
      <div style={{display: "grid", gap: 10, padding: "2px 0 4px"}}>
        <AzureGAnimatedCounter cue={cue} visibility={visibility} accent={accent} />
        <div style={{display: "flex", gap: 8}}>
          <span style={buildTagStyle(cue)}>KPI</span>
          <span style={buildTagStyle(cue)}>{cue.canonicalLabel}</span>
        </div>
      </div>
    </div>
  );
};

const TimelineGraphic: React.FC<{cue: MotionShowcaseCue}> = ({cue}) => {
  const accent = getCueAccent(cue);
  const items = [
    "Start",
    toTitleLike(truncateWords(cue.matchedText, 2)),
    "Scale"
  ];

  return (
    <div style={{display: "grid", gap: 14}}>
      <GraphicHeader cue={cue} />
      <div
        style={{
          position: "relative",
          display: "grid",
          gap: 12,
          paddingLeft: 18
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 8,
            bottom: 8,
            width: 2,
            borderRadius: 999,
            background: `linear-gradient(180deg, ${accent.primary}, rgba(255,255,255,0.08))`
          }}
        />
        {items.map((item, index) => (
          <div
            key={`${cue.id}-timeline-${index}`}
            style={{
              position: "relative",
              display: "grid",
              gap: 2,
              padding: "0 0 0 12px"
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -18,
                top: 10,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: index === 1 ? accent.primary : "rgba(255,255,255,0.14)",
                boxShadow: index === 1 ? `0 0 16px ${accent.glow}` : undefined
              }}
            />
            <div
              style={{
                color: index === 1 ? accent.text : "rgba(239,244,255,0.82)",
                fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
                fontSize: index === 1 ? "1.3rem" : "1.02rem",
                lineHeight: 0.98,
                letterSpacing: "-0.03em"
              }}
            >
              {item}
            </div>
            <div
              style={{
                color: "rgba(205,214,234,0.72)",
                fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
                fontSize: "0.7rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              }}
            >
              {index === 1 ? "Current marker" : "Sequence"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BlueprintGraphic: React.FC<{cue: MotionShowcaseCue}> = ({cue}) => {
  const accent = getCueAccent(cue);
  const nodes = [
    {label: "Input", dim: false},
    {label: toTitleLike(truncateWords(cue.matchedText, 2)), dim: false},
    {label: "Output", dim: true}
  ];

  return (
    <div style={{display: "grid", gap: 14}}>
      <GraphicHeader cue={cue} />
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "18%",
            right: "18%",
            top: "50%",
            height: 2,
            transform: "translateY(-50%)",
            background: `linear-gradient(90deg, rgba(255,255,255,0.08), ${accent.primary}, rgba(255,255,255,0.08))`
          }}
        />
        {nodes.map((node, index) => (
          <div
            key={`${cue.id}-node-${index}`}
            style={{
              position: "relative",
              padding: "12px 10px 10px",
              borderRadius: 18,
              border: `1px solid ${node.dim ? "rgba(255,255,255,0.08)" : accent.glow.replace(/0\.\d+\)$/, "0.24)")}`,
              background: node.dim
                ? "rgba(255,255,255,0.04)"
                : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
              minHeight: 78,
              display: "grid",
              alignContent: "space-between",
              gap: 8
            }}
          >
            <div
              style={{
                color: node.dim ? "rgba(223,228,240,0.8)" : accent.text,
                fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
                fontSize: index === 1 ? "1.18rem" : "1rem",
                lineHeight: 0.98,
                letterSpacing: "-0.03em",
                textWrap: "balance"
              }}
            >
              {node.label}
            </div>
            <div
              style={{
                color: accent.primary,
                fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
                fontSize: "0.66rem",
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase"
              }}
            >
              {index === 1 ? "Active trace" : "Node"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TemplateGraphic: React.FC<{
  cue: MotionShowcaseCue;
  category: TemplateGraphicCategory;
  visibility: number;
}> = ({cue, category, visibility}) => {
  if (category === "graph-chart") {
    return <GraphChartGraphic cue={cue} />;
  }
  if (category === "number-counter-kpi") {
    return <NumberCounterGraphic cue={cue} visibility={visibility} />;
  }
  if (category === "timeline-calendar") {
    return <TimelineGraphic cue={cue} />;
  }
  return <BlueprintGraphic cue={cue} />;
};

export const SemanticSidecallCueVisual: React.FC<SemanticSidecallCueVisualProps> = (props) => {
  const {cue} = props;
  const overlayOpacity = 0.3 + clamp01(props.visibility) * 0.5;
  const accent = getCueAccent(cue);
  const usePersonCallout = cue.cueSource === "typography-only" && looksLikePersonReference(cue);

  return (
    <div
      style={cardShellStyle(props)}
      data-animation-registry-ref="host:semantic-sidecall-cue-visual"
      data-animation-tags="semantic-sidecall template-graphic svg focus-target"
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${accent.glow}, rgba(255,255,255,0) 54%)`,
          opacity: overlayOpacity,
          pointerEvents: "none"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "auto 18px 14px auto",
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent.glow}, rgba(255,255,255,0) 70%)`,
          filter: "blur(18px)",
          opacity: 0.66
        }}
      />
      <div style={{position: "relative", zIndex: 1}}>
        {cue.cueSource === "template-graphic" && cue.templateGraphicCategory
          ? <TemplateGraphic cue={cue} category={cue.templateGraphicCategory} visibility={props.visibility} />
          : usePersonCallout
            ? <PersonCalloutGraphic cue={cue} />
            : <TypographyPlate cue={cue} />}
      </div>
    </div>
  );
};
