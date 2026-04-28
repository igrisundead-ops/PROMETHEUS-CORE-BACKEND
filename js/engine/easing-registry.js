(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};
  var cachedRegistry = null;

  ns.createEasingRegistry = function createEasingRegistry() {
    if (cachedRegistry) {
      return cachedRegistry;
    }

    if (!window.gsap) {
      throw new Error("GSAP is required before creating the easing registry.");
    }

    if (!window.CustomEase) {
      throw new Error("GSAP CustomEase plugin is required before creating the easing registry.");
    }

    gsap.registerPlugin(CustomEase);

    CustomEase.create("cinema.smoothCurve", "0.22,1,0.36,1");
    CustomEase.create("cinema.snapCurve", "0.16,1,0.3,1");
    CustomEase.create("cinema.whipCurve", "0.12,0.86,0.24,1");
    CustomEase.create("cinema.arcCurve", "0.2,0.82,0.18,1");
    CustomEase.create("cinema.dropCurve", "0.18,0.89,0.24,1");
    CustomEase.create("cinema.parallaxCurve", "0.2,0.9,0.25,1");
    CustomEase.create("cinema.gentle", "0.34,0.01,0.1,1");

    var easingTokens = {
      "ease.powerOut": "power4.out",
      "ease.expoOut": "expo.out",
      "ease.sineInOut": "sine.inOut",
      "ease.backOut": "back.out(1.45)",
      "cinema.smoothCurve": "cinema.smoothCurve",
      "cinema.snapCurve": "cinema.snapCurve",
      "cinema.whipCurve": "cinema.whipCurve",
      "cinema.arcCurve": "cinema.arcCurve",
      "cinema.dropCurve": "cinema.dropCurve",
      "cinema.parallaxCurve": "cinema.parallaxCurve",
      "cinema.gentle": "cinema.gentle"
    };

    cachedRegistry = {
      resolve: function resolve(token) {
        return easingTokens[token] || token || "power3.out";
      },
      list: function list() {
        return Object.keys(easingTokens);
      },
      has: function has(token) {
        return Object.prototype.hasOwnProperty.call(easingTokens, token);
      }
    };

    return cachedRegistry;
  };
}());
