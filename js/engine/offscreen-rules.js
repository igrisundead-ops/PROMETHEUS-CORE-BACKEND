(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  function normalizeRule(rule) {
    if (!rule) {
      return "left";
    }

    var allowed = ["left", "right", "top", "bottom", "diag-left", "diag-right"];
    return allowed.indexOf(rule) >= 0 ? rule : "left";
  }

  function layerFactor(layer) {
    switch (layer) {
      case "foreground":
        return 1.28;
      case "background":
        return 0.86;
      case "accent":
        return 0.72;
      default:
        return 1;
    }
  }

  ns.createOffscreenResolver = function createOffscreenResolver(stageEl, options) {
    if (!stageEl) {
      throw new Error("Stage element is required for offscreen resolver.");
    }

    var settings = Object.assign(
      {
        baseMargin: 130
      },
      options || {}
    );

    function compute(rule, el, layer) {
      if (!el) {
        throw new Error("Element is required for offscreen position calculation.");
      }

      var normalizedRule = normalizeRule(rule);
      var margin = settings.baseMargin * layerFactor(layer);
      var stageRect = stageEl.getBoundingClientRect();
      var elementRect = el.getBoundingClientRect();

      var left = -(elementRect.right - stageRect.left) - margin;
      var right = (stageRect.right - elementRect.left) + margin;
      var top = -(elementRect.bottom - stageRect.top) - margin;
      var bottom = (stageRect.bottom - elementRect.top) + margin;

      var x = 0;
      var y = 0;

      switch (normalizedRule) {
        case "left":
          x = left;
          break;
        case "right":
          x = right;
          break;
        case "top":
          y = top;
          break;
        case "bottom":
          y = bottom;
          break;
        case "diag-left":
          x = left * 0.92;
          y = top * 0.42;
          break;
        case "diag-right":
          x = right * 0.92;
          y = top * 0.42;
          break;
        default:
          x = left;
      }

      return {
        x: Math.round(x),
        y: Math.round(y)
      };
    }

    return {
      compute: compute
    };
  };
}());
