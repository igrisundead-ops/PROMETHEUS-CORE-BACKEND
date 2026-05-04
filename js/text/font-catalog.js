(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  var FONT_FAMILIES = {
    allura: {
      name: "Allura",
      css: "\"Allura\", cursive",
      source: "google",
      styles: ["italic"]
    },
    anton: {
      name: "Anton",
      css: "\"Anton\", \"Bebas Neue\", sans-serif",
      source: "google",
      styles: ["bold"]
    },
    bebasNeue: {
      name: "Bebas Neue",
      css: "\"Bebas Neue\", \"Arial Narrow\", sans-serif",
      source: "google",
      styles: ["bold"]
    },
    bodoniModa: {
      name: "Bodoni Moda",
      css: "\"Bodoni Moda\", \"Cormorant Garamond\", serif",
      source: "google",
      styles: ["serif"]
    },
    cinzel: {
      name: "Cinzel",
      css: "\"Cinzel\", \"Cormorant Garamond\", serif",
      source: "google",
      styles: ["serif"]
    },
    cormorantGaramond: {
      name: "Cormorant Garamond",
      css: "\"Cormorant Garamond\", \"Times New Roman\", serif",
      source: "google",
      styles: ["serif", "italic"]
    },
    greatVibes: {
      name: "Great Vibes",
      css: "\"Great Vibes\", cursive",
      source: "google",
      styles: ["italic"]
    },
    leagueGothic: {
      name: "League Gothic",
      css: "\"League Gothic\", \"Bebas Neue\", sans-serif",
      source: "google",
      styles: ["bold"]
    },
    dmSans: {
      name: "DM Sans",
      css: "\"DM Sans\", \"Segoe UI\", sans-serif",
      source: "google",
      styles: ["sans"]
    },
    oswald: {
      name: "Oswald",
      css: "\"Oswald\", \"League Gothic\", sans-serif",
      source: "google",
      styles: ["bold"]
    },
    teko: {
      name: "Teko",
      css: "\"Teko\", \"Anton\", sans-serif",
      source: "google",
      styles: ["bold"]
    },
    fabringo: {
      name: "Fabringo",
      css: "\"Fabringo\", \"Cinzel\", serif",
      source: "local",
      styles: ["serif"]
    },
    blackerPro: {
      name: "Blacker Pro",
      css: "\"Blacker Pro\", \"Bodoni Moda\", serif",
      source: "local",
      styles: ["serif", "bold"]
    },
    freightPro: {
      name: "Freight Pro",
      css: "\"Freight Pro\", \"Bodoni Moda\", serif",
      source: "local",
      styles: ["serif"]
    },
    aveliaSerif: {
      name: "Avelia Serif",
      css: "\"Avelia Serif\", \"Cinzel\", serif",
      source: "local",
      styles: ["serif"]
    },
    saintMonica: {
      name: "Saint Monica",
      css: "\"Saint Monica\", \"Cormorant Garamond\", serif",
      source: "local",
      styles: ["serif"]
    },
    arialNarrow: {
      name: "Arial Narrow",
      css: "\"Arial Narrow\", Arial, sans-serif",
      source: "system",
      styles: ["sans"]
    },
    segoeUi: {
      name: "Segoe UI",
      css: "\"Segoe UI\", system-ui, sans-serif",
      source: "system",
      styles: ["sans"]
    },
    timesNewRoman: {
      name: "Times New Roman",
      css: "\"Times New Roman\", Times, serif",
      source: "system",
      styles: ["serif"]
    },
    cascadiaCode: {
      name: "Cascadia Code",
      css: "\"Cascadia Code\", Consolas, ui-monospace, monospace",
      source: "system",
      styles: ["mono"]
    }
  };

  var FONT_CATEGORIES = {
    fallback: [
      "DM Sans",
      "Bebas Neue",
      "Oswald",
      "Cinzel",
      "Cormorant Garamond",
      "Freight Pro",
      "Avelia Serif",
      "Saint Monica",
      "Arial Narrow",
      "Segoe UI",
      "Times New Roman"
    ],
    italic: [
      "Allura",
      "Great Vibes",
      "Cormorant Garamond"
    ],
    behindBold: [
      "Anton",
      "Bebas Neue",
      "League Gothic",
      "Oswald",
      "Teko",
      "Blacker Pro"
    ],
    all: Object.keys(FONT_FAMILIES).map(function (key) {
      return FONT_FAMILIES[key].name;
    })
  };

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function familyByName(name) {
    var target = normalizeName(name);
    var keys = Object.keys(FONT_FAMILIES);
    for (var i = 0; i < keys.length; i += 1) {
      var entry = FONT_FAMILIES[keys[i]];
      if (normalizeName(entry.name) === target || normalizeName(keys[i]) === target) {
        return entry;
      }
    }
    return null;
  }

  function listCategory(name) {
    var key = normalizeName(name);
    if (!key || !Object.prototype.hasOwnProperty.call(FONT_CATEGORIES, key)) {
      return [];
    }
    return FONT_CATEGORIES[key].slice(0);
  }

  function resolveFontStack(name, fallbackCategory) {
    var family = familyByName(name);
    if (!family) {
      return "";
    }
    var fallback = listCategory(fallbackCategory || "fallback");
    if (fallback.length === 0) {
      return family.css;
    }
    return family.css + ", " + fallback.join(", ");
  }

  function pickFontFromCategory(category, index) {
    var list = listCategory(category);
    if (list.length === 0) {
      return null;
    }
    if (Number.isInteger(index)) {
      return list[Math.max(0, Math.min(list.length - 1, index))];
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  ns.createFontCatalog = function createFontCatalog() {
    return {
      listCategories: function listCategories() {
        return Object.keys(FONT_CATEGORIES).slice(0);
      },
      listCategory: listCategory,
      listFamilies: function listFamilies() {
        return Object.keys(FONT_FAMILIES).map(function (key) {
          return Object.assign({}, FONT_FAMILIES[key]);
        });
      },
      getFamily: familyByName,
      resolveFontStack: resolveFontStack,
      pickFont: pickFontFromCategory
    };
  };

  ns.getFontCatalog = function getFontCatalog() {
    if (!ns.__fontCatalog) {
      ns.__fontCatalog = ns.createFontCatalog();
    }
    return ns.__fontCatalog;
  };
}());
