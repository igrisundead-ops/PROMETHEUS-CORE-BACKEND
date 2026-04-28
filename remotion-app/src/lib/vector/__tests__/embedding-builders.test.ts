import {describe, expect, it} from "vitest";

import {
  buildGsapAnimationEmbeddingText,
  buildMotionGraphicsEmbeddingText,
  buildStaticImageEmbeddingText,
  normalizeGsapAnimationMetadata,
  normalizeMotionGraphicMetadata,
  normalizeStaticImageMetadata
} from "..";

describe("vector embedding builders", () => {
  it("static image metadata uses the visual-symbolic embedding builder", () => {
    const record = normalizeStaticImageMetadata({
      id: "static-1",
      filename: "credit-card.png",
      relative_path: "finance/credit-card.png",
      dimensions: {
        width: 1080,
        height: 1350,
        aspect_ratio: "4:5"
      },
      detected_objects: ["credit card", "dark fintech object"],
      folder_context: {
        category: "fintech-authority",
        brand_context: "premium-finance",
        use_cases: ["product-showcase", "landing-page-hero"]
      },
      literal_tags: ["credit-card", "wallet", "payment"],
      symbolic_tags: ["wealth access", "premium privilege", "financial authority"],
      narrative_tags: ["product showcase", "conversion scene"],
      brand_tags: ["premium", "executive"],
      motion_tags: ["parallax-ready", "depth-ready"],
      conversion_tags: ["cta-ready", "hero-section"]
    });

    const text = buildStaticImageEmbeddingText(record);

    expect(text).toMatch(/Static visual asset showing/i);
    expect(text).toMatch(/wealth access/i);
    expect(text).toMatch(/parallax-ready/i);
    expect(text).toMatch(/4:5/i);
  });

  it("motion graphics metadata uses the component-motion embedding builder", () => {
    const record = normalizeMotionGraphicMetadata({
      assetId: "motion-1",
      assetName: "Process Disclosure",
      primaryFunction: "procedural_disclosure",
      secondaryFunctions: ["step_by_step_explanation"],
      emotionalRoles: ["clarity", "trust"],
      rhetoricalRoles: ["education", "organization"],
      visualEnergy: "moderate",
      motionBehavior: ["sequential_revelation", "luminous_emergence"],
      styleFamily: ["cinematic_premium"],
      creatorFit: ["authority_builder"],
      sceneUseCases: ["tutorial", "sales_funnel_breakdown"],
      symbolicMeaning: ["structure", "clarity"],
      renderComplexity: "moderate",
      recommendedPlacement: ["key_point"],
      features: {
        blur_effect: true,
        glow_effect: true
      }
    });

    const text = buildMotionGraphicsEmbeddingText(record);

    expect(text).toMatch(/Motion graphic for/i);
    expect(text).toMatch(/sequential_revelation/i);
    expect(text).toMatch(/cinematic_premium/i);
    expect(text).toMatch(/sales_funnel_breakdown/i);
  });

  it("GSAP metadata uses the animation-logic embedding builder", () => {
    const record = normalizeGsapAnimationMetadata({
      moduleId: "gsap-1",
      moduleName: "Hero Reveal Logic",
      relativePath: "/Hero Reveal Logic",
      primaryAnimationFunction: "hero_asset_reveal",
      rhetoricalRoles: ["authority", "hook"],
      emotionalRoles: ["premium", "confidence"],
      sceneUseCases: ["founder_intro"],
      motionGrammar: ["blur_to_clarity", "scale_up_reveal", "floating_hover"],
      supportedAssetTypes: ["static_image", "logo", "card_component"],
      replaceableSlots: [
        {
          slotName: "mainAsset",
          slotType: "image_or_svg",
          description: "Primary reveal asset"
        }
      ],
      compatibility: {
        worksWithStaticImages: true,
        worksWithTypography: true,
        requiresTransparentAsset: true
      },
      negativeGrammar: {
        forbiddenPairings: ["heavy text density must dominate immediately"]
      },
      styleFamily: ["cinematic_premium", "apple_style"],
      creatorFit: ["premium_creator"]
    });

    const text = buildGsapAnimationEmbeddingText(record);

    expect(text).toMatch(/GSAP animation logic for/i);
    expect(text).toMatch(/blur_to_clarity/i);
    expect(text).toMatch(/static_image/i);
    expect(text).toMatch(/heavy text density/i);
  });
});
