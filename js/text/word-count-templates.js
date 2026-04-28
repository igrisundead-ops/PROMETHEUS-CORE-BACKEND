(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  function cloneWords(words) {
    return words.slice(0);
  }

  function joinWords(words) {
    return words.join(" ");
  }

  function createSingleUnit(words, meta) {
    return [
      {
        text: joinWords(words),
        words: cloneWords(words),
        line: 0,
        meta: meta || {}
      }
    ];
  }

  function buildScaffoldPlan(units, count) {
    return {
      templateId: count + "-word",
      overlapSeconds: 0.14,
      units: units.map(function (unit, index) {
        return {
          index: index,
          text: unit.text,
          at: index * 0.16
        };
      })
    };
  }

  function splitToLines(words, linePattern) {
    var lines = [];
    var cursor = 0;
    linePattern.forEach(function (size) {
      if (cursor >= words.length) {
        return;
      }
      lines.push(words.slice(cursor, cursor + size));
      cursor += size;
    });
    if (cursor < words.length) {
      lines.push(words.slice(cursor));
    }
    return lines;
  }

  function createLineUnits(lines, meta) {
    return lines.map(function (lineWords, index) {
      return {
        text: joinWords(lineWords),
        words: cloneWords(lineWords),
        line: index,
        meta: meta || {}
      };
    });
  }

  function chunkWordsForComposition(words) {
    var source = cloneWords(words);
    var chunks = [];

    while (source.length > 0) {
      var remaining = source.length;
      if (remaining <= 4) {
        chunks.push(source.splice(0, remaining));
        break;
      }

      var take = 4;
      if (remaining - take === 1) {
        take = 3;
      }
      chunks.push(source.splice(0, take));
    }

    if (chunks.length >= 2) {
      var lastChunk = chunks[chunks.length - 1];
      var previousChunk = chunks[chunks.length - 2];
      if (lastChunk.length === 1 && previousChunk.length === 4) {
        lastChunk.unshift(previousChunk.pop());
      }
    }

    return chunks;
  }

  ns.createWordCountTemplates = function createWordCountTemplates() {
    return {
      1: {
        count: 1,
        compose: function compose(words) {
          return createSingleUnit(words, { type: "hero-word" });
        },
        animationPlan: function animationPlan(units) {
          return buildScaffoldPlan(units, 1);
        }
      },
      2: {
        count: 2,
        compose: function compose(words) {
          var lines = splitToLines(words, [2]);
          return createLineUnits(lines, { type: "scaffold-two" });
        },
        animationPlan: function animationPlan(units) {
          return buildScaffoldPlan(units, 2);
        }
      },
      3: {
        count: 3,
        compose: function compose(words) {
          var lines = splitToLines(words, [3]);
          return createLineUnits(lines, { type: "triple-punch", punchPosition: "middle", intensity: "medium" });
        },
        animationPlan: function animationPlan(units) {
          return buildScaffoldPlan(units, 3);
        }
      },
      4: {
        count: 4,
        compose: function compose(words) {
          var lines = splitToLines(words, [2, 2]);
          return createLineUnits(lines, { type: "quad-hero" });
        },
        animationPlan: function animationPlan(units) {
          return buildScaffoldPlan(units, 4);
        }
      },
      5: {
        count: 5,
        compose: function compose(words) {
          var lines = splitToLines(words, [3, 2]);
          return createLineUnits(lines, { type: "scaffold-five" });
        },
        animationPlan: function animationPlan(units) {
          return buildScaffoldPlan(units, 5);
        }
      },
      6: {
        count: 6,
        compose: function compose(words) {
          var lines = splitToLines(words, [4, 2]);
          return createLineUnits(lines, { type: "quad-duo-depth" });
        },
        animationPlan: function animationPlan(units) {
          return buildScaffoldPlan(units, 6);
        }
      },
      7: {
        count: 7,
        compose: function compose(words) {
          var lines = splitToLines(words, [4, 3]);
          return createLineUnits(lines, { type: "scaffold-seven" });
        },
        animationPlan: function animationPlan(units) {
          return buildScaffoldPlan(units, 7);
        }
      }
    };
  };

  ns.chunkWordsForComposition = chunkWordsForComposition;
}());
