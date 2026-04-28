(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeWordValue(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function ensureTemplateWords(input, splitter) {
    if (Array.isArray(input)) {
      return input
        .map(normalizeWordValue)
        .filter(Boolean)
        .reduce(function (acc, item) {
          return acc.concat(splitter.tokenizeWords(item));
        }, []);
    }

    return splitter.tokenizeWords(input);
  }

  function ensureWordEntries(input) {
    if (Array.isArray(input)) {
      return input.map(normalizeWordValue).filter(Boolean);
    }
    var normalized = normalizeWordValue(input);
    return normalized ? [normalized] : [];
  }

  function defaultChunkWords(words) {
    var source = words.slice(0);
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

  ns.createTextTemplateEngine = function createTextTemplateEngine(options) {
    var settings = Object.assign(
      {
        defaultOverlapSeconds: 0.14
      },
      options || {}
    );

    var splitter = ns.createTextSplitter();
    var motionPresetMap = new Map();
    var typographyPresetMap = new Map();
    var wordCountTemplateMap = new Map();

    function registerTextMotionPreset(name, presetDef) {
      if (!name || typeof presetDef !== "object") {
        throw new Error("registerTextMotionPreset(name, presetDef) requires valid values.");
      }
      motionPresetMap.set(name, presetDef);
      return api;
    }

    function registerTypographyPreset(name, presetDef) {
      if (!name || typeof presetDef !== "object") {
        throw new Error("registerTypographyPreset(name, presetDef) requires valid values.");
      }
      typographyPresetMap.set(name, presetDef);
      return api;
    }

    function registerWordCountTemplate(count, templateDef) {
      var normalizedCount = Number(count);
      if (!Number.isInteger(normalizedCount) || normalizedCount <= 0 || typeof templateDef !== "object") {
        throw new Error("registerWordCountTemplate(count, templateDef) requires a positive integer and object.");
      }
      wordCountTemplateMap.set(normalizedCount, templateDef);
      return api;
    }

    function resolveTemplate(wordsInput) {
      var words = ensureTemplateWords(wordsInput, splitter);
      var count = words.length;
      var overlapSeconds = toNumber(settings.defaultOverlapSeconds, 0.14);

      if (count <= 0) {
        return {
          mode: "empty",
          count: 0,
          words: [],
          layoutUnits: [],
          sequenceSpec: {
            overlapSeconds: overlapSeconds,
            units: []
          }
        };
      }

      if (count <= 7 && wordCountTemplateMap.has(count)) {
        var exactTemplate = wordCountTemplateMap.get(count);
        var exactUnits = exactTemplate.compose(words, { count: count });
        var exactPlan = exactTemplate.animationPlan(exactUnits, { count: count });
        return {
          mode: "exact",
          count: count,
          words: words,
          templateId: count + "-word",
          layoutUnits: exactUnits,
          sequenceSpec: exactPlan
        };
      }

      var chunkWords = typeof ns.chunkWordsForComposition === "function" ? ns.chunkWordsForComposition : defaultChunkWords;
      var chunks = chunkWords(words);
      var chunkSpecs = [];
      var allUnits = [];
      var currentAt = 0;

      chunks.forEach(function (chunk, chunkIndex) {
        var template = wordCountTemplateMap.get(chunk.length) || wordCountTemplateMap.get(1);
        var units = template.compose(chunk, {
          count: chunk.length,
          chunkIndex: chunkIndex
        });
        var plan = template.animationPlan(units, {
          count: chunk.length,
          chunkIndex: chunkIndex
        });

        var estimatedDuration = Math.max(0.6, units.length * 0.46 + 0.4);
        chunkSpecs.push({
          chunkIndex: chunkIndex,
          words: chunk,
          templateId: chunk.length + "-word",
          at: Number(currentAt.toFixed(3)),
          estimatedDuration: Number(estimatedDuration.toFixed(3)),
          units: units
        });

        currentAt += Math.max(0.25, estimatedDuration - overlapSeconds);
        allUnits = allUnits.concat(units);
      });

      return {
        mode: "composed",
        count: count,
        words: words,
        chunks: chunkSpecs,
        layoutUnits: allUnits,
        sequenceSpec: {
          templateId: "composed-8plus",
          overlapSeconds: overlapSeconds,
          chunks: chunkSpecs
        }
      };
    }

    function buildTextObjects(config) {
      var input = config || {};
      var resolved = resolveTemplate(input.words || input.word || "");

      return [
        {
          id: input.id || "text-compartment",
          selector: input.selector || "#textCompartment",
          layer: input.layer || "accent",
          fromRule: input.fromRule || "top",
          preset: input.preset || "dropSettle",
          to: Object.assign(
            {
              x: 0,
              y: 0,
              opacity: 1,
              scale: 1
            },
            input.to || {}
          ),
          timing: Object.assign(
            {
              at: 0.72,
              duration: 1.02,
              delay: 0
            },
            input.timing || {}
          ),
          meta: {
            resolvedTemplate: resolved
          }
        }
      ];
    }

    function createWordCycle(config) {
      var input = config || {};
      var state = {
        words: ensureWordEntries(input.words || []),
        index: 0,
        intervalMs: Math.max(600, Math.round(toNumber(input.intervalMs, 3200))),
        autoRotate: input.autoRotate !== false,
        timerId: null
      };

      var onTick = typeof input.onTick === "function" ? input.onTick : function () {};

      function clearTimer() {
        if (state.timerId) {
          clearTimeout(state.timerId);
          state.timerId = null;
        }
      }

      function schedule(delayMs) {
        clearTimer();
        if (!state.autoRotate || state.words.length <= 1) {
          return;
        }

        state.timerId = setTimeout(function () {
          cycle.next({ reason: "auto" });
        }, Math.max(120, Math.round(delayMs)));
      }

      function emit(reason, previousWord) {
        var currentWord = cycle.getCurrentWord();
        if (!currentWord) {
          return;
        }

        onTick({
          reason: reason || "manual",
          index: state.index,
          word: currentWord,
          previousWord: previousWord || null,
          words: state.words.slice(0),
          intervalMs: state.intervalMs
        });
      }

      var cycle = {
        start: function start() {
          schedule(state.intervalMs);
          return cycle;
        },
        stop: function stop() {
          clearTimer();
          return cycle;
        },
        destroy: function destroy() {
          clearTimer();
          state.words = [];
          state.index = 0;
          return cycle;
        },
        next: function next(options) {
          if (state.words.length === 0) {
            return cycle;
          }

          var previousWord = cycle.getCurrentWord();
          state.index = (state.index + 1) % state.words.length;
          emit(options && options.reason ? options.reason : "manual", previousWord);
          schedule(state.intervalMs);
          return cycle;
        },
        jumpToWord: function jumpToWord(word, options) {
          var normalized = normalizeWordValue(word);
          if (!normalized) {
            return false;
          }

          var idx = state.words.findIndex(function (item) {
            return item.toLowerCase() === normalized.toLowerCase();
          });
          if (idx < 0) {
            return false;
          }

          var previousWord = cycle.getCurrentWord();
          state.index = idx;
          if (!options || options.emit !== false) {
            emit(options && options.reason ? options.reason : "manual", previousWord);
          }
          schedule(state.intervalMs);
          return true;
        },
        setWords: function setWords(words, options) {
          var nextWords = ensureWordEntries(words || []);
          if (nextWords.length === 0) {
            return cycle;
          }

          var currentWord = cycle.getCurrentWord();
          state.words = nextWords;

          var preserve = !options || options.preserveCurrent !== false;
          if (preserve && currentWord) {
            var found = state.words.findIndex(function (item) {
              return item.toLowerCase() === currentWord.toLowerCase();
            });
            state.index = found >= 0 ? found : 0;
          } else {
            state.index = 0;
          }
          schedule(state.intervalMs);
          return cycle;
        },
        setIntervalMs: function setIntervalMs(value) {
          state.intervalMs = Math.max(600, Math.round(toNumber(value, state.intervalMs)));
          schedule(state.intervalMs);
          return cycle;
        },
        getIntervalMs: function getIntervalMs() {
          return state.intervalMs;
        },
        setAutoRotate: function setAutoRotate(enabled) {
          state.autoRotate = Boolean(enabled);
          if (state.autoRotate) {
            schedule(state.intervalMs);
          } else {
            clearTimer();
          }
          return cycle;
        },
        isAutoRotate: function isAutoRotate() {
          return state.autoRotate;
        },
        pauseOneBeat: function pauseOneBeat() {
          schedule(state.intervalMs);
          return cycle;
        },
        getCurrentWord: function getCurrentWord() {
          return state.words[state.index] || null;
        },
        getWords: function getWords() {
          return state.words.slice(0);
        },
        getIndex: function getIndex() {
          return state.index;
        },
        emitCurrent: function emitCurrent(reason) {
          emit(reason || "manual", null);
          return cycle;
        }
      };

      if (state.words.length > 0 && input.emitOnCreate) {
        cycle.emitCurrent("init");
      }

      return cycle;
    }

    function getTextMotionPreset(name) {
      return motionPresetMap.get(name) || null;
    }

    function getTypographyPreset(name) {
      return typographyPresetMap.get(name) || null;
    }

    function getWordCountTemplate(count) {
      return wordCountTemplateMap.get(Number(count)) || null;
    }

    function listTextMotionPresets() {
      return Array.from(motionPresetMap.keys());
    }

    function listTypographyPresets() {
      return Array.from(typographyPresetMap.keys());
    }

    function listWordCountTemplates() {
      return Array.from(wordCountTemplateMap.keys()).sort(function (a, b) {
        return a - b;
      });
    }

    var api = {
      registerTextMotionPreset: registerTextMotionPreset,
      registerTypographyPreset: registerTypographyPreset,
      registerWordCountTemplate: registerWordCountTemplate,
      resolveTemplate: resolveTemplate,
      buildTextObjects: buildTextObjects,
      createWordCycle: createWordCycle,
      getTextMotionPreset: getTextMotionPreset,
      getTypographyPreset: getTypographyPreset,
      getWordCountTemplate: getWordCountTemplate,
      listTextMotionPresets: listTextMotionPresets,
      listTypographyPresets: listTypographyPresets,
      listWordCountTemplates: listWordCountTemplates,
      splitter: splitter
    };

    return api;
  };
}());
