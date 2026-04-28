(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};
  var BUILD_ID = "phase4-v1.3-descriptor-rule";
  var EXPECTED_LEGACY_SHADOW_PHRASES = [
    "Dream BIG NOW",
    "Your MASTER MIND",
    "Take ACTION NOW",
    "Build LEGACY YOUR"
  ];

  window.CinematicMotionBuild = BUILD_ID;

  function getImageElements() {
    return ["#heroA img", "#heroB img"]
      .map(function (selector) {
        return document.querySelector(selector);
      })
      .filter(Boolean);
  }

  function waitForImages(images, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (images.length === 0) {
        resolve();
        return;
      }

      var pending = images.length;
      var timer = setTimeout(function () {
        reject(new Error("Timed out while waiting for image assets."));
      }, timeoutMs);

      function completeOne() {
        pending -= 1;
        if (pending <= 0) {
          clearTimeout(timer);
          resolve();
        }
      }

      images.forEach(function (img) {
        if (img.complete) {
          completeOne();
          return;
        }

        img.addEventListener("load", completeOne, { once: true });
        img.addEventListener("error", completeOne, { once: true });
      });
    });
  }

  function missingImagePaths(images) {
    return images
      .filter(function (img) {
        return !img.naturalWidth;
      })
      .map(function (img) {
        return img.getAttribute("src") || "<unknown>";
      });
  }

  function withBuild(text) {
    return String(text || "").trim() + " | build=" + BUILD_ID;
  }

  function getMissingLegacyShadowPhrases(textCompartment) {
    if (!textCompartment || typeof textCompartment.getWordBank !== "function") {
      return EXPECTED_LEGACY_SHADOW_PHRASES.slice(0);
    }

    var available = textCompartment.getWordBank("3").map(function (phrase) {
      return String(phrase || "").trim().toLowerCase();
    });

    return EXPECTED_LEGACY_SHADOW_PHRASES.filter(function (phrase) {
      return available.indexOf(String(phrase).toLowerCase()) < 0;
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var statusLine = document.getElementById("statusLine");

    try {
      var scene = ns.buildDemoScene();
      var engine = scene.motionEngine;
      var textCompartment = ns.createTextCompartment({
        motionEngine: engine,
        textTemplateEngine: scene.textTemplateEngine,
        intervalMs: 3200,
        autoRotate: true
      });
      var panelApi = ns.initDebugPanel(engine, textCompartment);
      var images = getImageElements();
      var missingLegacyPhrases = getMissingLegacyShadowPhrases(textCompartment);

      waitForImages(images, 12000)
        .then(function () {
          engine.buildTimeline();
          engine.play();
          textCompartment.start();
          panelApi.updateReadout();
          panelApi.updateTextMappingReadout();

          var missing = missingImagePaths(images);
          if (missingLegacyPhrases.length > 0) {
            panelApi.setStatus(
              withBuild("Missing expected 3-word phrases: " + missingLegacyPhrases.join(", "))
            );
          } else if (missing.length > 0) {
            panelApi.setStatus(withBuild("Autoplay started, but missing: " + missing.join(", ")));
          } else {
            panelApi.setStatus(withBuild("Autoplay started with image motion + swappable text templates."));
          }
        })
        .catch(function (error) {
          engine.buildTimeline();
          engine.play();
          textCompartment.start();
          panelApi.updateReadout();
          panelApi.updateTextMappingReadout();
          if (missingLegacyPhrases.length > 0) {
            panelApi.setStatus(
              withBuild(
                "Missing expected 3-word phrases: " +
                missingLegacyPhrases.join(", ") +
                " | load warning: " +
                error.message
              )
            );
          } else {
            panelApi.setStatus(withBuild("Autoplay started with load warning: " + error.message));
          }
        });
    } catch (error) {
      if (statusLine) {
        statusLine.textContent = withBuild("Initialization failed: " + error.message);
      }
      console.error(error);
    }
  });
}());
