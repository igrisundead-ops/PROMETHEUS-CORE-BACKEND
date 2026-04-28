import type {VectorPartition} from "./schemas";

export const PROMETHEUS_CREATIVE_ASSET_COLLECTION = "prometheus_creative_assets";

export const VECTOR_PARTITIONS: VectorPartition[] = [
  "static_images",
  "motion_graphics",
  "gsap_animation_logic",
  "typography",
  "references"
];

export const DEFAULT_VECTOR_TOP_K = 12;
