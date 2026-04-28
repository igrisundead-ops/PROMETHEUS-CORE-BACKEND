(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function keyForWord(word) {
    return String(word || "").replace(/[\u2019]/g, "'").trim().toLowerCase();
  }

  function cloneProfile(profile) {
    return {
      word: profile.word,
      motionPreset: profile.motionPreset,
      typographyPreset: profile.typographyPreset,
      timing: Object.assign({}, profile.timing || {}),
      meta: Object.assign({}, profile.meta || {})
    };
  }

  function resolveEase(easingRegistry, token) {
    return easingRegistry && typeof easingRegistry.resolve === "function"
      ? easingRegistry.resolve(token)
      : token;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeWordCountFilter(value) {
    var filter = String(value || "all").trim().toLowerCase();
    if (filter === "all" || filter === "8+") {
      return filter;
    }
    if (/^[1-7]$/.test(filter)) {
      return filter;
    }
    return "all";
  }

  function countWordTokens(splitter, value) {
    return splitter.tokenizeWords(value).length;
  }

  function matchesWordCountFilter(splitter, value, filter) {
    var normalizedFilter = normalizeWordCountFilter(filter);
    if (normalizedFilter === "all") {
      return true;
    }

    var tokenCount = countWordTokens(splitter, value);
    if (normalizedFilter === "8+") {
      return tokenCount >= 8;
    }

    return tokenCount === Number(normalizedFilter);
  }

  function normalizeWeightMap(weights, fallbackKeys) {
    var source = typeof weights === "object" && weights ? weights : {};
    var allowed = Array.isArray(fallbackKeys) ? fallbackKeys.slice(0) : [];
    var normalized = {};
    var total = 0;

    allowed.forEach(function (key) {
      var value = Number(source[key]);
      var safeValue = Number.isFinite(value) && value > 0 ? value : 0;
      normalized[key] = safeValue;
      total += safeValue;
    });

    if (total <= 0 && allowed.length > 0) {
      var equalWeight = 1 / allowed.length;
      allowed.forEach(function (key) {
        normalized[key] = equalWeight;
      });
      return normalized;
    }

    if (total > 0) {
      allowed.forEach(function (key) {
        normalized[key] = normalized[key] / total;
      });
    }

    return normalized;
  }

  function pickWeightedKey(weights, fallbackKey) {
    var keys = Object.keys(weights || {});
    if (keys.length === 0) {
      return fallbackKey;
    }

    var roll = Math.random();
    var cursor = 0;
    var index;

    for (index = 0; index < keys.length; index += 1) {
      var key = keys[index];
      cursor += Number(weights[key]) || 0;
      if (roll <= cursor) {
        return key;
      }
    }

    return fallbackKey || keys[keys.length - 1];
  }

  function hashString(value) {
    var input = String(value || "");
    var hash = 2166136261;
    var index;
    for (index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pickDeterministicWeightedKey(weights, seed, fallbackKey) {
    var keys = Object.keys(weights || {});
    if (keys.length === 0) {
      return fallbackKey;
    }

    var roll = (hashString(seed) % 10000) / 10000;
    var cursor = 0;
    var index;

    for (index = 0; index < keys.length; index += 1) {
      var key = keys[index];
      cursor += Number(weights[key]) || 0;
      if (roll <= cursor) {
        return key;
      }
    }

    return fallbackKey || keys[keys.length - 1];
  }

  var DEFAULT_DESCRIPTOR_WORD_SET = {
    "a": true,
    "an": true,
    "and": true,
    "as": true,
    "at": true,
    "by": true,
    "for": true,
    "from": true,
    "in": true,
    "is": true,
    "of": true,
    "on": true,
    "or": true,
    "the": true,
    "to": true,
    "with": true,
    "here": true,
    "there": true,
    "then": true,
    "that": true
  };

  function normalizeDescriptorToken(value) {
    return keyForWord(value).replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "");
  }

  function normalizeDescriptorList(value) {
    return asArray(value)
      .map(normalizeDescriptorToken)
      .filter(Boolean);
  }

  function buildDescriptorWordSet(includes, excludes) {
    var descriptorSet = Object.assign({}, DEFAULT_DESCRIPTOR_WORD_SET);

    normalizeDescriptorList(includes).forEach(function (word) {
      descriptorSet[word] = true;
    });
    normalizeDescriptorList(excludes).forEach(function (word) {
      if (Object.prototype.hasOwnProperty.call(descriptorSet, word)) {
        delete descriptorSet[word];
      }
    });

    return descriptorSet;
  }

  function resolveDescriptorPolicy(meta, tokenCount) {
    var count = Number(tokenCount) || 0;
    if (count < 4) {
      return {
        enabled: false,
        mode: "off",
        hideOnFinalOverflow: false,
        descriptorSet: {}
      };
    }

    var sourceMeta = meta && typeof meta === "object" ? meta : {};
    var mode = String(sourceMeta.descriptorMode || "off").toLowerCase();
    if (mode === "off") {
      return {
        enabled: false,
        mode: "off",
        hideOnFinalOverflow: false,
        descriptorSet: {}
      };
    }
    if (mode !== "hide") {
      mode = "italic-keep";
    }

    return {
      enabled: true,
      mode: mode,
      hideOnFinalOverflow: sourceMeta.descriptorHideOnFinalOverflow !== false,
      descriptorSet: buildDescriptorWordSet(sourceMeta.descriptorWords, sourceMeta.descriptorExcludeWords)
    };
  }

  function isDescriptorWord(rawWord, policy) {
    if (!policy || !policy.enabled) {
      return false;
    }
    var normalized = normalizeDescriptorToken(rawWord);
    if (!normalized) {
      return false;
    }
    return Boolean(policy.descriptorSet[normalized]);
  }

  ns.createTextCompartment = function createTextCompartment(options) {
    var config = Object.assign(
      {
        containerSelector: "#textCompartment",
        layerCurrentSelector: "#textWordCurrent",
        layerNextSelector: "#textWordNext",
        backContainerSelector: "#textCompartmentBack",
        backLayerCurrentSelector: "#textWordBackCurrent",
        backLayerNextSelector: "#textWordBackNext",
        focusFrameSelector: "#textFocusFrame",
        defaultWords: [
          "INDUSTRY EXPERTS AND THOUGHT LEADERS."
        ],
        overlapSeconds: 0.16,
        intervalMs: 3200,
        autoRotate: true,
        threeWordConfig: {
          punchPosition: "middle",
          intensity: "medium",
          styleWeights: {
            serifElegance: 0.4,
            tallCondensed: 0.35,
            scriptAccent: 0.25
          }
        },
        fourWordConfig: {
          intensity: "medium",
          styleWeights: {
            bannerDrift: 0.3,
            splitStagger: 0.25,
            serifPivot: 0.23,
            outlineWhip: 0.22
          }
        },
        fitRule: {
          horizontalPaddingRatio: 0.04,
          verticalPaddingRatio: 0.08,
          minScale: 0.24,
          maxScale: 1.22
        }
      },
      options || {}
    );

    var containerEl = document.querySelector(config.containerSelector);
    var layerCurrentEl = document.querySelector(config.layerCurrentSelector);
    var layerNextEl = document.querySelector(config.layerNextSelector);
    var backContainerEl = document.querySelector(config.backContainerSelector);
    var backLayerCurrentEl = document.querySelector(config.backLayerCurrentSelector);
    var backLayerNextEl = document.querySelector(config.backLayerNextSelector);
    var focusFrameEl = document.querySelector(config.focusFrameSelector);
    var hasBackPlane = Boolean(backContainerEl && backLayerCurrentEl && backLayerNextEl);

    if (!containerEl || !layerCurrentEl || !layerNextEl || !focusFrameEl) {
      throw new Error("Text compartment elements were not found.");
    }

    if (!hasBackPlane && (backContainerEl || backLayerCurrentEl || backLayerNextEl)) {
      console.warn("Back text plane is partially configured and will be disabled.");
      backContainerEl = null;
      backLayerCurrentEl = null;
      backLayerNextEl = null;
    }

    var textTemplateEngine = config.textTemplateEngine || ns.createTextTemplateEngine();
    var splitter = textTemplateEngine.splitter || ns.createTextSplitter();
    var easingRegistry =
      config.easingRegistry ||
      (config.motionEngine && typeof config.motionEngine.getEasingRegistry === "function"
        ? config.motionEngine.getEasingRegistry()
        : ns.createEasingRegistry());

    var textMotionPresets = ns.createTextMotionPresets();
    Object.keys(textMotionPresets).forEach(function (name) {
      textTemplateEngine.registerTextMotionPreset(name, textMotionPresets[name]);
    });

    var textTypographyPresets = ns.createTextTypographyPresets();
    Object.keys(textTypographyPresets).forEach(function (name) {
      textTemplateEngine.registerTypographyPreset(name, textTypographyPresets[name]);
    });

    var wordCountTemplates = ns.createWordCountTemplates();
    Object.keys(wordCountTemplates).forEach(function (count) {
      textTemplateEngine.registerWordCountTemplate(Number(count), wordCountTemplates[count]);
    });

    var defaultProfiles = {
      Agentic: {
        word: "Agentic",
        motionPreset: "agentic_split_rise",
        typographyPreset: "tall_agentic_heavy",
        timing: { inDuration: 0.92, outDuration: 0.62, stagger: 0.028, hold: 1.58 }
      },
      Interesting: {
        word: "Interesting",
        motionPreset: "interesting_blur_lift",
        typographyPreset: "tall_interesting_medium",
        timing: { inDuration: 1.02, outDuration: 0.68, stagger: 0.032, hold: 1.62 }
      },
      Cinematic: {
        word: "Cinematic",
        motionPreset: "cinematic_focus_lock",
        typographyPreset: "tall_cinematic_contrast",
        timing: { inDuration: 1.0, outDuration: 0.72, stagger: 0, hold: 1.7 }
      },
      "INDUSTRY EXPERTS AND THOUGHT LEADERS.": {
        word: "INDUSTRY EXPERTS AND THOUGHT LEADERS.",
        motionPreset: "cinematic_focus_lock",
        typographyPreset: "cinematic_uniform_caps",
        timing: { inDuration: 1.0, outDuration: 0.72, stagger: 0, hold: 1.7 }
      },
      "Right Now": {
        word: "Right Now",
        motionPreset: "two_word_cinematic_pair",
        typographyPreset: "duo_script_block",
        timing: { inDuration: 1.08, outDuration: 0.66, stagger: 0.095, hold: 1.72 }
      },
      "You When": {
        word: "You When",
        motionPreset: "two_word_stagger_punch",
        typographyPreset: "duo_clean_punch",
        timing: { inDuration: 0.96, outDuration: 0.62, stagger: 0.082, hold: 1.55 }
      },
      "Stay Sharp": {
        word: "Stay Sharp",
        motionPreset: "two_word_arc_sweep",
        typographyPreset: "duo_serif_strike",
        timing: { inDuration: 1.06, outDuration: 0.64, stagger: 0.098, hold: 1.66 }
      },
      "High Value": {
        word: "High Value",
        motionPreset: "two_word_dual_rise",
        typographyPreset: "duo_outline_blade",
        timing: { inDuration: 0.98, outDuration: 0.62, stagger: 0.086, hold: 1.56 }
      },
      "Move Silent": {
        word: "Move Silent",
        motionPreset: "two_word_focus_pivot",
        typographyPreset: "duo_luxe_whisper",
        timing: { inDuration: 1.0, outDuration: 0.7, stagger: 0.09, hold: 1.7 }
      },
      "To Happen": {
        word: "To Happen",
        motionPreset: "two_word_script_caption_lock",
        typographyPreset: "duo_script_caption",
        timing: { inDuration: 0.98, outDuration: 0.6, stagger: 0.075, hold: 1.66 },
        meta: {
          styleBias: "scriptCaption",
          layoutVariant: "quad-duo-depth",
          partGroups: [[0], [1]],
          planeMode: "single",
          referencePack: "cinematic-research-v1",
          referenceId: "two-word-script-caption"
        }
      },
      "Lead With Quiet Power": {
        word: "Lead With Quiet Power",
        motionPreset: "four_word_banner_drift",
        typographyPreset: "quad_banner_tall",
        timing: { inDuration: 1.0, outDuration: 0.6, stagger: 0.052, hold: 1.64 },
        meta: {
          styleBias: "bannerDrift",
          layoutVariant: "quad-banner",
          partGroups: [[0, 1], [2], [3]],
          planeMode: "single",
          referencePack: "cinematic-research-v1",
          referenceId: "quad-banner-drift"
        }
      },
      "Discipline Beats Mood Daily": {
        word: "Discipline Beats Mood Daily",
        motionPreset: "four_word_split_stagger",
        typographyPreset: "quad_split_tall",
        timing: { inDuration: 0.98, outDuration: 0.58, stagger: 0.054, hold: 1.58 },
        meta: {
          styleBias: "splitStagger",
          layoutVariant: "quad-split",
          partGroups: [[0], [1, 2], [3]],
          planeMode: "single",
          referencePack: "cinematic-research-v1",
          referenceId: "quad-split-stagger"
        }
      },
      "Build Systems Not Excuses": {
        word: "Build Systems Not Excuses",
        motionPreset: "four_word_serif_pivot",
        typographyPreset: "quad_serif_contrast",
        timing: { inDuration: 1.02, outDuration: 0.62, stagger: 0.05, hold: 1.68 },
        meta: {
          styleBias: "serifPivot",
          layoutVariant: "quad-serif",
          partGroups: [[0, 1], [2], [3]],
          planeMode: "single",
          referencePack: "cinematic-research-v1",
          referenceId: "quad-serif-pivot"
        }
      },
      "Think Long Term Always": {
        word: "Think Long Term Always",
        motionPreset: "four_word_outline_whip",
        typographyPreset: "quad_outline_compressed",
        timing: { inDuration: 0.94, outDuration: 0.56, stagger: 0.05, hold: 1.54 },
        meta: {
          styleBias: "outlineWhip",
          layoutVariant: "quad-outline",
          partGroups: [[0], [1], [2, 3]],
          planeMode: "single",
          referencePack: "cinematic-research-v1",
          referenceId: "quad-outline-whip"
        }
      },
      "Your Future Self Is Already Here": {
        word: "Your Future Self Is Already Here",
        motionPreset: "six_word_quad_duo_depth",
        typographyPreset: "six_quad_duo_cinematic",
        timing: { inDuration: 1.04, outDuration: 0.62, stagger: 0.056, hold: 1.74 },
        meta: {
          styleBias: "quadDuoDepth",
          layoutVariant: "quad-duo-depth",
          partGroups: [[0, 1, 2, 3], [4], [5]],
          depthMap: { back: [0], front: [1, 2] },
          planeMode: "split-depth",
          referencePack: "cinematic-research-v1",
          referenceId: "six-word-quad-duo-a"
        }
      },
      "Built in Silence Seen in Results": {
        word: "Built in Silence Seen in Results",
        motionPreset: "six_word_quad_duo_depth",
        typographyPreset: "six_quad_duo_joiner_locale",
        timing: { inDuration: 1.04, outDuration: 0.62, stagger: 0.056, hold: 1.74 },
        meta: {
          styleBias: "quadDuoJoiner",
          layoutVariant: "quad-duo-depth",
          partGroups: [[0, 1, 2, 3], [4], [5]],
          depthMap: { back: [0], front: [1, 2] },
          planeMode: "split-depth",
          referencePack: "cinematic-research-v1",
          referenceId: "six-word-quad-duo-joiner"
        }
      },
      "Dream BIG NOW": {
        word: "Dream BIG NOW",
        motionPreset: "three_word_ref_dream_big_now_v1",
        typographyPreset: "trio_ref_dream_big_now_v1",
        timing: { inDuration: 0.96, outDuration: 0.58, stagger: 0.054, hold: 1.54 },
        meta: {
          styleBias: "legacyShadow",
          punchPosition: "middle",
          intensity: "medium",
          layoutVariant: "dream-big-now",
          partGroups: [[0], [1], [2]],
          referencePack: "legacy-shadow-v1",
          referenceId: "dream-big-now",
          referenceLock: true
        }
      },
      "Your MASTER MIND": {
        word: "Your MASTER MIND",
        motionPreset: "three_word_ref_your_master_mind_v1",
        typographyPreset: "trio_ref_your_master_mind_v1",
        timing: { inDuration: 0.98, outDuration: 0.6, stagger: 0.058, hold: 1.58 },
        meta: {
          styleBias: "legacyShadow",
          punchPosition: "middle",
          intensity: "medium",
          layoutVariant: "your-master-mind",
          partGroups: [[0], [1], [2]],
          referencePack: "legacy-shadow-v1",
          referenceId: "your-master-mind",
          referenceLock: true
        }
      },
      "Take ACTION NOW": {
        word: "Take ACTION NOW",
        motionPreset: "three_word_ref_take_action_now_v1",
        typographyPreset: "trio_ref_take_action_now_v1",
        timing: { inDuration: 0.96, outDuration: 0.58, stagger: 0.055, hold: 1.52 },
        meta: {
          styleBias: "legacyShadow",
          punchPosition: "middle",
          intensity: "medium",
          layoutVariant: "take-action-now",
          partGroups: [[0], [1], [2]],
          referencePack: "legacy-shadow-v1",
          referenceId: "take-action-now",
          referenceLock: true
        }
      },
      "Build LEGACY YOUR": {
        word: "Build LEGACY YOUR",
        motionPreset: "three_word_ref_build_legacy_your_v1",
        typographyPreset: "trio_ref_build_legacy_your_v1",
        timing: { inDuration: 0.98, outDuration: 0.6, stagger: 0.057, hold: 1.56 },
        meta: {
          styleBias: "legacyShadow",
          punchPosition: "middle",
          intensity: "medium",
          layoutVariant: "build-legacy-your",
          partGroups: [[0], [1], [2]],
          referencePack: "legacy-shadow-v1",
          referenceId: "build-legacy-your",
          referenceLock: true
        }
      },
      "You're Maybe Going": {
        word: "You're Maybe Going",
        motionPreset: "three_word_ref_lockup",
        typographyPreset: "trio_ref_maybe",
        timing: { inDuration: 1.06, outDuration: 0.66, stagger: 0.084, hold: 1.7 },
        meta: {
          styleBias: "serifElegance",
          punchPosition: "middle",
          intensity: "medium",
          layoutVariant: "maybe",
          partGroups: [[0], [1], [2]],
          referenceLock: true
        }
      },
      "It Won't Last": {
        word: "It Won't Last",
        motionPreset: "three_word_ref_last_punch",
        typographyPreset: "trio_ref_last",
        timing: { inDuration: 1.02, outDuration: 0.62, stagger: 0.078, hold: 1.58 },
        meta: {
          styleBias: "serifElegance",
          punchPosition: "last",
          intensity: "medium",
          layoutVariant: "last",
          partGroups: [[0, 1], [2]],
          referenceLock: true
        }
      },
      "Be The Person": {
        word: "Be The Person",
        motionPreset: "three_word_ref_last_punch",
        typographyPreset: "trio_ref_person",
        timing: { inDuration: 1.0, outDuration: 0.6, stagger: 0.076, hold: 1.56 },
        meta: {
          styleBias: "serifElegance",
          punchPosition: "last",
          intensity: "medium",
          layoutVariant: "person",
          partGroups: [[0, 1], [2]],
          referenceLock: true
        }
      },
      "But Who Cares": {
        word: "But Who Cares",
        motionPreset: "three_word_ref_script_tag",
        typographyPreset: "trio_ref_script",
        timing: { inDuration: 1.02, outDuration: 0.64, stagger: 0.082, hold: 1.62 },
        meta: {
          styleBias: "scriptAccent",
          punchPosition: "last",
          intensity: "medium",
          layoutVariant: "script",
          partGroups: [[0], [1, 2]],
          referenceLock: true
        }
      },
      "Through You're Going": {
        word: "Through You're Going",
        motionPreset: "three_word_ref_through_column",
        typographyPreset: "trio_ref_through",
        timing: { inDuration: 0.98, outDuration: 0.62, stagger: 0.074, hold: 1.54 },
        meta: {
          styleBias: "tallCondensed",
          punchPosition: "middle",
          intensity: "medium",
          layoutVariant: "through",
          partGroups: [[0], [1], [2]],
          referenceLock: true
        }
      }
    };

    var defaultProfileLookup = new Map();
    Object.keys(defaultProfiles).forEach(function (name) {
      defaultProfileLookup.set(keyForWord(name), defaultProfiles[name]);
    });

    var threeWordSettings = Object.assign(
      {
        punchPosition: "middle",
        intensity: "medium",
        styleWeights: {
          serifElegance: 0.4,
          tallCondensed: 0.35,
          scriptAccent: 0.25
        }
      },
      config.threeWordConfig || {}
    );

    var fourWordSettings = Object.assign(
      {
        intensity: "medium",
        styleWeights: {
          bannerDrift: 0.3,
          splitStagger: 0.25,
          serifPivot: 0.23,
          outlineWhip: 0.22
        }
      },
      config.fourWordConfig || {}
    );

    var threeWordBiasProfiles = {
      serifElegance: {
        motionPreset: "three_word_serif_orbit",
        typographyPreset: "trio_serif_punch_middle",
        timing: { inDuration: 1.08, outDuration: 0.68, stagger: 0.086, hold: 1.72 }
      },
      tallCondensed: {
        motionPreset: "three_word_tall_blade",
        typographyPreset: "trio_tall_punch_middle",
        timing: { inDuration: 0.96, outDuration: 0.62, stagger: 0.076, hold: 1.56 }
      },
      scriptAccent: {
        motionPreset: "three_word_script_glide",
        typographyPreset: "trio_script_punch_middle",
        timing: { inDuration: 1.02, outDuration: 0.66, stagger: 0.082, hold: 1.66 }
      }
    };

    var fourWordBiasProfiles = {
      bannerDrift: {
        motionPreset: "four_word_banner_drift",
        typographyPreset: "quad_banner_tall",
        timing: { inDuration: 1.0, outDuration: 0.6, stagger: 0.052, hold: 1.64 },
        meta: {
          styleBias: "bannerDrift",
          layoutVariant: "quad-banner",
          partGroups: [[0, 1], [2], [3]],
          planeMode: "single",
          referencePack: "cinematic-research-v1",
          referenceId: "quad-banner-drift"
        }
      },
      splitStagger: {
        motionPreset: "four_word_split_stagger",
        typographyPreset: "quad_split_tall",
        timing: { inDuration: 0.98, outDuration: 0.58, stagger: 0.054, hold: 1.58 },
        meta: {
          styleBias: "splitStagger",
          layoutVariant: "quad-split",
          partGroups: [[0], [1, 2], [3]],
          planeMode: "single",
          referencePack: "cinematic-research-v1",
          referenceId: "quad-split-stagger"
        }
      },
      serifPivot: {
        motionPreset: "four_word_serif_pivot",
        typographyPreset: "quad_serif_contrast",
        timing: { inDuration: 1.02, outDuration: 0.62, stagger: 0.05, hold: 1.68 },
        meta: {
          styleBias: "serifPivot",
          layoutVariant: "quad-serif",
          partGroups: [[0, 1], [2], [3]],
          planeMode: "single",
          referencePack: "cinematic-research-v1",
          referenceId: "quad-serif-pivot"
        }
      },
      outlineWhip: {
        motionPreset: "four_word_outline_whip",
        typographyPreset: "quad_outline_compressed",
        timing: { inDuration: 0.94, outDuration: 0.56, stagger: 0.05, hold: 1.54 },
        meta: {
          styleBias: "outlineWhip",
          layoutVariant: "quad-outline",
          partGroups: [[0], [1], [2, 3]],
          planeMode: "single",
          referencePack: "cinematic-research-v1",
          referenceId: "quad-outline-whip"
        }
      }
    };

    var threeWordBiasKeys = Object.keys(threeWordBiasProfiles);
    var threeWordBiasWeights = normalizeWeightMap(threeWordSettings.styleWeights, threeWordBiasKeys);
    var fourWordBiasKeys = Object.keys(fourWordBiasProfiles);
    var fourWordBiasWeights = normalizeWeightMap(fourWordSettings.styleWeights, fourWordBiasKeys);
    var threeWordIntensityScale = {
      subtle: 0.9,
      medium: 1,
      aggressive: 1.12
    };
    var fourWordIntensityScale = {
      subtle: 0.92,
      medium: 1,
      aggressive: 1.1
    };
    var threeIntensityScale = threeWordIntensityScale[threeWordSettings.intensity] || threeWordIntensityScale.medium;
    var fourIntensityScale = fourWordIntensityScale[fourWordSettings.intensity] || fourWordIntensityScale.medium;

    var layers = [layerCurrentEl, layerNextEl];
    var backLayers = hasBackPlane ? [backLayerCurrentEl, backLayerNextEl] : [];
    var profileMap = new Map();
    var listeners = [];
    var activeLayerIndex = 0;
    var activeBackLayerIndex = 0;
    var activeRender = null;
    var activeBackRender = null;
    var activeWord = null;
    var activeTemplateInfo = null;
    var activeTimeline = null;
    var overlapSeconds = Math.max(0.08, toNumber(config.overlapSeconds, 0.16));
    var fitRule = Object.assign(
      {
        horizontalPaddingRatio: 0.04,
        verticalPaddingRatio: 0.08,
        minScale: 0.24,
        maxScale: 1.22
      },
      config.fitRule || {}
    );
    var wordBank = asArray(config.defaultWords)
      .map(function (item) {
        return splitter.normalizeInput(item);
      })
      .filter(Boolean);
    var wordCountFilter = "all";
    var visibleWordBank = [];

    if (wordBank.length === 0) {
      wordBank = ["Agentic", "Interesting", "Cinematic"];
    }

    function notify() {
      var snapshot = api.getState();
      listeners.forEach(function (listener) {
        listener(snapshot);
      });
    }

    function onChange(listener) {
      if (typeof listener !== "function") {
        return function noop() {};
      }
      listeners.push(listener);
      return function unsubscribe() {
        listeners = listeners.filter(function (item) {
          return item !== listener;
        });
      };
    }

    function getFilteredWords(filter) {
      var normalizedFilter = normalizeWordCountFilter(filter);
      return wordBank.filter(function (word) {
        return matchesWordCountFilter(splitter, word, normalizedFilter);
      });
    }

    function refreshVisibleWordBank() {
      visibleWordBank = getFilteredWords(wordCountFilter);
      return visibleWordBank;
    }

    function scaleTiming(timing, intensityScale) {
      var baseTiming = timing || {};
      var scale = toNumber(intensityScale, 1);
      return {
        inDuration: Number((toNumber(baseTiming.inDuration, 1) * scale).toFixed(3)),
        outDuration: Number((toNumber(baseTiming.outDuration, 0.62) * scale).toFixed(3)),
        stagger: Number((toNumber(baseTiming.stagger, 0.08) * scale).toFixed(3)),
        hold: Number((toNumber(baseTiming.hold, 1.6) * scale).toFixed(3))
      };
    }

    function applyFourPlusMetaDefaults(meta, tokenCount) {
      var count = Number(tokenCount) || 0;
      if (count < 4) {
        return Object.assign({}, meta || {});
      }

      var normalizedMeta = Object.assign({}, meta || {});
      normalizedMeta.layoutMode = "flow-grid-4plus";
      normalizedMeta.spacingPolicy = "hard-no-overlap";
      normalizedMeta.partGroups = buildFourPlusPartGroups(count);
      var requestedDescriptorMode = String(normalizedMeta.descriptorMode || "off").toLowerCase();
      if (requestedDescriptorMode !== "hide" && requestedDescriptorMode !== "italic-keep" && requestedDescriptorMode !== "off") {
        requestedDescriptorMode = "off";
      }
      normalizedMeta.descriptorMode = requestedDescriptorMode;
      normalizedMeta.descriptorWords = normalizeDescriptorList(normalizedMeta.descriptorWords);
      normalizedMeta.descriptorExcludeWords = normalizeDescriptorList(normalizedMeta.descriptorExcludeWords);
      normalizedMeta.descriptorHideOnFinalOverflow = normalizedMeta.descriptorHideOnFinalOverflow !== false;

      if (count === 6) {
        normalizedMeta.planeMode = "split-depth";
        normalizedMeta.depthMap = { back: [0], front: [1, 2] };
        normalizedMeta.layoutVariant = normalizedMeta.layoutVariant || "quad-duo-depth";
      } else {
        normalizedMeta.planeMode = "single";
        if (Object.prototype.hasOwnProperty.call(normalizedMeta, "depthMap")) {
          delete normalizedMeta.depthMap;
        }
        normalizedMeta.layoutVariant = normalizedMeta.layoutVariant || "fourplus-grid";
      }

      return normalizedMeta;
    }

    function buildThreeWordProfile(word) {
      var styleBias = pickWeightedKey(threeWordBiasWeights, "tallCondensed");
      var stylePreset = threeWordBiasProfiles[styleBias] || threeWordBiasProfiles.tallCondensed;
      return {
        word: word,
        motionPreset: stylePreset.motionPreset,
        typographyPreset: "cinematic_uniform_caps",
        timing: scaleTiming(stylePreset.timing, threeIntensityScale),
        meta: {
          styleBias: styleBias,
          punchPosition: threeWordSettings.punchPosition || "middle",
          intensity: threeWordSettings.intensity || "medium",
          layoutVariant: "inline",
          partGroups: [[0], [1], [2]]
        }
      };
    }

    function buildFourWordProfile(word, tokenCount) {
      var normalized = keyForWord(word);
      var styleBias = pickDeterministicWeightedKey(fourWordBiasWeights, normalized, "bannerDrift");
      var stylePreset = fourWordBiasProfiles[styleBias] || fourWordBiasProfiles.bannerDrift;
      var count = Number(tokenCount) || 4;
      var meta = Object.assign({}, stylePreset.meta || {});
      if (count !== 4) {
        meta.referenceId = (meta.referenceId || "fourplus-generated") + "-w" + count;
      }

      return {
        word: word,
        motionPreset: stylePreset.motionPreset,
        typographyPreset: "cinematic_uniform_caps",
        timing: scaleTiming(stylePreset.timing, fourIntensityScale),
        meta: applyFourPlusMetaDefaults(meta, count)
      };
    }

    function buildSixWordProfile(word) {
      return {
        word: word,
        motionPreset: "six_word_quad_duo_depth",
        typographyPreset: "cinematic_uniform_caps",
        timing: { inDuration: 1.04, outDuration: 0.62, stagger: 0.056, hold: 1.74 },
        meta: applyFourPlusMetaDefaults({
          styleBias: "quadDuoDepth",
          layoutVariant: "quad-duo-depth",
          referencePack: "cinematic-research-v1",
          referenceId: "six-word-quad-duo-generated"
        }, 6)
      };
    }

    function buildFourPlusProfile(word, tokenCount) {
      var count = Number(tokenCount) || 4;
      if (count === 6) {
        return buildSixWordProfile(word);
      }

      var profile = buildFourWordProfile(word, count);
      if (count >= 8) {
        profile.meta.layoutVariant = "fourplus-grid";
        profile.meta.referenceId = "fourplus-composed-" + count;
      }
      return profile;
    }

    function getProfile(word) {
      var normalizedWord = splitter.normalizeInput(word);
      var key = keyForWord(normalizedWord);
      if (profileMap.has(key)) {
        return cloneProfile(profileMap.get(key));
      }

      var tokenCount = splitter.tokenizeWords(normalizedWord).length;
      var base = defaultProfileLookup.get(keyForWord(normalizedWord));
      if (!base && tokenCount === 2) {
        base = {
          word: normalizedWord,
          motionPreset: "two_word_cinematic_pair",
          typographyPreset: "cinematic_uniform_caps",
          timing: { inDuration: 1.0, outDuration: 0.64, stagger: 0.088, hold: 1.62 }
        };
      }
      if (!base && tokenCount === 3) {
        base = buildThreeWordProfile(normalizedWord);
      }
      if (!base && tokenCount >= 4) {
        base = buildFourPlusProfile(normalizedWord, tokenCount);
      }
      if (!base) {
        base = {
          word: normalizedWord,
          motionPreset: "generic_single_word",
          typographyPreset: "tall_generic_default",
          timing: { inDuration: 0.88, outDuration: 0.56, stagger: 0, hold: 1.4 }
        };
      }

      if (tokenCount >= 4) {
        base.meta = applyFourPlusMetaDefaults(base.meta, tokenCount);
      }

      profileMap.set(key, cloneProfile(base));
      return cloneProfile(base);
    }

    function upsertProfile(word, nextProfile) {
      var normalizedWord = splitter.normalizeInput(word);
      var key = keyForWord(normalizedWord);
      var existing = getProfile(normalizedWord);
      var tokenCount = splitter.tokenizeWords(normalizedWord).length;
      var merged = Object.assign({}, existing, nextProfile || {});
      merged.word = normalizedWord;
      merged.timing = Object.assign({}, existing.timing, (nextProfile && nextProfile.timing) || {});
      merged.meta = Object.assign({}, existing.meta || {}, (nextProfile && nextProfile.meta) || {});
      if (tokenCount >= 4) {
        merged.meta = applyFourPlusMetaDefaults(merged.meta, tokenCount);
      }
      profileMap.set(key, merged);
      return cloneProfile(merged);
    }

    function ensureWordInBank(word) {
      var normalizedWord = splitter.normalizeInput(word);
      if (!normalizedWord) {
        return;
      }
      var exists = wordBank.some(function (item) {
        return item.toLowerCase() === normalizedWord.toLowerCase();
      });
      if (!exists) {
        wordBank.push(normalizedWord);
        refreshVisibleWordBank();
      }
    }

    function getMotionPreset(name) {
      return textTemplateEngine.getTextMotionPreset(name) || textTemplateEngine.getTextMotionPreset("generic_single_word");
    }

    function getTypographyPreset(name) {
      return textTemplateEngine.getTypographyPreset(name) || textTemplateEngine.getTypographyPreset("tall_generic_default");
    }

    function parseEm(value, fallback) {
      var match = /^(-?\d+(?:\.\d+)?)em$/i.exec(String(value || ""));
      if (!match) {
        return fallback;
      }
      return Number(match[1]);
    }

    function sanitizeLayoutVariant(value, fallback) {
      var candidate = String(value || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      return candidate || fallback;
    }

    function toPartIndexArray(indices) {
      var source = Array.isArray(indices) ? indices : [];
      var seen = {};
      var result = [];
      source.forEach(function (value) {
        var index = Number(value);
        if (!Number.isInteger(index) || index < 0 || seen[index]) {
          return;
        }
        seen[index] = true;
        result.push(index);
      });
      return result;
    }

    function normalizeDepthMap(meta) {
      var source = meta && meta.depthMap ? meta.depthMap : null;
      if (!source || typeof source !== "object") {
        return null;
      }

      var back = toPartIndexArray(source.back);
      var front = toPartIndexArray(source.front);
      if (back.length === 0 || front.length === 0) {
        return null;
      }

      return {
        back: back,
        front: front
      };
    }

    function createIndexRange(start, endExclusive) {
      var indices = [];
      var cursor;
      for (cursor = start; cursor < endExclusive; cursor += 1) {
        indices.push(cursor);
      }
      return indices;
    }

    function buildIndexGroupsFromSizes(wordCount, sizePattern) {
      var groups = [];
      var sizes = Array.isArray(sizePattern) ? sizePattern : [];
      var cursor = 0;

      sizes.forEach(function (size) {
        if (cursor >= wordCount) {
          return;
        }
        var safeSize = Math.max(1, Math.min(Number(size) || 1, wordCount - cursor));
        groups.push(createIndexRange(cursor, cursor + safeSize));
        cursor += safeSize;
      });

      if (cursor < wordCount) {
        groups.push(createIndexRange(cursor, wordCount));
      }

      return groups;
    }

    function buildFourPlusGroupSizes(wordCount) {
      var count = Number(wordCount) || 0;
      if (count === 4) {
        return [2, 2];
      }
      if (count === 5) {
        return [3, 2];
      }
      if (count === 6) {
        return [4, 1, 1];
      }
      if (count === 7) {
        return [4, 3];
      }

      var sizes = [];
      var remaining = count;
      while (remaining > 0) {
        if (remaining <= 4) {
          sizes.push(remaining);
          break;
        }
        var take = 4;
        if (remaining - take === 1) {
          take = 3;
        }
        sizes.push(take);
        remaining -= take;
      }
      return sizes;
    }

    function buildFourPlusPartGroups(wordCount) {
      var count = Number(wordCount) || 0;
      if (count <= 0) {
        return [];
      }
      return buildIndexGroupsFromSizes(count, buildFourPlusGroupSizes(count));
    }

    function buildPartEntriesFromGroups(words, groups, descriptorPolicy) {
      var sourceWords = Array.isArray(words) ? words : [];
      var sourceGroups = Array.isArray(groups) ? groups : [];
      var entries = [];

      sourceGroups.forEach(function (group, slotIndex) {
        var slot =
          group && Number.isInteger(group.slot)
            ? group.slot
            : slotIndex;
        var indices =
          group && Array.isArray(group.indices)
            ? group.indices
            : Array.isArray(group)
              ? group
              : [];
        var tokens = [];
        indices.forEach(function (index) {
          var idx = Number(index);
          if (!Number.isInteger(idx) || idx < 0 || idx >= sourceWords.length) {
            return;
          }
          var tokenText = String(sourceWords[idx] || "").trim();
          if (!tokenText) {
            return;
          }
          tokens.push({
            text: tokenText,
            sourceIndex: idx,
            normalized: normalizeDescriptorToken(tokenText),
            isDescriptor: isDescriptorWord(tokenText, descriptorPolicy)
          });
        });

        if (tokens.length > 0) {
          var text = tokens
            .map(function (token) {
              return token.text;
            })
            .join(" ")
            .trim();
          var descriptorWords = tokens
            .filter(function (token) {
              return token.isDescriptor;
            })
            .map(function (token) {
              return token.text;
            });

          entries.push({
            slot: slot,
            text: text,
            wordIndices: tokens.map(function (token) {
              return token.sourceIndex;
            }),
            tokens: tokens,
            descriptorWords: descriptorWords,
            isDescriptor: descriptorWords.length > 0 && descriptorWords.length === tokens.length
          });
        }
      });

      return entries;
    }

    function buildFourPlusRows(entries, wordCount, profileMeta) {
      var source = Array.isArray(entries) ? entries.slice(0) : [];
      if (source.length === 0) {
        return [];
      }

      var count = Number(wordCount) || 0;
      var isSplitDepth = Boolean(profileMeta && profileMeta.planeMode === "split-depth");
      if (count === 6 && isSplitDepth) {
        if (source.length === 1) {
          return [source.slice(0, 1)];
        }
        if (source.length === 2) {
          return [source.slice(0)];
        }
        return [source.slice(0, 1), source.slice(1)];
      }

      if (source.length <= 2) {
        return source.map(function (entry) {
          return [entry];
        });
      }

      return source.map(function (entry) {
        return [entry];
      });
    }

    function resolveFourPlusPartEntries(templateWords, profileMeta, partIndices, descriptorPolicy) {
      var words = Array.isArray(templateWords) ? templateWords.slice(0) : [];
      var baseGroups = buildFourPlusPartGroups(words.length);
      var sourceGroups = baseGroups.map(function (group, slot) {
        return {
          slot: slot,
          indices: group.slice(0)
        };
      });
      var allowed = toPartIndexArray(partIndices);
      var resolvedGroups = sourceGroups;

      if (allowed.length > 0) {
        var allowMap = {};
        allowed.forEach(function (index) {
          allowMap[index] = true;
        });
        resolvedGroups = sourceGroups.filter(function (group) {
          return Boolean(allowMap[group.slot]);
        });
        if (resolvedGroups.length === 0) {
          resolvedGroups = sourceGroups;
        }
      }

      var partEntries = buildPartEntriesFromGroups(words, resolvedGroups, descriptorPolicy);
      var rows = buildFourPlusRows(partEntries, words.length, profileMeta || {});
      var descriptorTokenCount = 0;
      var descriptorPartCount = 0;

      partEntries.forEach(function (entry) {
        var entryTokens = Array.isArray(entry.tokens) ? entry.tokens : [];
        var tokenDescriptorCount = entryTokens.filter(function (token) {
          return token.isDescriptor;
        }).length;
        descriptorTokenCount += tokenDescriptorCount;
        if (tokenDescriptorCount > 0 && tokenDescriptorCount === entryTokens.length) {
          descriptorPartCount += 1;
        }
      });

      return {
        entries: partEntries,
        rows: rows,
        groups: resolvedGroups.map(function (group) {
          return group.indices.slice(0);
        }),
        descriptorTokenCount: descriptorTokenCount,
        descriptorPartCount: descriptorPartCount
      };
    }

    function rectanglesOverlap(rectA, rectB, padding) {
      var pad = Number(padding) || 0;
      return !(
        rectA.right - pad <= rectB.left + pad ||
        rectA.left + pad >= rectB.right - pad ||
        rectA.bottom - pad <= rectB.top + pad ||
        rectA.top + pad >= rectB.bottom - pad
      );
    }

    function countPartOverlaps(partElements) {
      var elements = Array.isArray(partElements)
        ? partElements.filter(function (element) {
          return element && element.getClientRects().length > 0;
        })
        : [];
      var overlaps = 0;
      var i;
      var j;

      for (i = 0; i < elements.length; i += 1) {
        var rectA = elements[i].getBoundingClientRect();
        for (j = i + 1; j < elements.length; j += 1) {
          var rectB = elements[j].getBoundingClientRect();
          if (rectanglesOverlap(rectA, rectB, 1.2)) {
            overlaps += 1;
          }
        }
      }
      return overlaps;
    }

    function enforceNoOverlap(layerEl, typographyPreset, partElements, previousState) {
      var elements = Array.isArray(partElements) ? partElements.filter(Boolean) : [];
      if (elements.length < 2) {
        layerEl.dataset.overlapCount = "0";
        return {
          overlapCount: 0,
          rowGap: toNumber(layerEl.style.getPropertyValue("--fourplus-row-gap"), 0.16),
          colGap: toNumber(layerEl.style.getPropertyValue("--fourplus-col-gap"), 0.1),
          partScale: toNumber(layerEl.style.getPropertyValue("--fourplus-part-scale"), 1)
        };
      }

      var minRowGap = Math.max(0.02, toNumber(typographyPreset.fourPlusMinRowGapEm, 0.12));
      var maxRowGap = Math.max(minRowGap, toNumber(typographyPreset.fourPlusMaxRowGapEm, minRowGap + 0.2));
      var minColGap = Math.max(0.01, toNumber(typographyPreset.fourPlusMinColGapEm, 0.06));
      var maxColGap = Math.max(minColGap, minColGap + 0.18);
      var partScaleFloor = Math.max(0.56, Math.min(1, toNumber(typographyPreset.fourPlusPartScaleFloor, 0.78)));
      var rowGap = previousState && Number.isFinite(previousState.rowGap) ? previousState.rowGap : minRowGap;
      var colGap = previousState && Number.isFinite(previousState.colGap) ? previousState.colGap : minColGap;
      var partScale = previousState && Number.isFinite(previousState.partScale) ? previousState.partScale : 1;
      var overlapCount = 0;
      var pass;

      layerEl.style.setProperty("--fourplus-row-gap", rowGap.toFixed(3) + "em");
      layerEl.style.setProperty("--fourplus-col-gap", colGap.toFixed(3) + "em");
      layerEl.style.setProperty("--fourplus-part-scale", partScale.toFixed(3));

      for (pass = 0; pass < 14; pass += 1) {
        overlapCount = countPartOverlaps(elements);
        if (overlapCount <= 0) {
          break;
        }

        var nextRowGap = Math.min(maxRowGap, rowGap + 0.02);
        var nextColGap = Math.min(maxColGap, colGap + 0.014);
        var nextPartScale = Math.max(partScaleFloor, partScale - 0.03);
        if (nextRowGap === rowGap && nextColGap === colGap && nextPartScale === partScale) {
          break;
        }

        rowGap = nextRowGap;
        colGap = nextColGap;
        partScale = nextPartScale;
        layerEl.style.setProperty("--fourplus-row-gap", rowGap.toFixed(3) + "em");
        layerEl.style.setProperty("--fourplus-col-gap", colGap.toFixed(3) + "em");
        layerEl.style.setProperty("--fourplus-part-scale", partScale.toFixed(3));
      }

      overlapCount = countPartOverlaps(elements);
      for (pass = 0; pass < 10 && overlapCount > 0; pass += 1) {
        var clampedScale = Math.max(partScaleFloor, partScale * 0.965);
        if (clampedScale === partScale) {
          break;
        }
        partScale = clampedScale;
        layerEl.style.setProperty("--fourplus-part-scale", partScale.toFixed(3));
        overlapCount = countPartOverlaps(elements);
      }

      layerEl.dataset.overlapCount = String(overlapCount);
      layerEl.dataset.fourPlusRowGap = rowGap.toFixed(3);
      layerEl.dataset.fourPlusColGap = colGap.toFixed(3);
      layerEl.dataset.fourPlusPartScale = partScale.toFixed(3);

      return {
        overlapCount: overlapCount,
        rowGap: rowGap,
        colGap: colGap,
        partScale: partScale
      };
    }

    function resolvePartTexts(templateWords, profile) {
      var words = Array.isArray(templateWords) ? templateWords.slice(0) : [];
      var meta = profile && profile.meta ? profile.meta : {};
      var groups = Array.isArray(meta.partGroups) ? meta.partGroups : null;
      var result = [];

      if (!groups || groups.length === 0) {
        return words
          .map(function (text, slotIndex) {
            return {
              text: String(text || ""),
              slot: slotIndex
            };
          })
          .filter(function (item) {
            return item.text;
          });
      }

      groups.forEach(function (group, slotIndex) {
        var indices = Array.isArray(group) ? group : [group];
        var text = indices
          .map(function (index) {
            var idx = Number(index);
            return Number.isInteger(idx) && idx >= 0 && idx < words.length ? words[idx] : "";
          })
          .filter(Boolean)
          .join(" ")
          .trim();
        if (text) {
          result.push({
            text: text,
            slot: slotIndex
          });
        }
      });

      if (result.length > 0) {
        return result;
      }

      return words
        .map(function (text, slotIndex) {
          return {
            text: String(text || ""),
            slot: slotIndex
          };
        })
        .filter(function (item) {
          return item.text;
        });
    }

    function applyTypography(layerEl, typographyPreset, renderedText) {
      var graphemeCount = splitter.splitGraphemes(renderedText).length;
      var baseScale = toNumber(typographyPreset.scaleX, 0.77);
      var baseTracking = parseEm(typographyPreset.letterSpacing, 0.08);

      var adjustedScale = baseScale;
      var adjustedTracking = baseTracking;

      if (graphemeCount > 12) {
        var overflow = graphemeCount - 12;
        adjustedScale = Math.max(0.56, baseScale - overflow * 0.014);
        adjustedTracking = Math.max(0.02, baseTracking - overflow * 0.003);
      }

      layerEl.style.setProperty("--text-font-family", typographyPreset.fontFamily || "\"Bebas Neue\", sans-serif");
      layerEl.style.setProperty("--text-font-weight", typographyPreset.fontWeight || "700");
      layerEl.style.setProperty("--text-letter-spacing", adjustedTracking.toFixed(3) + "em");
      layerEl.style.setProperty("--text-transform", typographyPreset.textTransform || "uppercase");
      layerEl.style.setProperty("--text-stroke", typographyPreset.stroke || "0px transparent");
      layerEl.style.setProperty("--text-glow", typographyPreset.glow || "none");
      layerEl.style.setProperty("--text-blur-base", typographyPreset.blurBase || "0px");
      layerEl.style.setProperty("--text-scale-x", adjustedScale.toFixed(3));
      layerEl.style.setProperty("--text-line-height", typographyPreset.lineHeight || "0.84");
      layerEl.style.setProperty("--text-color", typographyPreset.color || "#f3f6ff");
      layerEl.style.setProperty("--text-fit-scale", "1");
      layerEl.style.setProperty("--text-fit-shift-x", "0px");
      layerEl.style.setProperty("--text-fit-shift-y", "0px");
      layerEl.dataset.baseLetterSpacing = adjustedTracking.toFixed(3);
      layerEl.classList.toggle("two-word-typography", typographyPreset.mode === "two-word-contrast");
      layerEl.classList.toggle("three-word-typography", typographyPreset.mode === "three-word-contrast");

      layerEl.style.setProperty("--two-layout-gap", (typographyPreset.twoLayoutGap || "0.16em"));
      layerEl.style.setProperty("--two-a-font-family", typographyPreset.fontFamily || "\"Bebas Neue\", sans-serif");
      layerEl.style.setProperty("--two-a-font-weight", typographyPreset.fontWeight || "700");
      layerEl.style.setProperty("--two-a-size-mult", "1");
      layerEl.style.setProperty("--two-a-letter-spacing", layerEl.style.getPropertyValue("--text-letter-spacing"));
      layerEl.style.setProperty("--two-a-transform", typographyPreset.textTransform || "uppercase");
      layerEl.style.setProperty("--two-a-stroke", typographyPreset.stroke || "0px transparent");
      layerEl.style.setProperty("--two-a-glow", typographyPreset.glow || "none");
      layerEl.style.setProperty("--two-a-color", typographyPreset.color || "#f3f6ff");

      layerEl.style.setProperty("--two-b-font-family", typographyPreset.fontFamily || "\"Bebas Neue\", sans-serif");
      layerEl.style.setProperty("--two-b-font-weight", typographyPreset.fontWeight || "700");
      layerEl.style.setProperty("--two-b-size-mult", "1");
      layerEl.style.setProperty("--two-b-letter-spacing", layerEl.style.getPropertyValue("--text-letter-spacing"));
      layerEl.style.setProperty("--two-b-transform", typographyPreset.textTransform || "uppercase");
      layerEl.style.setProperty("--two-b-stroke", typographyPreset.stroke || "0px transparent");
      layerEl.style.setProperty("--two-b-glow", typographyPreset.glow || "none");
      layerEl.style.setProperty("--two-b-color", typographyPreset.color || "#f3f6ff");

      layerEl.style.setProperty("--three-layout-gap", (typographyPreset.threeLayoutGap || "0.12em"));
      layerEl.style.setProperty(
        "--fourplus-row-gap",
        toNumber(typographyPreset.fourPlusMinRowGapEm, 0.12).toFixed(3) + "em"
      );
      layerEl.style.setProperty(
        "--fourplus-col-gap",
        toNumber(typographyPreset.fourPlusMinColGapEm, 0.06).toFixed(3) + "em"
      );
      layerEl.style.setProperty("--fourplus-part-scale", "1");
      layerEl.style.setProperty("--three-a-font-family", typographyPreset.fontFamily || "\"Bebas Neue\", sans-serif");
      layerEl.style.setProperty("--three-a-font-weight", typographyPreset.fontWeight || "700");
      layerEl.style.setProperty("--three-a-size-mult", "1");
      layerEl.style.setProperty("--three-a-letter-spacing", layerEl.style.getPropertyValue("--text-letter-spacing"));
      layerEl.style.setProperty("--three-a-transform", typographyPreset.textTransform || "uppercase");
      layerEl.style.setProperty("--three-a-stroke", typographyPreset.stroke || "0px transparent");
      layerEl.style.setProperty("--three-a-glow", typographyPreset.glow || "none");
      layerEl.style.setProperty("--three-a-color", typographyPreset.color || "#f3f6ff");

      layerEl.style.setProperty("--three-b-font-family", typographyPreset.fontFamily || "\"Bebas Neue\", sans-serif");
      layerEl.style.setProperty("--three-b-font-weight", typographyPreset.fontWeight || "700");
      layerEl.style.setProperty("--three-b-size-mult", "1");
      layerEl.style.setProperty("--three-b-letter-spacing", layerEl.style.getPropertyValue("--text-letter-spacing"));
      layerEl.style.setProperty("--three-b-transform", typographyPreset.textTransform || "uppercase");
      layerEl.style.setProperty("--three-b-stroke", typographyPreset.stroke || "0px transparent");
      layerEl.style.setProperty("--three-b-glow", typographyPreset.glow || "none");
      layerEl.style.setProperty("--three-b-color", typographyPreset.color || "#f3f6ff");

      layerEl.style.setProperty("--three-c-font-family", typographyPreset.fontFamily || "\"Bebas Neue\", sans-serif");
      layerEl.style.setProperty("--three-c-font-weight", typographyPreset.fontWeight || "700");
      layerEl.style.setProperty("--three-c-size-mult", "1");
      layerEl.style.setProperty("--three-c-letter-spacing", layerEl.style.getPropertyValue("--text-letter-spacing"));
      layerEl.style.setProperty("--three-c-transform", typographyPreset.textTransform || "uppercase");
      layerEl.style.setProperty("--three-c-stroke", typographyPreset.stroke || "0px transparent");
      layerEl.style.setProperty("--three-c-glow", typographyPreset.glow || "none");
      layerEl.style.setProperty("--three-c-color", typographyPreset.color || "#f3f6ff");
      layerEl.style.setProperty(
        "--descriptor-font-family",
        typographyPreset.descriptorFontFamily || "\"Cormorant Garamond\", \"Times New Roman\", serif"
      );
      layerEl.style.setProperty("--descriptor-font-style", typographyPreset.descriptorFontStyle || "italic");
      layerEl.style.setProperty("--descriptor-size-mult", String(toNumber(typographyPreset.descriptorSizeMult, 0.72)));
      layerEl.style.setProperty("--descriptor-letter-spacing", typographyPreset.descriptorLetterSpacing || "0.01em");
      layerEl.style.setProperty("--descriptor-color", typographyPreset.descriptorColor || "rgba(236, 244, 255, 0.94)");
      layerEl.style.setProperty(
        "--descriptor-glow",
        typographyPreset.descriptorGlow || "0 0 10px rgba(197, 216, 255, 0.32)"
      );

      if (typographyPreset.mode === "two-word-contrast") {
        var twoA = typographyPreset.twoA || {};
        var twoB = typographyPreset.twoB || {};

        layerEl.style.setProperty("--two-layout-gap", typographyPreset.twoLayoutGap || "0.12em");

        layerEl.style.setProperty("--two-a-font-family", twoA.fontFamily || layerEl.style.getPropertyValue("--text-font-family"));
        layerEl.style.setProperty("--two-a-font-weight", twoA.fontWeight || layerEl.style.getPropertyValue("--text-font-weight"));
        layerEl.style.setProperty("--two-a-size-mult", String(toNumber(twoA.sizeMult, 1)));
        layerEl.style.setProperty("--two-a-letter-spacing", twoA.letterSpacing || layerEl.style.getPropertyValue("--text-letter-spacing"));
        layerEl.style.setProperty("--two-a-transform", twoA.textTransform || layerEl.style.getPropertyValue("--text-transform"));
        layerEl.style.setProperty("--two-a-stroke", twoA.stroke || layerEl.style.getPropertyValue("--text-stroke"));
        layerEl.style.setProperty("--two-a-glow", twoA.glow || layerEl.style.getPropertyValue("--text-glow"));
        layerEl.style.setProperty("--two-a-color", twoA.color || layerEl.style.getPropertyValue("--text-color"));

        layerEl.style.setProperty("--two-b-font-family", twoB.fontFamily || layerEl.style.getPropertyValue("--text-font-family"));
        layerEl.style.setProperty("--two-b-font-weight", twoB.fontWeight || layerEl.style.getPropertyValue("--text-font-weight"));
        layerEl.style.setProperty("--two-b-size-mult", String(toNumber(twoB.sizeMult, 1)));
        layerEl.style.setProperty("--two-b-letter-spacing", twoB.letterSpacing || layerEl.style.getPropertyValue("--text-letter-spacing"));
        layerEl.style.setProperty("--two-b-transform", twoB.textTransform || layerEl.style.getPropertyValue("--text-transform"));
        layerEl.style.setProperty("--two-b-stroke", twoB.stroke || layerEl.style.getPropertyValue("--text-stroke"));
        layerEl.style.setProperty("--two-b-glow", twoB.glow || layerEl.style.getPropertyValue("--text-glow"));
        layerEl.style.setProperty("--two-b-color", twoB.color || layerEl.style.getPropertyValue("--text-color"));
      }

      if (typographyPreset.mode === "three-word-contrast") {
        var threeA = typographyPreset.threeA || {};
        var threeB = typographyPreset.threeB || {};
        var threeC = typographyPreset.threeC || {};

        layerEl.style.setProperty("--three-layout-gap", typographyPreset.threeLayoutGap || "0.1em");

        layerEl.style.setProperty("--three-a-font-family", threeA.fontFamily || layerEl.style.getPropertyValue("--text-font-family"));
        layerEl.style.setProperty("--three-a-font-weight", threeA.fontWeight || layerEl.style.getPropertyValue("--text-font-weight"));
        layerEl.style.setProperty("--three-a-size-mult", String(toNumber(threeA.sizeMult, 1)));
        layerEl.style.setProperty("--three-a-letter-spacing", threeA.letterSpacing || layerEl.style.getPropertyValue("--text-letter-spacing"));
        layerEl.style.setProperty("--three-a-transform", threeA.textTransform || layerEl.style.getPropertyValue("--text-transform"));
        layerEl.style.setProperty("--three-a-stroke", threeA.stroke || layerEl.style.getPropertyValue("--text-stroke"));
        layerEl.style.setProperty("--three-a-glow", threeA.glow || layerEl.style.getPropertyValue("--text-glow"));
        layerEl.style.setProperty("--three-a-color", threeA.color || layerEl.style.getPropertyValue("--text-color"));

        layerEl.style.setProperty("--three-b-font-family", threeB.fontFamily || layerEl.style.getPropertyValue("--text-font-family"));
        layerEl.style.setProperty("--three-b-font-weight", threeB.fontWeight || layerEl.style.getPropertyValue("--text-font-weight"));
        layerEl.style.setProperty("--three-b-size-mult", String(toNumber(threeB.sizeMult, 1)));
        layerEl.style.setProperty("--three-b-letter-spacing", threeB.letterSpacing || layerEl.style.getPropertyValue("--text-letter-spacing"));
        layerEl.style.setProperty("--three-b-transform", threeB.textTransform || layerEl.style.getPropertyValue("--text-transform"));
        layerEl.style.setProperty("--three-b-stroke", threeB.stroke || layerEl.style.getPropertyValue("--text-stroke"));
        layerEl.style.setProperty("--three-b-glow", threeB.glow || layerEl.style.getPropertyValue("--text-glow"));
        layerEl.style.setProperty("--three-b-color", threeB.color || layerEl.style.getPropertyValue("--text-color"));

        layerEl.style.setProperty("--three-c-font-family", threeC.fontFamily || layerEl.style.getPropertyValue("--text-font-family"));
        layerEl.style.setProperty("--three-c-font-weight", threeC.fontWeight || layerEl.style.getPropertyValue("--text-font-weight"));
        layerEl.style.setProperty("--three-c-size-mult", String(toNumber(threeC.sizeMult, 1)));
        layerEl.style.setProperty("--three-c-letter-spacing", threeC.letterSpacing || layerEl.style.getPropertyValue("--text-letter-spacing"));
        layerEl.style.setProperty("--three-c-transform", threeC.textTransform || layerEl.style.getPropertyValue("--text-transform"));
        layerEl.style.setProperty("--three-c-stroke", threeC.stroke || layerEl.style.getPropertyValue("--text-stroke"));
        layerEl.style.setProperty("--three-c-glow", threeC.glow || layerEl.style.getPropertyValue("--text-glow"));
        layerEl.style.setProperty("--three-c-color", threeC.color || layerEl.style.getPropertyValue("--text-color"));
      }
    }

    function getLayerContentRect(layerEl) {
      var descendants = Array.prototype.filter.call(layerEl.querySelectorAll("*"), function (node) {
        return node && node.nodeType === 1 && node.getClientRects().length > 0;
      });
      var children = descendants.length > 0 ? descendants : Array.prototype.filter.call(layerEl.children, function (node) {
        return node && node.nodeType === 1 && node.getClientRects().length > 0;
      });

      if (children.length === 0) {
        var fallbackRect = layerEl.getBoundingClientRect();
        var centerX = (fallbackRect.left + fallbackRect.right) / 2;
        var centerY = (fallbackRect.top + fallbackRect.bottom) / 2;
        return {
          left: centerX,
          top: centerY,
          right: centerX,
          bottom: centerY,
          width: 0,
          height: 0
        };
      }

      var firstRect = children[0].getBoundingClientRect();
      var bounds = {
        left: firstRect.left,
        top: firstRect.top,
        right: firstRect.right,
        bottom: firstRect.bottom
      };

      children.forEach(function (child, index) {
        if (index === 0) {
          return;
        }
        var rect = child.getBoundingClientRect();
        bounds.left = Math.min(bounds.left, rect.left);
        bounds.top = Math.min(bounds.top, rect.top);
        bounds.right = Math.max(bounds.right, rect.right);
        bounds.bottom = Math.max(bounds.bottom, rect.bottom);
      });

      bounds.width = Math.max(0, bounds.right - bounds.left);
      bounds.height = Math.max(0, bounds.bottom - bounds.top);
      return bounds;
    }

    function getSafeBoundsRect(fitContainerEl) {
      var fitContainer = fitContainerEl || containerEl;
      var containerRect = fitContainer.getBoundingClientRect();
      var padX = containerRect.width * fitRule.horizontalPaddingRatio;
      var padY = containerRect.height * fitRule.verticalPaddingRatio;

      return {
        left: containerRect.left + padX,
        right: containerRect.right - padX,
        top: containerRect.top + padY,
        bottom: containerRect.bottom - padY
      };
    }

    function measureSafeZoneOverflow(layerEl, fitContainerEl) {
      var safeBounds = getSafeBoundsRect(fitContainerEl);
      var contentRect = getLayerContentRect(layerEl);
      var overflowLeft = Math.max(0, safeBounds.left - contentRect.left);
      var overflowRight = Math.max(0, contentRect.right - safeBounds.right);
      var overflowTop = Math.max(0, safeBounds.top - contentRect.top);
      var overflowBottom = Math.max(0, contentRect.bottom - safeBounds.bottom);
      var maxOverflow = Math.max(overflowLeft, overflowRight, overflowTop, overflowBottom);

      return {
        left: overflowLeft,
        right: overflowRight,
        top: overflowTop,
        bottom: overflowBottom,
        max: maxOverflow,
        hasOverflow: maxOverflow > 0.5
      };
    }

    function updateDescriptorPartVisibility(partEl) {
      if (!partEl) {
        return;
      }
      var allDescriptorTokens = partEl.querySelectorAll(".text-fourplus-token.is-descriptor-token");
      var visibleDescriptorTokens = partEl.querySelectorAll(
        ".text-fourplus-token.is-descriptor-token:not(.is-hidden-descriptor)"
      );

      if (allDescriptorTokens.length > 0 && visibleDescriptorTokens.length === 0) {
        partEl.classList.add("is-hidden-descriptor");
      } else {
        partEl.classList.remove("is-hidden-descriptor");
      }
    }

    function writeDescriptorDiagnostics(layerEl, descriptorDiagnostics) {
      var details = descriptorDiagnostics || {};
      layerEl.dataset.descriptorCount = String(Math.max(0, toNumber(details.count, 0)));
      layerEl.dataset.hiddenDescriptorCount = String(Math.max(0, toNumber(details.hiddenCount, 0)));
      layerEl.dataset.descriptorMode = String(details.mode || "-");
      layerEl.dataset.descriptorFallback = details.fallbackTriggered ? "yes" : "no";
    }

    function applyDescriptorOverflowFallback(
      layerEl,
      renderedText,
      profileMeta,
      typographyPreset,
      partElements,
      fitContainerEl,
      descriptorPolicy,
      descriptorTokenRefs,
      previousLayoutState
    ) {
      var refs = Array.isArray(descriptorTokenRefs) ? descriptorTokenRefs.filter(function (item) {
        return item && item.el && item.partEl;
      }) : [];
      var mode = descriptorPolicy && descriptorPolicy.enabled ? descriptorPolicy.mode : "-";
      var diagnostics = {
        mode: mode,
        count: refs.length,
        hiddenCount: 0,
        fallbackTriggered: false
      };
      var layoutState = previousLayoutState || null;

      refs.forEach(function (ref) {
        ref.el.classList.remove("is-hidden-descriptor");
        updateDescriptorPartVisibility(ref.partEl);
      });

      if (!descriptorPolicy || !descriptorPolicy.enabled || refs.length === 0) {
        return {
          layoutDiagnostics: layoutState,
          descriptorDiagnostics: diagnostics
        };
      }

      var sortedRefs = refs.slice(0).sort(function (a, b) {
        if (b.sourceIndex !== a.sourceIndex) {
          return b.sourceIndex - a.sourceIndex;
        }
        return b.tokenOrder - a.tokenOrder;
      });

      if (mode === "hide") {
        sortedRefs.forEach(function (ref) {
          if (ref.el.classList.contains("is-hidden-descriptor")) {
            return;
          }
          ref.el.classList.add("is-hidden-descriptor");
          updateDescriptorPartVisibility(ref.partEl);
          diagnostics.hiddenCount += 1;
        });
        diagnostics.fallbackTriggered = diagnostics.hiddenCount > 0;
        if (diagnostics.hiddenCount > 0) {
          layoutState = enforceNoOverlap(layerEl, typographyPreset, partElements, layoutState);
          enforceFrameFit(layerEl, renderedText, profileMeta, fitContainerEl);
          layoutState = enforceNoOverlap(layerEl, typographyPreset, partElements, layoutState);
        }
      } else {
        var overflowState = measureSafeZoneOverflow(layerEl, fitContainerEl);
        if (overflowState.hasOverflow && descriptorPolicy.hideOnFinalOverflow) {
          sortedRefs.some(function (ref) {
            if (ref.el.classList.contains("is-hidden-descriptor")) {
              return false;
            }
            ref.el.classList.add("is-hidden-descriptor");
            updateDescriptorPartVisibility(ref.partEl);
            diagnostics.hiddenCount += 1;
            diagnostics.fallbackTriggered = true;

            layoutState = enforceNoOverlap(layerEl, typographyPreset, partElements, layoutState);
            enforceFrameFit(layerEl, renderedText, profileMeta, fitContainerEl);
            layoutState = enforceNoOverlap(layerEl, typographyPreset, partElements, layoutState);
            overflowState = measureSafeZoneOverflow(layerEl, fitContainerEl);
            return !overflowState.hasOverflow;
          });
        }
      }

      return {
        layoutDiagnostics: layoutState,
        descriptorDiagnostics: diagnostics
      };
    }

    function enforceFrameFit(layerEl, renderedText, profileMeta, fitContainerEl) {
      var baseSpacingEm = toNumber(layerEl.dataset.baseLetterSpacing, 0.08);
      var contentRect;
      var containerRect;
      var fitContainer = fitContainerEl || containerEl;
      var availableWidth;
      var availableHeight;
      var fitScale;
      var maxFitScale;
      var spacingAdjust;
      var finalRect;
      var shiftX = 0;
      var shiftY = 0;
      var padX;
      var padY;
      var safeLeft;
      var safeTop;
      var safeRight;
      var safeBottom;
      var safeCenterX;
      var safeCenterY;
      var overflowX;
      var overflowY;
      var scalePass;
      var hardMinScale = 0.06;
      var shrinkRatio;
      var widthRatio;
      var heightRatio;
      var isReferenceLock = Boolean(profileMeta && profileMeta.referenceLock);
      var clampRatio;
      var finalScale;

      layerEl.style.setProperty("--text-fit-scale", "1");
      layerEl.style.setProperty("--text-fit-shift-x", "0px");
      layerEl.style.setProperty("--text-fit-shift-y", "0px");
      layerEl.style.setProperty("--text-letter-spacing", baseSpacingEm.toFixed(3) + "em");

      contentRect = getLayerContentRect(layerEl);
      containerRect = fitContainer.getBoundingClientRect();
      padX = containerRect.width * fitRule.horizontalPaddingRatio;
      padY = containerRect.height * fitRule.verticalPaddingRatio;
      safeLeft = containerRect.left + padX;
      safeRight = containerRect.right - padX;
      safeTop = containerRect.top + padY;
      safeBottom = containerRect.bottom - padY;

      availableWidth = Math.max(20, safeRight - safeLeft);
      availableHeight = Math.max(20, safeBottom - safeTop);
      maxFitScale = Math.min(
        availableWidth / Math.max(1, contentRect.width),
        availableHeight / Math.max(1, contentRect.height)
      );
      fitScale = Math.min(maxFitScale, toNumber(fitRule.maxScale, 1.22));
      fitScale = Math.max(toNumber(fitRule.minScale, 0.24), fitScale);

      spacingAdjust =
        fitScale < 1
          ? Math.max(0.66, fitScale + 0.14)
          : Math.min(1.14, 1 + (fitScale - 1) * 0.36);
      layerEl.style.setProperty("--text-letter-spacing", (baseSpacingEm * spacingAdjust).toFixed(3) + "em");
      layerEl.style.setProperty("--text-fit-scale", fitScale.toFixed(3));

      for (scalePass = 0; scalePass < 24; scalePass += 1) {
        finalRect = getLayerContentRect(layerEl);
        overflowX = Math.max(0, safeLeft - finalRect.left, finalRect.right - safeRight);
        overflowY = Math.max(0, safeTop - finalRect.top, finalRect.bottom - safeBottom);
        if (overflowX <= 0.5 && overflowY <= 0.5) {
          break;
        }

        widthRatio = availableWidth / Math.max(1, finalRect.width);
        heightRatio = availableHeight / Math.max(1, finalRect.height);
        shrinkRatio = Math.min(widthRatio, heightRatio);

        if (!Number.isFinite(shrinkRatio) || shrinkRatio >= 1) {
          shrinkRatio = 0.96;
        } else {
          shrinkRatio = Math.max(0.6, Math.min(0.98, shrinkRatio * 0.995));
        }

        fitScale = Math.max(hardMinScale, fitScale * shrinkRatio);
        spacingAdjust = fitScale < 1 ? Math.max(0.62, fitScale + 0.12) : 1;
        layerEl.style.setProperty("--text-letter-spacing", (baseSpacingEm * spacingAdjust).toFixed(3) + "em");
        layerEl.style.setProperty("--text-fit-scale", fitScale.toFixed(3));
      }

      finalRect = getLayerContentRect(layerEl);
      safeCenterX = (safeLeft + safeRight) / 2;
      safeCenterY = (safeTop + safeBottom) / 2;
      shiftX = safeCenterX - (finalRect.left + finalRect.right) / 2;
      shiftY = safeCenterY - (finalRect.top + finalRect.bottom) / 2;
      layerEl.style.setProperty("--text-fit-shift-x", shiftX.toFixed(2) + "px");
      layerEl.style.setProperty("--text-fit-shift-y", shiftY.toFixed(2) + "px");

      finalRect = getLayerContentRect(layerEl);
      if (finalRect.left < safeLeft) {
        shiftX += safeLeft - finalRect.left + 1;
      }
      if (finalRect.right > safeRight) {
        shiftX -= finalRect.right - safeRight + 1;
      }
      if (finalRect.top < safeTop) {
        shiftY += safeTop - finalRect.top + 1;
      }
      if (finalRect.bottom > safeBottom) {
        shiftY -= finalRect.bottom - safeBottom + 1;
      }

      layerEl.style.setProperty("--text-fit-shift-x", shiftX.toFixed(2) + "px");
      layerEl.style.setProperty("--text-fit-shift-y", shiftY.toFixed(2) + "px");

      finalRect = getLayerContentRect(layerEl);
      overflowX = Math.max(0, safeLeft - finalRect.left, finalRect.right - safeRight);
      overflowY = Math.max(0, safeTop - finalRect.top, finalRect.bottom - safeBottom);
      if (isReferenceLock && (overflowX > 0.5 || overflowY > 0.5)) {
        clampRatio = Math.min(
          availableWidth / Math.max(1, finalRect.width),
          availableHeight / Math.max(1, finalRect.height)
        );
        if (!Number.isFinite(clampRatio) || clampRatio >= 1) {
          clampRatio = 0.97;
        } else {
          clampRatio = Math.max(0.72, Math.min(0.985, clampRatio * 0.995));
        }

        finalScale = toNumber(layerEl.style.getPropertyValue("--text-fit-scale"), fitScale);
        finalScale = Math.max(hardMinScale, finalScale * clampRatio);
        spacingAdjust = finalScale < 1 ? Math.max(0.6, finalScale + 0.1) : 1;
        layerEl.style.setProperty("--text-letter-spacing", (baseSpacingEm * spacingAdjust).toFixed(3) + "em");
        layerEl.style.setProperty("--text-fit-scale", finalScale.toFixed(3));

        finalRect = getLayerContentRect(layerEl);
        shiftX = safeCenterX - (finalRect.left + finalRect.right) / 2;
        shiftY = safeCenterY - (finalRect.top + finalRect.bottom) / 2;

        if (finalRect.left + shiftX < safeLeft) {
          shiftX += safeLeft - (finalRect.left + shiftX) + 1;
        }
        if (finalRect.right + shiftX > safeRight) {
          shiftX -= (finalRect.right + shiftX) - safeRight + 1;
        }
        if (finalRect.top + shiftY < safeTop) {
          shiftY += safeTop - (finalRect.top + shiftY) + 1;
        }
        if (finalRect.bottom + shiftY > safeBottom) {
          shiftY -= (finalRect.bottom + shiftY) - safeBottom + 1;
        }

        layerEl.style.setProperty("--text-fit-shift-x", shiftX.toFixed(2) + "px");
        layerEl.style.setProperty("--text-fit-shift-y", shiftY.toFixed(2) + "px");
      }

      layerEl.dataset.fitScale = layerEl.style.getPropertyValue("--text-fit-scale").trim();
      layerEl.dataset.fitRule = "keep-inside-frame";
      layerEl.dataset.renderLength = String(splitter.splitGraphemes(renderedText).length);
    }

    function clearLayer(layerEl) {
      while (layerEl.firstChild) {
        layerEl.removeChild(layerEl.firstChild);
      }
    }

    function prepareLayer(layerEl, text, profile, resolvedTemplate, renderOptions) {
      var motionPreset = getMotionPreset(profile.motionPreset);
      var typographyPreset = getTypographyPreset(profile.typographyPreset);
      var templateWords = resolvedTemplate && Array.isArray(resolvedTemplate.words) ? resolvedTemplate.words : splitter.tokenizeWords(text);
      var options = renderOptions || {};
      var fitContainerTarget = options.fitContainerEl || containerEl;

      applyTypography(layerEl, typographyPreset, text);
      layerEl.dataset.word = text;
      layerEl.dataset.motionPreset = profile.motionPreset;
      layerEl.dataset.typographyPreset = profile.typographyPreset;
      layerEl.dataset.descriptorCount = "0";
      layerEl.dataset.hiddenDescriptorCount = "0";
      layerEl.dataset.descriptorMode = "-";
      layerEl.dataset.descriptorFallback = "no";

      var splitMode = motionPreset.split === "chars" ? "chars" : motionPreset.split === "parts" ? "parts" : "whole";
      var chars = [];
      var wholeEl = null;
      var parts = [];
      var resolvedPartGroups = [];
      var layoutDiagnostics = null;
      var layoutMode = "legacy-absolute";
      var profileMeta = profile && profile.meta ? profile.meta : {};
      var descriptorPolicy = resolveDescriptorPolicy(profileMeta, templateWords.length);
      var descriptorTokenRefs = [];
      var descriptorDiagnostics = {
        mode: descriptorPolicy.enabled ? descriptorPolicy.mode : "-",
        count: 0,
        hiddenCount: 0,
        fallbackTriggered: false
      };
      layerEl.dataset.layoutVariant = "";

      var forceTwoWord = templateWords.length === 2 && typographyPreset.mode === "two-word-contrast";
      var forceThreeWord = templateWords.length === 3 && typographyPreset.mode === "three-word-contrast";
      var forceFourPlus = templateWords.length >= 4;

      if (splitMode === "parts" || forceTwoWord || forceThreeWord || forceFourPlus) {
        var layout = document.createElement("span");
        clearLayer(layerEl);

        if (forceFourPlus) {
          var fourPlusResolved = resolveFourPlusPartEntries(
            templateWords,
            profileMeta,
            options.partIndices,
            descriptorPolicy
          );
          var fourPartLabels = ["a", "b", "c"];
          var fourLayoutVariant = sanitizeLayoutVariant(profileMeta.layoutVariant, "fourplus-grid");
          var rows = fourPlusResolved.rows;
          layout.className = "text-fourplus-layout";
          layout.classList.add("layout-" + fourLayoutVariant);
          layerEl.dataset.layoutVariant = fourLayoutVariant;
          layerEl.dataset.layoutMode = "flow-grid-4plus";
          layoutMode = "flow-grid-4plus";
          resolvedPartGroups = fourPlusResolved.groups;
          descriptorDiagnostics.count = toNumber(fourPlusResolved.descriptorTokenCount, 0);

          if (!Array.isArray(rows) || rows.length === 0) {
            rows = fourPlusResolved.entries.map(function (entry) {
              return [entry];
            });
          }

          rows.forEach(function (rowEntries, rowIndex) {
            var rowEl = document.createElement("span");
            rowEl.className = "text-fourplus-row row-" + rowIndex;
            (Array.isArray(rowEntries) ? rowEntries : []).forEach(function (entry, entryIndex) {
              var partEl = document.createElement("span");
              var sourceSlot = Number.isInteger(entry && entry.slot) ? entry.slot : (rowIndex + entryIndex);
              var normalizedSlot = ((sourceSlot % fourPartLabels.length) + fourPartLabels.length) % fourPartLabels.length;
              var label = fourPartLabels[normalizedSlot];
              partEl.className = "text-fourplus-part text-three-part part-" + label;
              if (entry && entry.isDescriptor) {
                partEl.classList.add("is-descriptor");
              }
              if (entry && Array.isArray(entry.tokens) && entry.tokens.length > 0) {
                entry.tokens.forEach(function (token, tokenIndex) {
                  if (tokenIndex > 0) {
                    partEl.appendChild(document.createTextNode(" "));
                  }
                  var tokenEl = document.createElement("span");
                  tokenEl.className = "text-fourplus-token";
                  tokenEl.dataset.sourceIndex = String(token.sourceIndex);
                  tokenEl.dataset.normalized = token.normalized || "";
                  tokenEl.textContent = token.isDescriptor ? String(token.text || "").toLowerCase() : token.text;
                  if (token.isDescriptor) {
                    tokenEl.classList.add("is-descriptor-token");
                    descriptorTokenRefs.push({
                      el: tokenEl,
                      partEl: partEl,
                      sourceIndex: Number(token.sourceIndex) || 0,
                      tokenOrder: tokenIndex
                    });
                  }
                  partEl.appendChild(tokenEl);
                });
              } else {
                partEl.textContent = entry.text;
              }
              rowEl.appendChild(partEl);
              parts.push(partEl);
            });
            layout.appendChild(rowEl);
          });
        } else if (templateWords.length === 3 || typographyPreset.mode === "three-word-contrast") {
          var resolvedPartTexts = resolvePartTexts(templateWords, profile);
          var filteredPartIndices = toPartIndexArray(options.partIndices);
          var partLabels = ["a", "b", "c", "d", "e", "f", "g", "h"];
          var layoutVariant = sanitizeLayoutVariant(profileMeta.layoutVariant, "inline");
          var allowedSlots = {};

          if (filteredPartIndices.length > 0) {
            filteredPartIndices.forEach(function (slot) {
              allowedSlots[slot] = true;
            });
            resolvedPartTexts = resolvedPartTexts.filter(function (item) {
              return Boolean(allowedSlots[item.slot]);
            });
          }

          if (resolvedPartTexts.length === 0) {
            resolvedPartTexts = resolvePartTexts(templateWords, profile);
          }

          layout.className = "text-three-layout";
          layout.classList.add("layout-" + layoutVariant);
          layerEl.dataset.layoutVariant = layoutVariant;
          layerEl.dataset.layoutMode = "legacy-absolute";

          resolvedPartTexts.forEach(function (part, idx) {
            var partEl = document.createElement("span");
            var slot = Number.isInteger(part.slot) ? part.slot : idx;
            var label = partLabels[Math.max(0, Math.min(partLabels.length - 1, slot))] || "c";
            partEl.className = "text-three-part part-" + label;
            partEl.textContent = part.text;
            layout.appendChild(partEl);
            parts.push(partEl);
          });

          resolvedPartGroups = Array.isArray(profileMeta.partGroups) ? profileMeta.partGroups : [];
        } else {
          var partA2 = document.createElement("span");
          var partB2 = document.createElement("span");
          layout.className = "text-two-layout";
          partA2.className = "text-two-part part-a";
          partB2.className = "text-two-part part-b";
          partA2.textContent = templateWords[0] || "";
          partB2.textContent = templateWords[1] || "";
          layout.appendChild(partA2);
          layout.appendChild(partB2);
          parts = [partA2, partB2];
          layerEl.dataset.layoutMode = "legacy-absolute";
        }

        layerEl.appendChild(layout);
        splitMode = "parts";
      } else if (splitMode === "chars") {
        var splitResult = splitter.buildCharSpans(layerEl, text);
        chars = splitResult.chars;
      } else {
        wholeEl = splitter.setWholeText(layerEl, text, "text-whole");
      }

      layerEl.dataset.layoutMode = layoutMode;

      if (layoutMode === "flow-grid-4plus") {
        layoutDiagnostics = enforceNoOverlap(layerEl, typographyPreset, parts, null);
      }

      enforceFrameFit(layerEl, text, profileMeta, fitContainerTarget);

      if (layoutMode === "flow-grid-4plus") {
        layoutDiagnostics = enforceNoOverlap(layerEl, typographyPreset, parts, layoutDiagnostics);
        var descriptorFallbackResult = applyDescriptorOverflowFallback(
          layerEl,
          text,
          profileMeta,
          typographyPreset,
          parts,
          fitContainerTarget,
          descriptorPolicy,
          descriptorTokenRefs,
          layoutDiagnostics
        );
        layoutDiagnostics = descriptorFallbackResult.layoutDiagnostics || layoutDiagnostics;
        descriptorDiagnostics = Object.assign(descriptorDiagnostics, descriptorFallbackResult.descriptorDiagnostics || {});
      } else {
        layerEl.dataset.overlapCount = "0";
        layerEl.dataset.fourPlusRowGap = "0";
        layerEl.dataset.fourPlusColGap = "0";
        layerEl.dataset.fourPlusPartScale = "1";
        layoutDiagnostics = {
          overlapCount: 0,
          rowGap: 0,
          colGap: 0,
          partScale: 1
        };
        descriptorDiagnostics = {
          mode: "-",
          count: 0,
          hiddenCount: 0,
          fallbackTriggered: false
        };
      }
      writeDescriptorDiagnostics(layerEl, descriptorDiagnostics);

      return {
        layerEl: layerEl,
        word: text,
        profile: profile,
        motionPreset: motionPreset,
        typographyPreset: typographyPreset,
        splitMode: splitMode,
        parts: parts,
        chars: chars,
        wholeEl: wholeEl,
        fitContainerEl: fitContainerTarget,
        resolvedPartGroups: resolvedPartGroups,
        layoutMode: layoutMode,
        layoutDiagnostics: layoutDiagnostics,
        descriptorPolicy: descriptorPolicy,
        descriptorTokenRefs: descriptorTokenRefs,
        descriptorDiagnostics: descriptorDiagnostics
      };
    }

    function getTargets(render, descriptor) {
      if (descriptor.target === "parts" && render.parts.length > 0) {
        return render.parts;
      }
      if (descriptor.target === "chars" && render.chars.length > 0) {
        return render.chars;
      }
      if (descriptor.target === "whole" && render.wholeEl) {
        return [render.wholeEl];
      }
      if (render.chars.length > 0) {
        return render.chars;
      }
      if (render.wholeEl) {
        return [render.wholeEl];
      }
      return [render.layerEl];
    }

    function measureWordRect(render) {
      var containerRect = containerEl.getBoundingClientRect();
      var targetRect = render.wholeEl ? render.wholeEl.getBoundingClientRect() : getLayerContentRect(render.layerEl);
      var padX = 18;
      var padY = 10;
      return {
        x: Math.max(0, targetRect.left - containerRect.left - padX),
        y: Math.max(0, targetRect.top - containerRect.top - padY),
        width: Math.max(10, targetRect.width + padX * 2),
        height: Math.max(10, targetRect.height + padY * 2)
      };
    }

    function animateFocusIn(tl, render, at, preset) {
      if (!preset || !preset.focusFrame) {
        return;
      }

      var focusIn = preset.focusFrame.in || {};
      var rect = measureWordRect(render);
      gsap.set(focusFrameEl, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      });
      tl.fromTo(
        focusFrameEl,
        { opacity: 0, scale: 0.92 },
        {
          opacity: toNumber(focusIn.opacity, 1),
          scale: toNumber(focusIn.scale, 1),
          duration: toNumber(focusIn.duration, 0.42),
          ease: resolveEase(easingRegistry, focusIn.easeToken || "cinema.smoothCurve")
        },
        at + 0.08
      );
    }

    function stabilizeFourPlusRender(render, fitContainerFallback) {
      if (!render) {
        return;
      }
      var fitContainerTarget = render.fitContainerEl || fitContainerFallback || containerEl;
      enforceFrameFit(render.layerEl, render.word, render.profile.meta, fitContainerTarget);
      if (render.layoutMode !== "flow-grid-4plus") {
        return;
      }

      render.layoutDiagnostics = enforceNoOverlap(
        render.layerEl,
        render.typographyPreset,
        render.parts,
        render.layoutDiagnostics
      );

      var descriptorFallbackResult = applyDescriptorOverflowFallback(
        render.layerEl,
        render.word,
        render.profile.meta,
        render.typographyPreset,
        render.parts,
        fitContainerTarget,
        render.descriptorPolicy,
        render.descriptorTokenRefs,
        render.layoutDiagnostics
      );

      render.layoutDiagnostics = descriptorFallbackResult.layoutDiagnostics || render.layoutDiagnostics;
      render.descriptorDiagnostics = descriptorFallbackResult.descriptorDiagnostics || render.descriptorDiagnostics;
      writeDescriptorDiagnostics(render.layerEl, render.descriptorDiagnostics);
    }

    function syncFocusFrameToActive() {
      if (activeBackRender) {
        stabilizeFourPlusRender(activeBackRender, backContainerEl || containerEl);
      }

      if (!activeRender) {
        return;
      }
      stabilizeFourPlusRender(activeRender, containerEl);
      if (!activeRender.motionPreset.focusFrame) {
        return;
      }
      var rect = measureWordRect(activeRender);
      gsap.set(focusFrameEl, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      });
    }

    function animateFocusOut(tl, preset, at) {
      if (!preset || !preset.focusFrame) {
        tl.to(
          focusFrameEl,
          {
            opacity: 0,
            duration: 0.2,
            ease: resolveEase(easingRegistry, "ease.expoOut")
          },
          at
        );
        return;
      }

      var focusOut = preset.focusFrame.out || {};
      tl.to(
        focusFrameEl,
        {
          opacity: toNumber(focusOut.opacity, 0),
          scale: toNumber(focusOut.scale, 1.04),
          duration: toNumber(focusOut.duration, 0.26),
          ease: resolveEase(easingRegistry, focusOut.easeToken || "ease.expoOut")
        },
        at
      );
    }

    function timelineToWithDescriptor(tl, targets, descriptor, at, easeToken, phase) {
      var toVars = {
        duration: toNumber(descriptor.duration, phase === "in" ? 0.9 : 0.6),
        ease: resolveEase(easingRegistry, easeToken)
      };

      if (descriptor.stagger != null) {
        toVars.stagger = descriptor.stagger;
      }

      if (Array.isArray(descriptor.keyframes) && descriptor.keyframes.length > 0) {
        toVars.keyframes = descriptor.keyframes;
      } else {
        Object.assign(toVars, descriptor.to || {});
      }

      tl.to(targets, toVars, at);
      return toVars.duration;
    }

    function applyDescriptorFromState(descriptor, targets) {
      if (!descriptor || !descriptor.from || !Array.isArray(targets) || targets.length === 0) {
        return;
      }

      if (Array.isArray(descriptor.eachFrom)) {
        targets.forEach(function (target, idx) {
          gsap.set(target, Object.assign({}, descriptor.from, descriptor.eachFrom[idx] || {}));
        });
        return;
      }

      gsap.set(targets, descriptor.from);
    }

    function transitionToWord(nextValue, meta) {
      var normalized = splitter.normalizeInput(nextValue);
      if (!normalized) {
        return false;
      }

      var resolvedTemplate = textTemplateEngine.resolveTemplate(normalized);
      var renderText = resolvedTemplate.words.join(" ");
      var profile = getProfile(normalized);
      var profileMeta = profile.meta || {};
      var resolvedDepthMap = normalizeDepthMap(profileMeta);
      var useSplitDepth =
        Boolean(
          hasBackPlane &&
          profileMeta.planeMode === "split-depth" &&
          resolvedDepthMap &&
          resolvedDepthMap.back.length > 0 &&
          resolvedDepthMap.front.length > 0
        );

      var incomingLayerIndex = activeRender ? (activeLayerIndex === 0 ? 1 : 0) : activeLayerIndex;
      var incomingLayerEl = layers[incomingLayerIndex];
      gsap.set(incomingLayerEl, { opacity: 0, visibility: "hidden" });
      var incomingRender = prepareLayer(
        incomingLayerEl,
        renderText,
        profile,
        resolvedTemplate,
        {
          fitContainerEl: containerEl,
          partIndices: useSplitDepth ? resolvedDepthMap.front : null
        }
      );
      var incomingBackLayerIndex = activeBackRender ? (activeBackLayerIndex === 0 ? 1 : 0) : activeBackLayerIndex;
      var incomingBackLayerEl = null;
      var incomingBackRender = null;

      if (useSplitDepth) {
        incomingBackLayerEl = backLayers[incomingBackLayerIndex];
        gsap.set(incomingBackLayerEl, { opacity: 0, visibility: "hidden" });
        incomingBackRender = prepareLayer(
          incomingBackLayerEl,
          renderText,
          profile,
          resolvedTemplate,
          {
            fitContainerEl: backContainerEl || containerEl,
            partIndices: resolvedDepthMap.back
          }
        );
      }

      if (activeTimeline) {
        activeTimeline.kill();
      }

      var tl = gsap.timeline({
        defaults: { overwrite: true },
        onComplete: function () {
          if (activeRender && activeRender.layerEl !== incomingRender.layerEl) {
            clearLayer(activeRender.layerEl);
            gsap.set(activeRender.layerEl, { opacity: 0, visibility: "hidden" });
          }
          if (activeBackRender && (!incomingBackRender || activeBackRender.layerEl !== incomingBackRender.layerEl)) {
            clearLayer(activeBackRender.layerEl);
            gsap.set(activeBackRender.layerEl, { opacity: 0, visibility: "hidden" });
          }

          activeLayerIndex = incomingLayerIndex;
          if (incomingBackRender) {
            activeBackLayerIndex = incomingBackLayerIndex;
          }
          activeRender = incomingRender;
          activeBackRender = incomingBackRender;
          activeWord = normalized;
          activeTemplateInfo = resolvedTemplate;
          syncFocusFrameToActive();
          notify();
        }
      });

      var inDescriptor = incomingRender.motionPreset.in({
        word: normalized,
        profile: incomingRender.profile,
        render: incomingRender,
        template: resolvedTemplate
      });
      var inTargets = getTargets(incomingRender, inDescriptor);
      applyDescriptorFromState(inDescriptor, inTargets);

      var backInDescriptor = null;
      var backInTargets = [];
      if (incomingBackRender) {
        backInDescriptor = incomingBackRender.motionPreset.in({
          word: normalized,
          profile: incomingBackRender.profile,
          render: incomingBackRender,
          template: resolvedTemplate
        });
        backInTargets = getTargets(incomingBackRender, backInDescriptor);
        applyDescriptorFromState(backInDescriptor, backInTargets);
      }

      // Force one layout pass while hidden so fit shifts are applied before first visible frame.
      incomingRender.layerEl.getBoundingClientRect();
      gsap.set(incomingRender.layerEl, { opacity: 1, visibility: "visible" });
      if (incomingBackRender) {
        incomingBackRender.layerEl.getBoundingClientRect();
        gsap.set(incomingBackRender.layerEl, { opacity: 1, visibility: "visible" });
      }

      var outDuration = 0;
      if (activeRender) {
        var outPreset = activeRender.motionPreset;
        var outDescriptor = outPreset.out({
          word: activeRender.word,
          profile: activeRender.profile,
          render: activeRender,
          template: activeTemplateInfo
        });
        var outTargets = getTargets(activeRender, outDescriptor);
        outDuration = toNumber(outDescriptor.duration, 0.56);
        timelineToWithDescriptor(
          tl,
          outTargets,
          outDescriptor,
          0,
          outPreset.easeOutToken || "ease.expoOut",
          "out"
        );
        outDuration = Math.max(outDuration, toNumber(outDescriptor.duration, 0.56));
        animateFocusOut(tl, outPreset, 0);
      } else {
        gsap.set(focusFrameEl, { opacity: 0 });
      }

      if (activeBackRender) {
        var outPresetBack = activeBackRender.motionPreset;
        var outDescriptorBack = outPresetBack.out({
          word: activeBackRender.word,
          profile: activeBackRender.profile,
          render: activeBackRender,
          template: activeTemplateInfo
        });
        var outTargetsBack = getTargets(activeBackRender, outDescriptorBack);
        timelineToWithDescriptor(
          tl,
          outTargetsBack,
          outDescriptorBack,
          0,
          outPresetBack.easeOutToken || "ease.expoOut",
          "out"
        );
        outDuration = Math.max(outDuration, toNumber(outDescriptorBack.duration, 0.56));
      }

      var inAt = (activeRender || activeBackRender) ? Math.max(0, outDuration - overlapSeconds) : 0;
      var inDuration = timelineToWithDescriptor(
        tl,
        inTargets,
        inDescriptor,
        inAt,
        incomingRender.motionPreset.easeInToken || "cinema.smoothCurve",
        "in"
      );

      if (incomingBackRender && backInDescriptor) {
        inDuration = Math.max(
          inDuration,
          timelineToWithDescriptor(
            tl,
            backInTargets,
            backInDescriptor,
            inAt,
            incomingBackRender.motionPreset.easeInToken || "cinema.smoothCurve",
            "in"
          )
        );
      }

      animateFocusIn(tl, incomingRender, inAt, incomingRender.motionPreset);

      activeTimeline = tl;

      containerEl.dataset.activeWord = normalized;
      containerEl.dataset.templateMode = resolvedTemplate.mode;
      containerEl.dataset.wordCount = String(resolvedTemplate.count);
      containerEl.dataset.lastReason = meta && meta.reason ? meta.reason : "manual";

      if (meta && meta.pauseCycle !== false && wordCycle) {
        wordCycle.pauseOneBeat();
      }

      if (meta && meta.replayOnly) {
        // Keep current index unchanged, only run timeline.
      }

      profileMap.set(keyForWord(normalized), profile);
      ensureWordInBank(normalized);
      refreshVisibleWordBank();
      var cycleWords = visibleWordBank.length > 0 ? visibleWordBank : [normalized];
      wordCycle.setWords(cycleWords, { preserveCurrent: true });
      if (!wordCycle.jumpToWord(normalized, { emit: false }) && cycleWords.length > 0) {
        wordCycle.jumpToWord(cycleWords[0], { emit: false });
      }

      containerEl.dataset.runtimeMotion = profile.motionPreset;
      containerEl.dataset.runtimeTypography = profile.typographyPreset;
      containerEl.dataset.runtimeSplit = incomingRender.splitMode;
      containerEl.dataset.runtimeBias = (profile.meta && profile.meta.styleBias) || "";
      containerEl.dataset.runtimeReferencePack = (profile.meta && profile.meta.referencePack) || "";
      containerEl.dataset.runtimeReferenceId = (profile.meta && profile.meta.referenceId) || "";
      containerEl.dataset.runtimeLayout = (profile.meta && profile.meta.layoutVariant) || "";
      containerEl.dataset.runtimeLayoutMode = incomingRender.layoutMode || "legacy-absolute";
      containerEl.dataset.runtimeSpacingPolicy = (profile.meta && profile.meta.spacingPolicy) || "-";
      containerEl.dataset.runtimePlaneMode = useSplitDepth ? "split-depth" : "single";
      containerEl.dataset.runtimeDepthMap = resolvedDepthMap
        ? "b[" + resolvedDepthMap.back.join(",") + "]/f[" + resolvedDepthMap.front.join(",") + "]"
        : "-";
      containerEl.dataset.runtimePartGroups = Array.isArray(incomingRender.resolvedPartGroups)
        ? JSON.stringify(incomingRender.resolvedPartGroups)
        : "-";
      containerEl.dataset.runtimeOverlapCount = String(
        Math.max(
          0,
          toNumber(incomingRender.layerEl.dataset.overlapCount, 0),
          incomingBackRender ? toNumber(incomingBackRender.layerEl.dataset.overlapCount, 0) : 0
        )
      );
      containerEl.dataset.runtimeRowGap = incomingRender.layerEl.dataset.fourPlusRowGap || "0";
      containerEl.dataset.runtimeColGap = incomingRender.layerEl.dataset.fourPlusColGap || "0";
      containerEl.dataset.runtimePartScale = incomingRender.layerEl.dataset.fourPlusPartScale || "1";
      containerEl.dataset.runtimeDescriptorCount = String(
        Math.max(
          0,
          toNumber(incomingRender.layerEl.dataset.descriptorCount, 0),
          incomingBackRender ? toNumber(incomingBackRender.layerEl.dataset.descriptorCount, 0) : 0
        )
      );
      containerEl.dataset.runtimeHiddenDescriptorCount = String(
        Math.max(
          0,
          toNumber(incomingRender.layerEl.dataset.hiddenDescriptorCount, 0),
          incomingBackRender ? toNumber(incomingBackRender.layerEl.dataset.hiddenDescriptorCount, 0) : 0
        )
      );
      containerEl.dataset.runtimeDescriptorMode = incomingRender.layerEl.dataset.descriptorMode || "-";
      containerEl.dataset.runtimeDescriptorFallback =
        incomingRender.layerEl.dataset.descriptorFallback === "yes" ||
        (incomingBackRender && incomingBackRender.layerEl.dataset.descriptorFallback === "yes")
          ? "yes"
          : "no";
      containerEl.dataset.runtimeInDuration = String(Number(inDuration.toFixed(3)));
      containerEl.dataset.runtimeOverlap = String(overlapSeconds);

      return true;
    }

    function getMappingSummary() {
      var lines = [];
      var summaryWords = wordCountFilter === "all" ? wordBank : visibleWordBank;
      lines.push("Word                     Motion Preset          Typography Preset        timing(in/out/stagger/hold)  meta(pack/id/layout|mode|spacing|bias|plane|depth|groups|descMode|descWords|descHide)");
      lines.push("-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------");

      summaryWords.forEach(function (word) {
        var profile = getProfile(word);
        var timing = profile.timing || {};
        var meta = profile.meta || {};
        var timingText =
          (toNumber(timing.inDuration, 0.88).toFixed(2)) +
          "/" +
          (toNumber(timing.outDuration, 0.56).toFixed(2)) +
          "/" +
          (toNumber(timing.stagger, 0).toFixed(3)) +
          "/" +
          (toNumber(timing.hold, 1.4).toFixed(2));
        var depth = normalizeDepthMap(meta);
        var depthText = depth ? ("b[" + depth.back.join(",") + "]/f[" + depth.front.join(",") + "]") : "-";
        var groupsText = Array.isArray(meta.partGroups) ? JSON.stringify(meta.partGroups) : "-";
        var descriptorWordsText = Array.isArray(meta.descriptorWords) && meta.descriptorWords.length > 0
          ? meta.descriptorWords.join(",")
          : "-";
        var descriptorModeText = meta.descriptorMode || "-";
        var descriptorHideText = meta.descriptorHideOnFinalOverflow === false ? "no" : "yes";

        lines.push(
          word.padEnd(24, " ") +
            profile.motionPreset.padEnd(22, " ") +
            profile.typographyPreset.padEnd(24, " ") +
            timingText.padEnd(30, " ") +
            (
              (meta.referencePack || "-") +
              "/" +
              (meta.referenceId || "-") +
              "/" +
              (meta.layoutVariant || "inline") +
              "|" +
              (meta.layoutMode || "legacy-absolute") +
              "|" +
              (meta.spacingPolicy || "-") +
              "|" +
              (meta.styleBias || "-") +
              "|" +
              (meta.planeMode || "single") +
              "|" +
              depthText +
              "|" +
              groupsText +
              "|" +
              descriptorModeText +
              "|" +
              descriptorWordsText +
              "|" +
              descriptorHideText
            )
        );
      });

      lines.push("");
      lines.push(
        "Active=" +
          (activeWord || "-") +
          " | Filter=" +
          wordCountFilter +
          " (" +
          visibleWordBank.length +
          " visible/" +
          wordBank.length +
          " total)" +
          " | Auto=" +
          (wordCycle.isAutoRotate() ? "on" : "off") +
          " | Interval=" +
          wordCycle.getIntervalMs() +
          "ms | TemplateMode=" +
          (activeTemplateInfo ? activeTemplateInfo.mode : "-")
      );
      return lines.join("\n");
    }

    function getRuntimeRows() {
      if (!activeRender) {
        return ["text-compartment preset=- ease=- dur=- at=-"];
      }

      var timing = activeRender.profile.timing || {};
      var meta = activeRender.profile.meta || {};
      var fitScale = activeRender.layerEl.dataset.fitScale || "1";
      var depth = normalizeDepthMap(meta);
      var depthText = depth ? ("b[" + depth.back.join(",") + "]/f[" + depth.front.join(",") + "]") : "-";
      var groupsText = Array.isArray(activeRender.resolvedPartGroups)
        ? JSON.stringify(activeRender.resolvedPartGroups)
        : Array.isArray(meta.partGroups)
          ? JSON.stringify(meta.partGroups)
          : "-";
      var overlapCount = activeRender.layerEl.dataset.overlapCount || "0";
      var rowGap = activeRender.layerEl.dataset.fourPlusRowGap || "0";
      var colGap = activeRender.layerEl.dataset.fourPlusColGap || "0";
      var partScale = activeRender.layerEl.dataset.fourPlusPartScale || "1";
      var descriptorCount = activeRender.layerEl.dataset.descriptorCount || "0";
      var hiddenDescriptorCount = activeRender.layerEl.dataset.hiddenDescriptorCount || "0";
      var descriptorMode = activeRender.layerEl.dataset.descriptorMode || "-";
      var descriptorFallback = activeRender.layerEl.dataset.descriptorFallback || "no";
      var rows = [
        "text-word     preset=" +
          activeRender.profile.motionPreset.padEnd(20, " ") +
          " easeIn=" +
          String(activeRender.motionPreset.easeInToken || "-").padEnd(17, " ") +
          " split=" +
          activeRender.splitMode +
          " fit=" +
          fitScale +
          " ov=" +
          overlapCount +
          " rg=" +
          rowGap +
          " cg=" +
          colGap +
          " ps=" +
          partScale +
          " ref=" +
          String((meta.referencePack || "-") + "/" + (meta.referenceId || "-")).padEnd(29, " ") +
          " layout=" +
          String(meta.layoutVariant || "-").padEnd(13, " ") +
          " mode=" +
          String(activeRender.layoutMode || meta.layoutMode || "legacy-absolute").padEnd(16, " ") +
          " bias=" +
          String(meta.styleBias || "-").padEnd(13, " ") +
          " plane=" +
          String(meta.planeMode || "single").padEnd(11, " ") +
          " depth=" +
          depthText.padEnd(15, " ") +
          " groups=" +
          groupsText.padEnd(20, " ") +
          " desc=" +
          (descriptorCount + "/" + hiddenDescriptorCount).padEnd(9, " ") +
          " dmode=" +
          descriptorMode.padEnd(11, " ") +
          " dfb=" +
          descriptorFallback.padEnd(4, " ") +
          " hold=" +
          toNumber(timing.hold, 1.4).toFixed(2) +
          "s"
      ];

      if (activeBackRender) {
        rows.push(
          "text-word-bk  preset=" +
            activeBackRender.profile.motionPreset.padEnd(20, " ") +
            " easeIn=" +
            String(activeBackRender.motionPreset.easeInToken || "-").padEnd(17, " ") +
            " split=" +
            activeBackRender.splitMode +
            " fit=" +
            String(activeBackRender.layerEl.dataset.fitScale || "1") +
            " ov=" +
            String(activeBackRender.layerEl.dataset.overlapCount || "0") +
            " desc=" +
            String(
              (activeBackRender.layerEl.dataset.descriptorCount || "0") +
              "/" +
              (activeBackRender.layerEl.dataset.hiddenDescriptorCount || "0")
            ).padEnd(9, " ") +
            " dmode=" +
            String(activeBackRender.layerEl.dataset.descriptorMode || "-").padEnd(11, " ") +
            " dfb=" +
            String(activeBackRender.layerEl.dataset.descriptorFallback || "no")
        );
      }

      return rows;
    }

    wordBank.forEach(function (word) {
      upsertProfile(word, defaultProfiles[word] || null);
    });
    refreshVisibleWordBank();

    var wordCycle = textTemplateEngine.createWordCycle({
      words: visibleWordBank.length > 0 ? visibleWordBank : wordBank,
      autoRotate: config.autoRotate !== false,
      intervalMs: config.intervalMs,
      onTick: function (event) {
        transitionToWord(event.word, { reason: event.reason, pauseCycle: false });
      }
    });

    function start() {
      if (!activeWord) {
        transitionToWord(wordCycle.getCurrentWord() || wordBank[0], { reason: "init", pauseCycle: false });
      }
      if (wordCycle.isAutoRotate()) {
        wordCycle.start();
      }
      return api;
    }

    function stop() {
      wordCycle.stop();
      return api;
    }

    function applyWord(rawWord, options) {
      var normalized = splitter.normalizeInput(rawWord);
      if (!normalized) {
        if (activeWord) {
          transitionToWord(activeWord, { reason: "manual", replayOnly: true });
          return true;
        }
        return false;
      }

      ensureWordInBank(normalized);
      upsertProfile(normalized, options && options.profile ? options.profile : null);
      transitionToWord(normalized, { reason: (options && options.reason) || "manual", pauseCycle: true });
      notify();
      return true;
    }

    function replayCurrent() {
      var word = activeWord || wordCycle.getCurrentWord() || wordBank[0];
      if (!word) {
        return false;
      }
      transitionToWord(word, { reason: "replay", replayOnly: true, pauseCycle: true });
      notify();
      return true;
    }

    var api = {
      start: start,
      stop: stop,
      applyWord: applyWord,
      replayCurrent: replayCurrent,
      setAutoRotate: function setAutoRotate(enabled) {
        wordCycle.setAutoRotate(enabled);
        if (enabled) {
          wordCycle.start();
        }
        notify();
        return api;
      },
      isAutoRotate: function isAutoRotate() {
        return wordCycle.isAutoRotate();
      },
      setIntervalMs: function setIntervalMs(value) {
        wordCycle.setIntervalMs(value);
        notify();
        return api;
      },
      getIntervalMs: function getIntervalMs() {
        return wordCycle.getIntervalMs();
      },
      pauseOneBeat: function pauseOneBeat() {
        wordCycle.pauseOneBeat();
        return api;
      },
      setWordCountFilter: function setWordCountFilter(filterValue) {
        var nextFilter = normalizeWordCountFilter(filterValue);
        wordCountFilter = nextFilter;
        refreshVisibleWordBank();

        if (visibleWordBank.length > 0) {
          wordCycle.setWords(visibleWordBank, { preserveCurrent: true });
          var currentWord = api.getCurrentWord();
          if (currentWord && !matchesWordCountFilter(splitter, currentWord, wordCountFilter)) {
            transitionToWord(visibleWordBank[0], { reason: "filter-change", pauseCycle: false });
          }
          if (wordCycle.isAutoRotate()) {
            wordCycle.start();
          }
        } else {
          wordCycle.stop();
        }

        notify();
        return api;
      },
      getWordCountFilter: function getWordCountFilter() {
        return wordCountFilter;
      },
      getWordBank: function getWordBank(filterValue) {
        if (filterValue != null) {
          return getFilteredWords(filterValue);
        }
        return wordBank.slice(0);
      },
      getVisibleWordBank: function getVisibleWordBank() {
        return visibleWordBank.slice(0);
      },
      getCurrentWord: function getCurrentWord() {
        return activeWord || wordCycle.getCurrentWord();
      },
      getMappingSummary: getMappingSummary,
      getRuntimeRows: getRuntimeRows,
      getState: function getState() {
        return {
          currentWord: api.getCurrentWord(),
          wordBank: api.getWordBank(),
          visibleWordBank: api.getVisibleWordBank(),
          wordCountFilter: api.getWordCountFilter(),
          autoRotate: api.isAutoRotate(),
          intervalMs: api.getIntervalMs(),
          templateMode: activeTemplateInfo ? activeTemplateInfo.mode : null
        };
      },
      onChange: onChange,
      getTextTemplateEngine: function getTextTemplateEngine() {
        return textTemplateEngine;
      }
    };

    gsap.set(layerCurrentEl, { opacity: 1, visibility: "visible" });
    gsap.set(layerNextEl, { opacity: 0, visibility: "hidden" });
    if (hasBackPlane) {
      gsap.set(backLayerCurrentEl, { opacity: 0, visibility: "hidden" });
      gsap.set(backLayerNextEl, { opacity: 0, visibility: "hidden" });
    }
    gsap.set(focusFrameEl, { opacity: 0 });

    window.addEventListener("resize", function () {
      syncFocusFrameToActive();
    });

    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
      document.fonts.ready.then(function () {
        syncFocusFrameToActive();
      });
      if (typeof document.fonts.addEventListener === "function") {
        document.fonts.addEventListener("loadingdone", function () {
          syncFocusFrameToActive();
        });
      }
    }

    return api;
  };
}());
