(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  function normalizeInput(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function splitGraphemes(text) {
    var input = String(text || "");
    if (!input) {
      return [];
    }

    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      var segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
      return Array.from(segmenter.segment(input), function (segment) {
        return segment.segment;
      });
    }

    return Array.from(input);
  }

  function tokenizeWords(value) {
    var normalized = normalizeInput(value);
    if (!normalized) {
      return [];
    }
    return normalized.split(" ");
  }

  function clearElement(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function buildCharSpans(el, text, options) {
    var config = Object.assign(
      {
        charClassName: "text-char",
        innerClassName: "text-char-inner"
      },
      options || {}
    );

    clearElement(el);

    var chars = splitGraphemes(text);
    var charElements = [];

    chars.forEach(function (character) {
      var charSpan = document.createElement("span");
      var innerSpan = document.createElement("span");

      charSpan.className = config.charClassName;
      innerSpan.className = config.innerClassName;
      innerSpan.textContent = character;
      charSpan.appendChild(innerSpan);

      el.appendChild(charSpan);
      charElements.push(charSpan);
    });

    return {
      chars: charElements,
      graphemes: chars
    };
  }

  function setWholeText(el, text, className) {
    clearElement(el);
    var whole = document.createElement("span");
    whole.className = className || "text-whole";
    whole.textContent = String(text || "");
    el.appendChild(whole);
    return whole;
  }

  ns.createTextSplitter = function createTextSplitter() {
    return {
      normalizeInput: normalizeInput,
      tokenizeWords: tokenizeWords,
      splitGraphemes: splitGraphemes,
      buildCharSpans: buildCharSpans,
      setWholeText: setWholeText
    };
  };
}());
