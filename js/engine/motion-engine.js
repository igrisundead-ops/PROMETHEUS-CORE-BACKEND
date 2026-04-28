(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  function toElement(value) {
    if (!value) {
      return null;
    }

    if (value.nodeType === 1) {
      return value;
    }

    if (typeof value === "string") {
      return document.querySelector(value);
    }

    return null;
  }

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  ns.createMotionEngine = function createMotionEngine(options) {
    var settings = Object.assign(
      {
        stageSelector: "#stage",
        defaultDuration: 1.2,
        defaultEase: "ease.powerOut",
        stagger: 0.14,
        offscreen: { baseMargin: 140 }
      },
      options || {}
    );

    var stageEl = toElement(settings.stageSelector);
    if (!stageEl) {
      throw new Error("Stage element was not found for motion engine.");
    }

    var stageFrameEl = stageEl.closest(".stage-frame");
    var easingRegistry = ns.createEasingRegistry();
    var offscreenResolver = ns.createOffscreenResolver(stageEl, settings.offscreen);
    var objects = [];
    var presetMap = new Map();
    var runtimeRecords = {};
    var timeline = null;
    var globalPresetName = null;
    var speedMultiplier = 1;

    function resolvePresetNameForObject(objectConfig) {
      return objectConfig.overridePreset || globalPresetName || objectConfig.preset;
    }

    function getObjectById(id) {
      return objects.find(function (item) {
        return item.id === id;
      }) || null;
    }

    function clearMotionProps() {
      objects.forEach(function (item) {
        gsap.set(item.el, {
          clearProps: "x,y,scale,rotation,rotationX,rotationY,skewX,skewY,opacity,filter"
        });
      });
    }

    function assertPreset(name) {
      if (!presetMap.has(name)) {
        throw new Error("Unknown preset '" + name + "'.");
      }
    }

    function registerPreset(name, presetDef) {
      if (!name || typeof presetDef !== "object") {
        throw new Error("registerPreset(name, presetDef) requires valid values.");
      }

      presetMap.set(name, presetDef);
      return api;
    }

    function addObject(config) {
      var normalized = config || {};
      var el = toElement(normalized.selector || normalized.el);
      if (!el) {
        throw new Error("addObject() failed: selector did not resolve to an element.");
      }

      var id = normalized.id || el.getAttribute("data-motion-id") || "motion-" + (objects.length + 1);
      var objectConfig = {
        id: id,
        el: el,
        selector: normalized.selector || null,
        layer: normalized.layer || "midground",
        fromRule: normalized.fromRule || el.getAttribute("data-from-rule") || "left",
        to: Object.assign({}, normalized.to || {}),
        preset: normalized.preset || "softSlideLeft",
        timing: Object.assign(
          {
            at: null,
            duration: null,
            delay: 0
          },
          normalized.timing || {}
        ),
        overridePreset: null
      };

      objects.push(objectConfig);
      return api;
    }

    function buildTimeline() {
      if (timeline) {
        timeline.kill();
      }

      runtimeRecords = {};
      clearMotionProps();

      if (stageFrameEl) {
        gsap.set(stageFrameEl, { "--ambience": 0 });
      }

      timeline = gsap.timeline({
        paused: true,
        defaults: {
          duration: settings.defaultDuration,
          ease: easingRegistry.resolve(settings.defaultEase)
        }
      });

      if (stageFrameEl) {
        timeline.to(
          stageFrameEl,
          {
            "--ambience": 1,
            duration: 1.18,
            ease: easingRegistry.resolve("cinema.gentle")
          },
          0
        );
      }

      objects.forEach(function (objectConfig, index) {
        var presetName = resolvePresetNameForObject(objectConfig);
        assertPreset(presetName);
        var preset = presetMap.get(presetName);

        var context = {
          stageEl: stageEl,
          frameEl: stageFrameEl,
          el: objectConfig.el,
          object: objectConfig,
          index: index,
          engineOptions: settings,
          easingRegistry: easingRegistry,
          computeFromRule: function computeFromRule(rule, layer) {
            return offscreenResolver.compute(rule, objectConfig.el, layer || objectConfig.layer);
          }
        };

        var fromVars = preset.from ? preset.from(context) : {};
        var toVars = preset.to ? preset.to(context) : {};
        var easeToken = toVars.easeToken || preset.easeToken || settings.defaultEase;
        delete toVars.easeToken;

        var duration = toNumber(
          objectConfig.timing.duration,
          toNumber(toVars.duration, toNumber(preset.defaults && preset.defaults.duration, settings.defaultDuration))
        );
        delete toVars.duration;

        var at = objectConfig.timing.at;
        var startPosition = isFiniteNumber(at) ? at : index * settings.stagger;
        var delay = toNumber(objectConfig.timing.delay, 0);
        var timelinePosition = startPosition + delay;

        gsap.set(objectConfig.el, fromVars);
        timeline.to(
          objectConfig.el,
          Object.assign({}, toVars, { duration: duration, ease: easingRegistry.resolve(easeToken) }),
          timelinePosition
        );

        runtimeRecords[objectConfig.id] = {
          id: objectConfig.id,
          preset: presetName,
          easeToken: easeToken,
          duration: duration,
          position: timelinePosition,
          layer: objectConfig.layer,
          fromRule: objectConfig.fromRule
        };
      });

      timeline.timeScale(speedMultiplier);
      return timeline;
    }

    function play() {
      if (!timeline) {
        buildTimeline();
      }

      timeline.play(0);
      return api;
    }

    function replay() {
      if (!timeline) {
        buildTimeline();
      }

      timeline.restart(true);
      return api;
    }

    function setSpeed(multiplier) {
      speedMultiplier = clamp(toNumber(multiplier, 1), 0.5, 1.5);
      if (timeline) {
        timeline.timeScale(speedMultiplier);
      }
      return api;
    }

    function setPresetForAll(name) {
      assertPreset(name);
      globalPresetName = name;
      objects.forEach(function (item) {
        item.overridePreset = null;
      });
      buildTimeline();
      return api;
    }

    function setPresetForObject(id, name) {
      assertPreset(name);
      var objectConfig = getObjectById(id);
      if (!objectConfig) {
        return false;
      }

      objectConfig.overridePreset = name;
      buildTimeline();
      return true;
    }

    function clearPresetForObject(id) {
      var objectConfig = getObjectById(id);
      if (!objectConfig) {
        return false;
      }

      objectConfig.overridePreset = null;
      buildTimeline();
      return true;
    }

    function setShowGuides(enabled) {
      if (stageFrameEl) {
        stageFrameEl.classList.toggle("show-guides", Boolean(enabled));
      }
      return api;
    }

    function getRuntimeReport() {
      return objects.map(function (item) {
        var runtime = runtimeRecords[item.id];
        if (runtime) {
          return runtime;
        }

        return {
          id: item.id,
          preset: resolvePresetNameForObject(item),
          easeToken: null,
          duration: null,
          position: null,
          layer: item.layer,
          fromRule: item.fromRule
        };
      });
    }

    function getObjectState(id) {
      var objectConfig = getObjectById(id);
      if (!objectConfig) {
        return null;
      }

      return {
        id: objectConfig.id,
        basePreset: objectConfig.preset,
        overridePreset: objectConfig.overridePreset,
        effectivePreset: resolvePresetNameForObject(objectConfig),
        fromRule: objectConfig.fromRule,
        layer: objectConfig.layer
      };
    }

    function listObjectStates() {
      return objects.map(function (item) {
        return getObjectState(item.id);
      });
    }

    function getPresets() {
      return Array.from(presetMap.keys());
    }

    function hasPreset(name) {
      return presetMap.has(name);
    }

    function getGlobalPreset() {
      return globalPresetName;
    }

    function getTimeline() {
      return timeline;
    }

    function getEasingRegistry() {
      return easingRegistry;
    }

    function getOffscreenResolver() {
      return offscreenResolver;
    }

    var api = {
      registerPreset: registerPreset,
      addObject: addObject,
      buildTimeline: buildTimeline,
      play: play,
      replay: replay,
      setSpeed: setSpeed,
      setPresetForAll: setPresetForAll,
      setPresetForObject: setPresetForObject,
      clearPresetForObject: clearPresetForObject,
      setShowGuides: setShowGuides,
      getRuntimeReport: getRuntimeReport,
      getObjectState: getObjectState,
      listObjectStates: listObjectStates,
      getPresets: getPresets,
      hasPreset: hasPreset,
      getGlobalPreset: getGlobalPreset,
      getTimeline: getTimeline,
      getEasingRegistry: getEasingRegistry,
      getOffscreenResolver: getOffscreenResolver
    };

    return api;
  };
}());
