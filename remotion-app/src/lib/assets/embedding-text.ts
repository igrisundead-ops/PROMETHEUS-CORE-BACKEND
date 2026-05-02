import type {AssetEmbeddingTextMode, NormalizedAssetDocument} from "./types";
import {normalizeAssetText, uniqueStrings} from "./text-utils";

type TextFieldContribution = {
  field: string;
  chars: number;
  value: string;
};

const GENERIC_TAGS = new Set([
  "asset",
  "assets",
  "html",
  "json",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "svg",
  "mp4",
  "webm",
  "mov",
  "source",
  "folder",
  "batch",
  "showcase",
  "authoring",
  "motion",
  "static",
  "image",
  "images",
  "file",
  "files"
]);

const STYLE_HINT_PATTERN = /(editorial|premium|minimal|hero|kinetic|calm|warm|cool|glass|frosted|cinematic|bold|soft|subtle|dynamic|glow|halo|hud|clean|modern|typewriter|typography|grid|luxury|tech|spotlight|dramatic|reflective|polished|elevated|gradient|neon|sleek|monumental|gentle|sharp)/;
const ROLE_HINT_PATTERN = /(headline|hook|quote|authority|support|accent|transition|underlay|background|cta|callout|profile|portrait|timeline|step|process|comparison|proof|testimonial|hero|scene|statement|interface|command|overlay|title|opener|closer|card)/;

const clampSentence = (value: string, maxChars: number): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxChars);
  const boundary = Math.max(sliced.lastIndexOf(". "), sliced.lastIndexOf(", "), sliced.lastIndexOf(" "));
  return `${(boundary > 40 ? sliced.slice(0, boundary) : sliced).trim()}.`;
};

const truncateList = (values: string[], maxItems: number, maxChars: number): string[] => {
  const kept: string[] = [];
  let totalChars = 0;

  for (const value of values) {
    if (kept.length >= maxItems) {
      break;
    }
    const nextChars = totalChars + value.length + (kept.length > 0 ? 2 : 0);
    if (nextChars > maxChars) {
      break;
    }
    kept.push(value);
    totalChars = nextChars;
  }

  return kept;
};

const sanitizeTag = (value: string): string => {
  const normalized = normalizeAssetText(value);
  if (!normalized) {
    return "";
  }
  if (GENERIC_TAGS.has(normalized)) {
    return "";
  }
  if (/^[0-9]+$/.test(normalized)) {
    return "";
  }
  if (/^[a-f0-9]{16,}$/i.test(normalized.replace(/\s+/g, ""))) {
    return "";
  }
  return normalized;
};

const displayNameForDocument = (document: NormalizedAssetDocument): string => {
  const stem = document.filename.replace(document.file_extension, "");
  return uniqueStrings([
    document.labels[0],
    stem,
    document.folder_name
  ])[0] ?? stem;
};

const buildCompatibilityLine = (document: NormalizedAssetDocument): string => {
  const fragments = [
    document.contexts.length > 0 ? `best for ${truncateList(document.contexts, 3, 120).join(", ")}` : "",
    document.anti_contexts.length > 0 ? `avoid ${truncateList(document.anti_contexts, 2, 90).join(", ")}` : "",
    document.constraints.length > 0 ? `constraints ${truncateList(document.constraints, 4, 140).join(", ")}` : ""
  ].filter(Boolean);

  return fragments.join("; ");
};

const pickCoreTags = (document: NormalizedAssetDocument): string[] => {
  const candidateTags = uniqueStrings([
    displayNameForDocument(document),
    document.subject,
    document.category,
    document.animation_family,
    document.retrieval_caption,
    document.semantic_description,
    ...document.labels,
    ...document.tags
  ].map(sanitizeTag).filter(Boolean));

  return truncateList(candidateTags, 10, 180);
};

const pickRoleTags = (document: NormalizedAssetDocument): string[] => {
  const roles = uniqueStrings([
    document.dominant_visual_role,
    ...document.tags.filter((tag) => ROLE_HINT_PATTERN.test(normalizeAssetText(tag))),
    ...document.labels.filter((label) => ROLE_HINT_PATTERN.test(normalizeAssetText(label)))
  ].map(sanitizeTag).filter(Boolean));

  return truncateList(roles, 5, 110);
};

const pickStyleTags = (document: NormalizedAssetDocument): string[] => {
  const styles = uniqueStrings([
    document.animation_family,
    document.motion_intensity,
    ...document.mood,
    ...document.tags.filter((tag) => STYLE_HINT_PATTERN.test(normalizeAssetText(tag))),
    ...document.labels.filter((label) => STYLE_HINT_PATTERN.test(normalizeAssetText(label)))
  ].map(sanitizeTag).filter(Boolean));

  return truncateList(styles, 8, 140);
};

export const buildCompactAssetEmbeddingText = (document: NormalizedAssetDocument): string => {
  const description = clampSentence(uniqueStrings([
    document.retrieval_caption,
    document.semantic_description
  ]).join(" "), 180);
  const coreTags = pickCoreTags(document);
  const roleTags = pickRoleTags(document);
  const styleTags = pickStyleTags(document);
  const compatibility = clampSentence(buildCompatibilityLine(document), 180);

  const sections = [
    `Asset name: ${displayNameForDocument(document)}.`,
    `Asset type: ${document.asset_type}.`,
    `Description: ${description}`,
    coreTags.length > 0 ? `Core tags: ${coreTags.join(", ")}.` : "",
    roleTags.length > 0 ? `Rhetorical roles: ${roleTags.join(", ")}.` : "",
    styleTags.length > 0 ? `Visual and motion style: ${styleTags.join(", ")}.` : "",
    compatibility ? `Compatibility: ${compatibility}` : ""
  ].filter(Boolean);

  return clampSentence(sections.join(" "), 720);
};

export const resolveAssetEmbeddingText = (
  document: NormalizedAssetDocument,
  mode: AssetEmbeddingTextMode
): string => {
  if (mode === "compact") {
    return buildCompactAssetEmbeddingText(document);
  }

  return document.embedding_text;
};

export const estimateTextTokens = (value: string): number => Math.max(1, Math.ceil(value.length / 4));

export const getAssetEmbeddingFieldContributions = (document: NormalizedAssetDocument): TextFieldContribution[] => {
  const fields: Array<TextFieldContribution | null> = [
    {field: "retrieval_caption", chars: document.retrieval_caption.length, value: document.retrieval_caption},
    {field: "semantic_description", chars: document.semantic_description.length, value: document.semantic_description},
    {field: "labels", chars: document.labels.join(", ").length, value: document.labels.join(", ")},
    {field: "tags", chars: document.tags.join(", ").length, value: document.tags.join(", ")},
    {field: "contexts", chars: document.contexts.join(", ").length, value: document.contexts.join(", ")},
    {field: "anti_contexts", chars: document.anti_contexts.join(", ").length, value: document.anti_contexts.join(", ")},
    {field: "constraints", chars: document.constraints.join(", ").length, value: document.constraints.join(", ")},
    {field: "mood", chars: document.mood.join(", ").length, value: document.mood.join(", ")},
    {field: "animation_family", chars: document.animation_family.length, value: document.animation_family},
    {field: "motion_intensity", chars: document.motion_intensity.length, value: document.motion_intensity},
    {field: "subject", chars: document.subject.length, value: document.subject},
    {field: "category", chars: document.category.length, value: document.category},
    {field: "dominant_visual_role", chars: document.dominant_visual_role.length, value: document.dominant_visual_role},
    {field: "filename", chars: document.filename.length, value: document.filename},
    {field: "folder_name", chars: document.folder_name.length, value: document.folder_name}
  ];

  return fields
    .filter((entry): entry is TextFieldContribution => Boolean(entry && entry.chars > 0))
    .sort((left, right) => right.chars - left.chars);
};
