(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  function createToState(ctx, overrides, easeToken) {
    var baseState = Object.assign(
      {
        x: 0,
        y: 0,
        opacity: 1,
        rotation: 0,
        scale: 1,
        filter: "blur(0px)"
      },
      ctx.object.to || {}
    );

    var merged = Object.assign(baseState, overrides || {});
    merged.easeToken = easeToken;
    return merged;
  }

  ns.createMotionPresets = function createMotionPresets(easingRegistry, offscreenResolver) {
    if (!easingRegistry || !offscreenResolver) {
      throw new Error("Preset creation requires easing registry and offscreen resolver.");
    }

    return {
      softSlideLeft: {
        easeToken: "cinema.smoothCurve",
        defaults: { duration: 1.45 },
        from: function from(ctx) {
          var offset = offscreenResolver.compute(ctx.object.fromRule || "left", ctx.el, ctx.object.layer);
          return {
            x: offset.x,
            y: offset.y * 0.18,
            opacity: 0,
            rotation: -5.5,
            scale: 0.95,
            filter: "blur(10px)"
          };
        },
        to: function to(ctx) {
          return createToState(ctx, { rotation: 0, scale: 1, filter: "blur(0px)" }, "cinema.smoothCurve");
        }
      },

      softSlideRight: {
        easeToken: "cinema.snapCurve",
        defaults: { duration: 1.3 },
        from: function from(ctx) {
          var offset = offscreenResolver.compute(ctx.object.fromRule || "right", ctx.el, ctx.object.layer);
          return {
            x: offset.x,
            y: offset.y * 0.15,
            opacity: 0,
            rotation: 4.5,
            scale: 0.96,
            filter: "blur(9px)"
          };
        },
        to: function to(ctx) {
          return createToState(ctx, { rotation: 0, scale: 1, filter: "blur(0px)" }, "cinema.snapCurve");
        }
      },

      arcRise: {
        easeToken: "cinema.arcCurve",
        defaults: { duration: 1.5 },
        from: function from(ctx) {
          var offset = offscreenResolver.compute(ctx.object.fromRule || "bottom", ctx.el, ctx.object.layer);
          var arcX = ctx.index % 2 === 0 ? -145 : 145;
          return {
            x: offset.x + arcX,
            y: offset.y,
            opacity: 0,
            rotation: ctx.index % 2 === 0 ? -3.5 : 3.5,
            scale: 0.92,
            filter: "blur(12px)"
          };
        },
        to: function to(ctx) {
          return createToState(ctx, { rotation: 0, scale: 1.02, filter: "blur(0px)" }, "cinema.arcCurve");
        }
      },

      dropSettle: {
        easeToken: "ease.backOut",
        defaults: { duration: 1.2 },
        from: function from(ctx) {
          var offset = offscreenResolver.compute(ctx.object.fromRule || "top", ctx.el, ctx.object.layer);
          return {
            x: offset.x,
            y: offset.y,
            opacity: 0,
            rotation: 1.4,
            scale: 1.08,
            filter: "blur(7px)"
          };
        },
        to: function to(ctx) {
          return createToState(ctx, { rotation: 0, scale: 1, filter: "blur(0px)" }, "ease.backOut");
        }
      },

      whipIn: {
        easeToken: "cinema.whipCurve",
        defaults: { duration: 0.94 },
        from: function from(ctx) {
          var offset = offscreenResolver.compute(ctx.object.fromRule || "right", ctx.el, ctx.object.layer);
          return {
            x: offset.x * 1.08,
            y: offset.y,
            opacity: 0,
            rotation: 7,
            scale: 0.9,
            filter: "blur(15px)"
          };
        },
        to: function to(ctx) {
          return createToState(ctx, { rotation: 0, scale: 1, filter: "blur(0px)" }, "cinema.whipCurve");
        }
      },

      parallaxCross: {
        easeToken: "cinema.parallaxCurve",
        defaults: { duration: 1.65 },
        from: function from(ctx) {
          var derivedRule = ctx.object.layer === "foreground" ? "left" : "right";
          var sourceRule = ctx.object.fromRule || derivedRule;
          var offset = offscreenResolver.compute(sourceRule, ctx.el, ctx.object.layer);
          var direction = offset.x >= 0 ? 1 : -1;
          return {
            x: offset.x,
            y: offset.y * 0.16,
            opacity: 0,
            rotation: -3 * direction,
            scale: 0.93,
            filter: "blur(11px)"
          };
        },
        to: function to(ctx) {
          return createToState(ctx, { rotation: 0, scale: 1.01, filter: "blur(0px)" }, "cinema.parallaxCurve");
        }
      }
    };
  };
}());
