import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import type {
  MotionAssetManifest,
  MotionMoodTag,
  MotionShowcasePlacementHint
} from "../src/lib/types.ts";

type ImportManifestItem = {
  status: "processed" | "cached" | "failed" | "skipped";
  assetId: string;
  searchTerms?: string[];
  outputPath?: string;
  originalName?: string;
};

type ImportManifest = {
  batch: string;
  items: ImportManifestItem[];
};

type ShowcaseImportArgs = {
  inputPath: string;
  outputPath: string;
};

type ShowcaseImportHeuristic = {
  canonicalLabel: string;
  placementHint?: MotionShowcasePlacementHint;
  extraSearchTerms?: string[];
  notes: string;
};

const ROOT = process.cwd();
const DEFAULT_INPUT_PATH = path.join(ROOT, "src", "data", "showcase-imports.promethues-with-bg.json");
const DEFAULT_OUTPUT_PATH = path.join(ROOT, "src", "data", "showcase-assets.imports.local.json");
const QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "by",
  "for",
  "from",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "their",
  "these",
  "those",
  "to",
  "was",
  "were",
  "with",
  "you",
  "your"
]);

const parseArgs = (): ShowcaseImportArgs => {
  const args = process.argv.slice(2);
  const readArgValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index < 0) {
      return undefined;
    }
    return args[index + 1]?.trim() || undefined;
  };

  return {
    inputPath: path.resolve(readArgValue("--input") ?? DEFAULT_INPUT_PATH),
    outputPath: path.resolve(readArgValue("--output") ?? DEFAULT_OUTPUT_PATH)
  };
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const tokenize = (value: string): string[] => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
};

const includesAny = (tokens: string[], matches: string[]): boolean => {
  return matches.some((match) => tokens.includes(match));
};

const normalizeShowcaseText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const singularizeToken = (value: string): string => {
  if (value.length > 4 && /(ches|shes|xes|zes|ses)$/i.test(value)) {
    return value.slice(0, -2);
  }
  if (value.length > 4 && value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }
  return value;
};

const normalizeShowcaseLabel = (value: string): string => {
  return normalizeShowcaseText(value).split(" ")[0] ?? "";
};

const normalizeShowcaseSearchTerms = (value: string[], label: string, notes?: string): string[] => {
  const terms = new Set<string>();

  const addTerms = (entry: string): void => {
    const normalized = normalizeShowcaseText(entry);
    if (!normalized) {
      return;
    }
    const tokens = normalized
      .split(" ")
      .map(singularizeToken)
      .filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token));
    if (tokens.length === 0) {
      return;
    }
    terms.add(tokens.join(" "));
    tokens.forEach((token, index) => {
      terms.add(token);
      if (index < tokens.length - 1) {
        terms.add(`${token} ${tokens[index + 1]}`);
      }
    });
  };

  value.forEach(addTerms);
  addTerms(label);
  if (notes) {
    addTerms(notes);
  }

  return [...terms];
};

const normalizeShowcasePlacementHint = (value?: string): MotionShowcasePlacementHint => {
  const normalized = normalizeShowcaseText(value ?? "");
  if (normalized === "left" || normalized === "right" || normalized === "center" || normalized === "corner") {
    return normalized;
  }
  return "auto";
};

const inferShowcaseMoodTags = (label: string, searchTerms: string[]): MotionMoodTag[] => {
  const tags = new Set<MotionMoodTag>(["neutral"]);
  const joined = normalizeShowcaseText([label, ...searchTerms].join(" "));

  if (/(camera|phone|building|brain|watch|bottle|astronaut|king|coin|bill|money|calendar|rocket|clock)/.test(joined)) {
    tags.add("cool");
  }
  if (/(bill|coin|king|mortarboard|suit|building|watch|crown|money|expert|professional|home|authority|safe)/.test(joined)) {
    tags.add("authority");
  }
  if (/(camera|brain|hourglass|building|watch|astronaut|home|money|rocket|airplane|clock)/.test(joined)) {
    tags.add("heroic");
  }
  if (/(hoodie|shirt|camera|phone|bottle|coin|thinking|calendar|coffee|book)/.test(joined)) {
    tags.add("calm");
  }

  return [...tags];
};

const inferShowcaseTier = (label: string): "editorial" | "premium" | "hero" => {
  const normalized = normalizeShowcaseLabel(label);
  if (/(camera|brain|hourglass|watch|astronaut|building|phone|home|rocket|clock|airplane)/.test(normalized)) {
    return "hero";
  }
  if (/(suit|king|mortarboard|bill|bottle|coin|money|expert|calendar|thinking|safe|authority|book)/.test(normalized)) {
    return "premium";
  }
  return "editorial";
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const buildShowcaseAssetManifest = ({
  assetId,
  canonicalLabel,
  sourceFile,
  searchTerms,
  placementHint,
  notes,
  src
}: {
  assetId: string;
  canonicalLabel: string;
  sourceFile: string;
  searchTerms: string[];
  placementHint: MotionShowcasePlacementHint;
  notes?: string;
  src: string;
}): MotionAssetManifest => {
  const canonical = normalizeShowcaseLabel(canonicalLabel);
  const normalizedSearchTerms = normalizeShowcaseSearchTerms(searchTerms, canonical, notes);
  return {
    id: assetId,
    assetRole: "showcase",
    canonicalLabel: canonical,
    showcasePlacementHint: placementHint,
    family: "foreground-element",
    tier: inferShowcaseTier(canonical),
    src,
    alphaMode: "straight",
    placementZone: "foreground-cross",
    durationPolicy: "scene-span",
    themeTags: inferShowcaseMoodTags(canonical, normalizedSearchTerms),
    searchTerms: normalizedSearchTerms,
    safeArea: "full-frame",
    loopable: false,
    blendMode: "normal",
    opacity: 1,
    source: "local",
    sourceId: assetId,
    remoteUrl: sourceFile,
    score: hashString(`${canonical}|${assetId}`) % 100
  };
};

const resolveHeuristic = (assetId: string, searchTerms: string[] = []): ShowcaseImportHeuristic => {
  const tokens = [...new Set([...tokenize(assetId), ...searchTerms.flatMap((term) => tokenize(term))])];

  if (includesAny(tokens, ["airplane", "flight", "fly"])) {
    return {
      canonicalLabel: "airplane",
      placementHint: "right",
      extraSearchTerms: ["travel", "jet", "aviation", "takeoff", "departure"],
      notes: "Airplane cutout for travel, movement, and taking-off language."
    };
  }
  if (includesAny(tokens, ["arrogance", "ego", "narcissism"])) {
    return {
      canonicalLabel: "ego",
      placementHint: "center",
      extraSearchTerms: ["arrogance", "self-image", "pride", "confidence", "identity"],
      notes: "Ego-centric cutout for pride, arrogance, status, and self-image language."
    };
  }
  if (includesAny(tokens, ["authority", "power"])) {
    return {
      canonicalLabel: "authority",
      placementHint: "center",
      extraSearchTerms: ["power", "leadership", "dominance", "status", "control"],
      notes: "Authority-themed cutout for leadership, power, and status language."
    };
  }
  if (includesAny(tokens, ["star", "best"])) {
    return {
      canonicalLabel: "star",
      placementHint: "right",
      extraSearchTerms: ["best", "winner", "premium", "top rated", "excellence"],
      notes: "Star badge cutout for excellence, rating, reward, and premium language."
    };
  }
  if (includesAny(tokens, ["book", "read", "reading"])) {
    return {
      canonicalLabel: "book",
      placementHint: "left",
      extraSearchTerms: ["reading", "knowledge", "study", "education", "learning"],
      notes: "Book cutout for reading, study, and knowledge language."
    };
  }
  if (includesAny(tokens, ["burn", "fire"])) {
    return {
      canonicalLabel: "fire",
      placementHint: "right",
      extraSearchTerms: ["burn", "flame", "heat", "danger", "destruction"],
      notes: "Fire cutout for urgency, danger, destruction, and intensity language."
    };
  }
  if (includesAny(tokens, ["calendar", "calender", "schedule"])) {
    return {
      canonicalLabel: "calendar",
      placementHint: "center",
      extraSearchTerms: ["schedule", "deadline", "date", "planning", "timeline"],
      notes: "Calendar cutout for schedule, date, timeline, and planning language."
    };
  }
  if (includesAny(tokens, ["coffee"])) {
    return {
      canonicalLabel: "coffee",
      placementHint: "left",
      extraSearchTerms: ["morning", "caffeine", "focus", "work", "routine"],
      notes: "Coffee cutout for morning, focus, routine, and work language."
    };
  }
  if (includesAny(tokens, ["gift", "content"])) {
    return {
      canonicalLabel: "gift",
      placementHint: "center",
      extraSearchTerms: ["bonus", "reward", "offer", "present", "value"],
      notes: "Gift cutout for reward, bonus, and offer language."
    };
  }
  if (includesAny(tokens, ["discount", "price"])) {
    return {
      canonicalLabel: "discount",
      placementHint: "center",
      extraSearchTerms: ["deal", "sale", "offer", "coupon", "price cut"],
      notes: "Discount cutout for sale, coupon, deal, and offer language."
    };
  }
  if (includesAny(tokens, ["dumbell", "dumbbell", "work", "exercise", "excersise", "workout"])) {
    return {
      canonicalLabel: "dumbbell",
      placementHint: "left",
      extraSearchTerms: ["workout", "fitness", "exercise", "strength", "gym"],
      notes: "Dumbbell cutout for workout, fitness, gym, and strength language."
    };
  }
  if (includesAny(tokens, ["energy"])) {
    return {
      canonicalLabel: "energy",
      placementHint: "right",
      extraSearchTerms: ["power", "charge", "intensity", "drive", "momentum"],
      notes: "Energy cutout for momentum, charge, and intensity language."
    };
  }
  if (includesAny(tokens, ["escape"])) {
    return {
      canonicalLabel: "escape",
      placementHint: "right",
      extraSearchTerms: ["freedom", "breakout", "exit", "getaway", "leave"],
      notes: "Escape cutout for freedom, exit, and breakthrough language."
    };
  }
  if (includesAny(tokens, ["blueprint"])) {
    return {
      canonicalLabel: "blueprint",
      placementHint: "left",
      extraSearchTerms: ["plan", "architecture", "manual", "document", "strategy"],
      notes: "Blueprint cutout for plans, architecture, and strategic build language."
    };
  }
  if (includesAny(tokens, ["file", "manual", "document"])) {
    return {
      canonicalLabel: "document",
      placementHint: "left",
      extraSearchTerms: ["file", "manual", "paperwork", "records", "checklist"],
      notes: "Document cutout for file, records, and manual process language."
    };
  }
  if (includesAny(tokens, ["safe", "secure", "security"])) {
    return {
      canonicalLabel: "safe",
      placementHint: "left",
      extraSearchTerms: ["secure", "security", "protection", "vault", "locked"],
      notes: "Safe cutout for security, protection, and financial safety language."
    };
  }
  if (includesAny(tokens, ["game"])) {
    return {
      canonicalLabel: "game",
      placementHint: "center",
      extraSearchTerms: ["play", "gaming", "competition", "controller", "strategy"],
      notes: "Game cutout for play, competition, and gaming language."
    };
  }
  if (includesAny(tokens, ["growth", "improve", "improvement", "increase"])) {
    return {
      canonicalLabel: "growth",
      placementHint: "right",
      extraSearchTerms: ["scale", "upward", "progress", "improve", "increase"],
      notes: "Growth cutout for scaling, increase, and progress language."
    };
  }
  if (includesAny(tokens, ["help"])) {
    return {
      canonicalLabel: "help",
      placementHint: "center",
      extraSearchTerms: ["support", "assist", "aid", "service"],
      notes: "Help cutout for support, service, and assistance language."
    };
  }
  if (includesAny(tokens, ["home", "house"])) {
    return {
      canonicalLabel: "home",
      placementHint: "left",
      extraSearchTerms: ["house", "property", "real estate", "household", "living"],
      notes: "Home cutout for house, property, and home-life language."
    };
  }
  if (includesAny(tokens, ["hurry", "time", "important"])) {
    return {
      canonicalLabel: "time",
      placementHint: "right",
      extraSearchTerms: ["urgent", "deadline", "clock", "rush", "time pressure"],
      notes: "Time cutout for urgency, deadline, and rush language."
    };
  }
  if (includesAny(tokens, ["money", "paycheck", "payment", "finance", "assets", "resources"])) {
    return {
      canonicalLabel: "money",
      placementHint: "center",
      extraSearchTerms: ["cash", "finance", "wealth", "payment", "income", "revenue"],
      notes: "Money cutout for payment, cash, finance, and wealth language."
    };
  }
  if (includesAny(tokens, ["notification", "alarm"])) {
    return {
      canonicalLabel: "notification",
      placementHint: "right",
      extraSearchTerms: ["alert", "alarm", "message", "reminder", "ping"],
      notes: "Notification cutout for alert, reminder, and app-ping language."
    };
  }
  if (includesAny(tokens, ["plan", "strategy"])) {
    return {
      canonicalLabel: "plan",
      placementHint: "left",
      extraSearchTerms: ["strategy", "roadmap", "blueprint", "system", "execution"],
      notes: "Planning cutout for strategy, roadmap, and system language."
    };
  }
  if (includesAny(tokens, ["code"])) {
    return {
      canonicalLabel: "code",
      placementHint: "left",
      extraSearchTerms: ["system", "build", "programming", "logic", "plan"],
      notes: "Code cutout for systems, logic, and programming language."
    };
  }
  if (includesAny(tokens, ["cards", "card"])) {
    return {
      canonicalLabel: "card",
      placementHint: "center",
      extraSearchTerms: ["payment card", "credit card", "checkout", "sale", "transaction"],
      notes: "Card cutout for checkout, transaction, and payment-card language."
    };
  }
  if (includesAny(tokens, ["sell", "sale"])) {
    return {
      canonicalLabel: "sales",
      placementHint: "center",
      extraSearchTerms: ["sell", "sales", "close", "offer", "transaction"],
      notes: "Sales cutout for selling, closing, and transaction language."
    };
  }
  if (includesAny(tokens, ["message", "messagea", "send"])) {
    return {
      canonicalLabel: "message",
      placementHint: "right",
      extraSearchTerms: ["send", "chat", "text", "communication", "outreach"],
      notes: "Message cutout for sending, chat, communication, and outreach language."
    };
  }
  if (includesAny(tokens, ["rocket", "speed", "fast"])) {
    return {
      canonicalLabel: "rocket",
      placementHint: "right",
      extraSearchTerms: ["speed", "fast", "launch", "takeoff", "acceleration"],
      notes: "Rocket cutout for speed, launch, acceleration, and fast-growth language."
    };
  }
  if (includesAny(tokens, ["strong", "powerful"])) {
    return {
      canonicalLabel: "strength",
      placementHint: "center",
      extraSearchTerms: ["strong", "powerful", "force", "resilient", "authority"],
      notes: "Strength cutout for power, force, resilience, and authority language."
    };
  }
  if (includesAny(tokens, ["telephone", "call", "outreach"])) {
    return {
      canonicalLabel: "phone",
      placementHint: "right",
      extraSearchTerms: ["call", "outreach", "dial", "communication", "sales call"],
      notes: "Phone cutout for call, outreach, dialing, and communication language."
    };
  }
  if (includesAny(tokens, ["clock", "hourglass"])) {
    return {
      canonicalLabel: "clock",
      placementHint: "right",
      extraSearchTerms: ["time", "deadline", "hourglass", "countdown", "urgency"],
      notes: "Clock cutout for time, countdown, and deadline language."
    };
  }

  return {
    canonicalLabel: tokens[0] ?? "asset",
    placementHint: "center",
    extraSearchTerms: [],
    notes: `Imported showcase cutout from ${assetId}.`
  };
};

const toPublicRelativePath = (value: string): string => {
  return value.replace(/^public[\\/]/, "").replace(/\\/g, "/");
};

const sortById = (records: MotionAssetManifest[]): MotionAssetManifest[] => {
  return [...records].sort((a, b) => a.id.localeCompare(b.id));
};

const syncShowcaseImports = async (): Promise<void> => {
  const args = parseArgs();
  const content = await readFile(args.inputPath, "utf-8");
  const manifest = JSON.parse(content) as ImportManifest;

  const records = manifest.items
    .filter((item) => (item.status === "processed" || item.status === "cached") && item.outputPath)
    .map((item) => {
      const heuristic = resolveHeuristic(item.assetId, item.searchTerms);
      const sourceFile = toPublicRelativePath(item.outputPath as string);
      const searchTerms = [...(item.searchTerms ?? []), ...(heuristic.extraSearchTerms ?? [])];

      return buildShowcaseAssetManifest({
        assetId: item.assetId,
        canonicalLabel: heuristic.canonicalLabel,
        sourceFile,
        searchTerms,
        placementHint: normalizeShowcasePlacementHint(heuristic.placementHint),
        notes: heuristic.notes,
        src: sourceFile
      });
    });

  await writeJson(args.outputPath, sortById(records));

  console.log(`Showcase import catalog synced: ${records.length} assets`);
  console.log(`Manifest: ${args.outputPath}`);
};

syncShowcaseImports().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
