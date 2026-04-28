(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  ns.buildDemoScene = function buildDemoScene() {
    var motionEngine = ns.createMotionEngine({
      stageSelector: "#stage",
      defaultDuration: 1.2,
      defaultEase: "cinema.smoothCurve",
      stagger: 0.16,
      offscreen: {
        baseMargin: 150
      }
    });

    var presetLibrary = ns.createMotionPresets(motionEngine.getEasingRegistry(), motionEngine.getOffscreenResolver());
    Object.keys(presetLibrary).forEach(function (name) {
      motionEngine.registerPreset(name, presetLibrary[name]);
    });

    motionEngine.addObject({
      id: "hero-a",
      selector: "#heroA",
      layer: "foreground",
      fromRule: "left",
      preset: "softSlideLeft",
      to: {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1
      },
      timing: {
        at: 0.18
      }
    });

    motionEngine.addObject({
      id: "hero-b",
      selector: "#heroB",
      layer: "midground",
      fromRule: "right",
      preset: "parallaxCross",
      to: {
        x: 0,
        y: 0,
        scale: 1.01,
        rotation: 0,
        opacity: 0.98
      },
      timing: {
        at: 0.38
      }
    });

    var textTemplateEngine = ns.createTextTemplateEngine({
      defaultOverlapSeconds: 0.14
    });

    var wordCountTemplates = ns.createWordCountTemplates();
    Object.keys(wordCountTemplates).forEach(function (count) {
      textTemplateEngine.registerWordCountTemplate(Number(count), wordCountTemplates[count]);
    });

    var textMotionObjects = textTemplateEngine.buildTextObjects({
      words: ["Agentic"],
      id: "text-compartment",
      selector: "#textCompartment",
      layer: "accent",
      fromRule: "top",
      preset: "dropSettle",
      timing: {
        at: 0.88,
        duration: 1.05
      }
    });

    textMotionObjects.forEach(function (objectConfig) {
      motionEngine.addObject(objectConfig);
    });

    motionEngine.addObject({
      id: "accent-tag",
      selector: "#accentTag",
      layer: "accent",
      fromRule: "bottom",
      preset: "softSlideRight",
      to: {
        x: 0,
        y: 0,
        opacity: 0.92
      },
      timing: {
        at: 1.08,
        duration: 0.98
      }
    });

    return {
      motionEngine: motionEngine,
      textTemplateEngine: textTemplateEngine
    };
  };
}());
