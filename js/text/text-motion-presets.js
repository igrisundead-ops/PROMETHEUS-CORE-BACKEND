(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  function resolveTiming(profile, fallback) {
    var timing = profile && profile.timing ? profile.timing : {};
    return {
      inDuration: Number(timing.inDuration) || fallback.inDuration,
      outDuration: Number(timing.outDuration) || fallback.outDuration,
      stagger: Number(timing.stagger) || fallback.stagger,
      hold: Number(timing.hold) || fallback.hold
    };
  }

  ns.createTextMotionPresets = function createTextMotionPresets() {
    return {
      agentic_split_rise: {
        split: "chars",
        easeInToken: "cinema.smoothCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.92,
            outDuration: 0.62,
            stagger: 0.028,
            hold: 1.58
          });
          return {
            target: "chars",
            from: { y: 72, opacity: 0, filter: "blur(10px)", skewY: 8 },
            to: { y: 0, opacity: 1, filter: "blur(0px)", skewY: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.92,
            outDuration: 0.62,
            stagger: 0.02,
            hold: 1.58
          });
          return {
            target: "chars",
            to: { y: -24, opacity: 0, filter: "blur(6px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.02, timing.stagger), from: "end" }
          };
        }
      },

      interesting_blur_lift: {
        split: "chars",
        easeInToken: "cinema.arcCurve",
        easeOutToken: "cinema.gentle",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.02,
            outDuration: 0.68,
            stagger: 0.032,
            hold: 1.62
          });
          return {
            target: "chars",
            from: { y: 40, opacity: 0, filter: "blur(14px)" },
            keyframes: [
              { y: 6, opacity: 0.55, filter: "blur(5px)", duration: timing.inDuration * 0.58 },
              { y: 0, opacity: 1, filter: "blur(0px)", duration: timing.inDuration * 0.42 }
            ],
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.02,
            outDuration: 0.68,
            stagger: 0.02,
            hold: 1.62
          });
          return {
            target: "chars",
            to: { y: 18, opacity: 0, filter: "blur(9px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.02, timing.stagger), from: "start" }
          };
        }
      },

      cinematic_focus_lock: {
        split: "whole",
        easeInToken: "cinema.gentle",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.0,
            outDuration: 0.72,
            stagger: 0,
            hold: 1.7
          });
          return {
            target: "whole",
            from: { scale: 0.93, opacity: 0, filter: "blur(9px)" },
            to: { scale: 1, opacity: 1, filter: "blur(0px)" },
            duration: timing.inDuration
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.0,
            outDuration: 0.72,
            stagger: 0,
            hold: 1.7
          });
          return {
            target: "whole",
            to: { scale: 1.02, opacity: 0, filter: "blur(6px)" },
            duration: timing.outDuration
          };
        },
        focusFrame: {
          in: { duration: 0.42, easeToken: "cinema.smoothCurve", opacity: 1, scale: 1 },
          out: { duration: 0.26, easeToken: "ease.expoOut", opacity: 0, scale: 1.04 }
        }
      },

      generic_single_word: {
        split: "whole",
        easeInToken: "cinema.smoothCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.88,
            outDuration: 0.56,
            stagger: 0,
            hold: 1.4
          });
          return {
            target: "whole",
            from: { y: 30, opacity: 0, filter: "blur(8px)" },
            to: { y: 0, opacity: 1, filter: "blur(0px)" },
            duration: timing.inDuration
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.88,
            outDuration: 0.56,
            stagger: 0,
            hold: 1.4
          });
          return {
            target: "whole",
            to: { y: -10, opacity: 0, filter: "blur(5px)" },
            duration: timing.outDuration
          };
        }
      },

      two_word_cinematic_pair: {
        split: "parts",
        easeInToken: "cinema.smoothCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.04,
            outDuration: 0.66,
            stagger: 0.09,
            hold: 1.65
          });
          return {
            target: "parts",
            from: { y: 42, opacity: 0, filter: "blur(10px)", scale: 0.92 },
            eachFrom: [
              { x: -54, rotation: -2.4 },
              { x: 54, rotation: 2.4 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.04,
            outDuration: 0.66,
            stagger: 0.04,
            hold: 1.65
          });
          return {
            target: "parts",
            to: { y: -18, opacity: 0, filter: "blur(6px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.04, timing.stagger), from: "end" }
          };
        }
      },

      two_word_stagger_punch: {
        split: "parts",
        easeInToken: "cinema.whipCurve",
        easeOutToken: "cinema.gentle",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.94,
            outDuration: 0.62,
            stagger: 0.08,
            hold: 1.45
          });
          return {
            target: "parts",
            from: { y: 28, opacity: 0, filter: "blur(9px)", scale: 0.9 },
            eachFrom: [
              { x: -74, rotation: -4.8 },
              { x: 74, rotation: 4.8 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.94,
            outDuration: 0.62,
            stagger: 0.04,
            hold: 1.45
          });
          return {
            target: "parts",
            to: { y: 12, opacity: 0, filter: "blur(7px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.04, timing.stagger), from: "start" }
          };
        }
      },

      two_word_arc_sweep: {
        split: "parts",
        easeInToken: "cinema.arcCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.06,
            outDuration: 0.64,
            stagger: 0.1,
            hold: 1.68
          });
          return {
            target: "parts",
            from: { y: 36, opacity: 0, filter: "blur(11px)", scale: 0.91 },
            eachFrom: [
              { x: -96, rotation: -7.8 },
              { x: 96, rotation: 7.8 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.06,
            outDuration: 0.64,
            stagger: 0.04,
            hold: 1.68
          });
          return {
            target: "parts",
            to: { y: -14, opacity: 0, filter: "blur(7px)", scale: 1.03 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.04, timing.stagger), from: "center" }
          };
        }
      },

      two_word_dual_rise: {
        split: "parts",
        easeInToken: "cinema.smoothCurve",
        easeOutToken: "cinema.gentle",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.62,
            stagger: 0.085,
            hold: 1.58
          });
          return {
            target: "parts",
            from: { y: 58, opacity: 0, filter: "blur(10px)", scale: 0.88 },
            eachFrom: [
              { x: -44, rotation: -3.2 },
              { x: 44, rotation: 3.2 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.62,
            stagger: 0.04,
            hold: 1.58
          });
          return {
            target: "parts",
            to: { y: 18, opacity: 0, filter: "blur(8px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.04, timing.stagger), from: "end" }
          };
        }
      },

      two_word_focus_pivot: {
        split: "parts",
        easeInToken: "cinema.gentle",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.0,
            outDuration: 0.7,
            stagger: 0.09,
            hold: 1.7
          });
          return {
            target: "parts",
            from: { y: 24, opacity: 0, filter: "blur(9px)", scale: 0.9 },
            eachFrom: [
              { x: -56, rotation: -6.5 },
              { x: 56, rotation: 6.5 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.0,
            outDuration: 0.7,
            stagger: 0.04,
            hold: 1.7
          });
          return {
            target: "parts",
            to: { y: -12, opacity: 0, filter: "blur(6px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.04, timing.stagger), from: "start" }
          };
        },
        focusFrame: {
          in: { duration: 0.38, easeToken: "cinema.smoothCurve", opacity: 1, scale: 1 },
          out: { duration: 0.24, easeToken: "ease.expoOut", opacity: 0, scale: 1.05 }
        }
      },

      three_word_serif_orbit: {
        split: "parts",
        easeInToken: "cinema.arcCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.08,
            outDuration: 0.68,
            stagger: 0.086,
            hold: 1.72
          });
          return {
            target: "parts",
            from: { y: 42, opacity: 0, filter: "blur(11px)", scale: 0.9 },
            eachFrom: [
              { x: -92, rotation: -5.4 },
              { x: 0, y: 74, rotation: 0, scale: 0.82 },
              { x: 92, rotation: 5.4 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.08,
            outDuration: 0.68,
            stagger: 0.045,
            hold: 1.72
          });
          return {
            target: "parts",
            to: { y: -18, opacity: 0, filter: "blur(7px)", scale: 1.02 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.045, timing.stagger), from: "center" }
          };
        }
      },

      three_word_tall_blade: {
        split: "parts",
        easeInToken: "cinema.whipCurve",
        easeOutToken: "cinema.gentle",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.96,
            outDuration: 0.62,
            stagger: 0.076,
            hold: 1.56
          });
          return {
            target: "parts",
            from: { y: 34, opacity: 0, filter: "blur(9px)", scale: 0.88 },
            eachFrom: [
              { x: -84, rotation: -7.6 },
              { x: 0, y: 62, rotation: 0, scale: 0.76 },
              { x: 84, rotation: 7.6 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.96,
            outDuration: 0.62,
            stagger: 0.038,
            hold: 1.56
          });
          return {
            target: "parts",
            to: { y: 14, opacity: 0, filter: "blur(8px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.038, timing.stagger), from: "end" }
          };
        }
      },

      three_word_script_glide: {
        split: "parts",
        easeInToken: "cinema.gentle",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.02,
            outDuration: 0.66,
            stagger: 0.082,
            hold: 1.66
          });
          return {
            target: "parts",
            from: { y: 30, opacity: 0, filter: "blur(10px)", scale: 0.91 },
            eachFrom: [
              { x: -64, rotation: -3.8 },
              { x: 0, y: 46, rotation: -1.4, scale: 0.84 },
              { x: 64, rotation: 3.8 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.02,
            outDuration: 0.66,
            stagger: 0.04,
            hold: 1.66
          });
          return {
            target: "parts",
            to: { y: -12, opacity: 0, filter: "blur(6px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.04, timing.stagger), from: "center" }
          };
        }
      },

      three_word_ref_lockup: {
        split: "parts",
        easeInToken: "cinema.gentle",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.94,
            outDuration: 0.58,
            stagger: 0.054,
            hold: 1.5
          });
          return {
            target: "parts",
            from: { y: 18, opacity: 0, filter: "blur(8px)", scale: 0.94 },
            eachFrom: [
              { x: -28 },
              { x: 0, y: 24, scale: 0.9 },
              { x: 28 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.94,
            outDuration: 0.58,
            stagger: 0.03,
            hold: 1.5
          });
          return {
            target: "parts",
            to: { y: -10, opacity: 0, filter: "blur(5px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "center" }
          };
        }
      },

      three_word_ref_last_punch: {
        split: "parts",
        easeInToken: "cinema.smoothCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.6,
            stagger: 0.064,
            hold: 1.54
          });
          return {
            target: "parts",
            from: { y: 22, opacity: 0, filter: "blur(8px)", scale: 0.92 },
            eachFrom: [
              { y: -16, scale: 0.88 },
              { y: 26, scale: 0.95 }
            ],
            to: { y: 0, opacity: 1, filter: "blur(0px)", scale: 1 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.6,
            stagger: 0.03,
            hold: 1.54
          });
          return {
            target: "parts",
            to: { y: -8, opacity: 0, filter: "blur(5px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "end" }
          };
        }
      },

      three_word_ref_through_column: {
        split: "parts",
        easeInToken: "cinema.whipCurve",
        easeOutToken: "cinema.gentle",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.92,
            outDuration: 0.56,
            stagger: 0.056,
            hold: 1.46
          });
          return {
            target: "parts",
            from: { x: -52, opacity: 0, filter: "blur(8px)" },
            eachFrom: [
              { y: -10 },
              { y: 0 },
              { y: 12 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)" },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.92,
            outDuration: 0.56,
            stagger: 0.028,
            hold: 1.46
          });
          return {
            target: "parts",
            to: { x: -24, opacity: 0, filter: "blur(6px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.028, timing.stagger), from: "start" }
          };
        }
      },

      three_word_ref_script_tag: {
        split: "parts",
        easeInToken: "cinema.gentle",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.0,
            outDuration: 0.62,
            stagger: 0.062,
            hold: 1.58
          });
          return {
            target: "parts",
            from: { y: 20, opacity: 0, filter: "blur(8px)" },
            eachFrom: [
              { x: -32, rotation: -5 },
              { x: 16, y: 14, rotation: 1.5 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.0,
            outDuration: 0.62,
            stagger: 0.03,
            hold: 1.58
          });
          return {
            target: "parts",
            to: { y: -10, opacity: 0, filter: "blur(6px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "center" }
          };
        }
      },

      three_word_ref_dream_big_now_v1: {
        split: "parts",
        easeInToken: "cinema.smoothCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.96,
            outDuration: 0.58,
            stagger: 0.054,
            hold: 1.54
          });
          return {
            target: "parts",
            from: { opacity: 0, filter: "blur(6px)", scale: 0.97 },
            to: { opacity: 1, filter: "blur(0px)", scale: 1 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.96,
            outDuration: 0.58,
            stagger: 0.03,
            hold: 1.54
          });
          return {
            target: "parts",
            to: { opacity: 0, filter: "blur(6px)", scale: 1.01 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "center" }
          };
        }
      },

      three_word_ref_your_master_mind_v1: {
        split: "parts",
        easeInToken: "cinema.gentle",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.6,
            stagger: 0.058,
            hold: 1.58
          });
          return {
            target: "parts",
            from: { opacity: 0, filter: "blur(6px)", scale: 0.97 },
            to: { opacity: 1, filter: "blur(0px)", scale: 1 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.6,
            stagger: 0.03,
            hold: 1.58
          });
          return {
            target: "parts",
            to: { opacity: 0, filter: "blur(6px)", scale: 1.01 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "center" }
          };
        }
      },

      three_word_ref_take_action_now_v1: {
        split: "parts",
        easeInToken: "cinema.whipCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.96,
            outDuration: 0.58,
            stagger: 0.055,
            hold: 1.52
          });
          return {
            target: "parts",
            from: { opacity: 0, filter: "blur(6px)", scale: 0.97 },
            to: { opacity: 1, filter: "blur(0px)", scale: 1 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.96,
            outDuration: 0.58,
            stagger: 0.03,
            hold: 1.52
          });
          return {
            target: "parts",
            to: { opacity: 0, filter: "blur(6px)", scale: 1.01 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "center" }
          };
        }
      },

      three_word_ref_build_legacy_your_v1: {
        split: "parts",
        easeInToken: "cinema.smoothCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.6,
            stagger: 0.057,
            hold: 1.56
          });
          return {
            target: "parts",
            from: { opacity: 0, filter: "blur(6px)", scale: 0.97 },
            to: { opacity: 1, filter: "blur(0px)", scale: 1 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.6,
            stagger: 0.03,
            hold: 1.56
          });
          return {
            target: "parts",
            to: { opacity: 0, filter: "blur(6px)", scale: 1.01 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "center" }
          };
        }
      },

      four_word_banner_drift: {
        split: "parts",
        easeInToken: "cinema.gentle",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.0,
            outDuration: 0.6,
            stagger: 0.052,
            hold: 1.64
          });
          return {
            target: "parts",
            from: { opacity: 0, filter: "blur(6px)", scale: 0.985 },
            eachFrom: [
              { x: -8, y: 8, rotation: -0.9 },
              { x: 0, y: 11, rotation: 0 },
              { x: 8, y: 8, rotation: 0.9 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.0,
            outDuration: 0.6,
            stagger: 0.03,
            hold: 1.64
          });
          return {
            target: "parts",
            to: { opacity: 0, y: -4, filter: "blur(6px)", scale: 1.005 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "center" }
          };
        }
      },

      four_word_split_stagger: {
        split: "parts",
        easeInToken: "cinema.arcCurve",
        easeOutToken: "cinema.gentle",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.58,
            stagger: 0.054,
            hold: 1.58
          });
          return {
            target: "parts",
            from: { opacity: 0, filter: "blur(7px)", scale: 0.985 },
            eachFrom: [
              { x: -10, y: 10, rotation: -0.8 },
              { x: 0, y: 13, rotation: 0 },
              { x: 10, y: 10, rotation: 0.8 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.58,
            stagger: 0.03,
            hold: 1.58
          });
          return {
            target: "parts",
            to: { opacity: 0, y: 4, filter: "blur(6px)", scale: 1.004 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "end" }
          };
        }
      },

      four_word_serif_pivot: {
        split: "parts",
        easeInToken: "cinema.smoothCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.02,
            outDuration: 0.62,
            stagger: 0.05,
            hold: 1.68
          });
          return {
            target: "parts",
            from: { opacity: 0, filter: "blur(7px)", scale: 0.985 },
            eachFrom: [
              { x: -7, y: 9, rotation: -0.9 },
              { x: 0, y: 12, rotation: 0 },
              { x: 7, y: 9, rotation: 0.9 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.02,
            outDuration: 0.62,
            stagger: 0.03,
            hold: 1.68
          });
          return {
            target: "parts",
            to: { opacity: 0, y: -4, filter: "blur(6px)", scale: 1.005 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "center" }
          };
        }
      },

      four_word_outline_whip: {
        split: "parts",
        easeInToken: "cinema.whipCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.94,
            outDuration: 0.56,
            stagger: 0.05,
            hold: 1.54
          });
          return {
            target: "parts",
            from: { opacity: 0, filter: "blur(6px)", scale: 0.985 },
            eachFrom: [
              { x: -12, y: 8, rotation: -1.1 },
              { x: 0, y: 11, rotation: 0 },
              { x: 12, y: 8, rotation: 1.1 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.94,
            outDuration: 0.56,
            stagger: 0.03,
            hold: 1.54
          });
          return {
            target: "parts",
            to: { opacity: 0, y: 4, filter: "blur(6px)", scale: 1.004 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "start" }
          };
        }
      },

      six_word_quad_duo_depth: {
        split: "parts",
        easeInToken: "cinema.smoothCurve",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.04,
            outDuration: 0.62,
            stagger: 0.056,
            hold: 1.74
          });
          return {
            target: "parts",
            from: { opacity: 0, filter: "blur(7px)", scale: 0.985 },
            eachFrom: [
              { y: 8, rotation: -0.5 },
              { x: -6, y: 11, rotation: -0.7 },
              { x: 6, y: 11, rotation: 0.7 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 1.04,
            outDuration: 0.62,
            stagger: 0.03,
            hold: 1.74
          });
          return {
            target: "parts",
            to: { opacity: 0, y: -4, filter: "blur(6px)", scale: 1.005 },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "center" }
          };
        }
      },

      two_word_script_caption_lock: {
        split: "parts",
        easeInToken: "cinema.gentle",
        easeOutToken: "ease.expoOut",
        in: function inMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.6,
            stagger: 0.075,
            hold: 1.66
          });
          return {
            target: "parts",
            from: { opacity: 0, filter: "blur(7px)", scale: 0.95 },
            eachFrom: [
              { x: -18, y: 10, rotation: -4.2 },
              { x: 22, y: 18, rotation: 1.8 }
            ],
            to: { x: 0, y: 0, opacity: 1, filter: "blur(0px)", scale: 1, rotation: 0 },
            duration: timing.inDuration,
            stagger: timing.stagger
          };
        },
        out: function outMotion(ctx) {
          var timing = resolveTiming(ctx.profile, {
            inDuration: 0.98,
            outDuration: 0.6,
            stagger: 0.03,
            hold: 1.66
          });
          return {
            target: "parts",
            to: { opacity: 0, y: -8, filter: "blur(6px)" },
            duration: timing.outDuration,
            stagger: { each: Math.min(0.03, timing.stagger), from: "end" }
          };
        }
      }
    };
  };
}());
