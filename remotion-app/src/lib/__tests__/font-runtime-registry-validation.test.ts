import {describe, expect, it} from "vitest";

import {
  getEditorialFontPalette,
  getRuntimeFontCssFamily
} from "../cinematic-typography/font-runtime-registry";

describe("font runtime registry validation", () => {
  it("falls back to fontId when familyId is blank or corrupted", () => {
    expect(getRuntimeFontCssFamily({familyId: "", fontId: "font-1"})).toBe("__prometheus_font_unknown_font_1");
    expect(getRuntimeFontCssFamily({familyId: "undefined", fontId: "font-1"})).toBe("__prometheus_font_unknown_font_1");
    expect(getRuntimeFontCssFamily({familyId: "null", fontId: "font-1"})).toBe("__prometheus_font_unknown_font_1");
    expect(getRuntimeFontCssFamily({familyId: "nan", fontId: "font-1"})).toBe("__prometheus_font_unknown_font_1");
  });

  it("avoids collisions when bad familyIds have different fontIds", () => {
    const firstAlias = getRuntimeFontCssFamily({familyId: "undefined", fontId: "font-1"});
    const secondAlias = getRuntimeFontCssFamily({familyId: "undefined", fontId: "font-2"});

    expect(firstAlias).not.toBe(secondAlias);
  });

  it("never emits undefined/null/nan inside runtime palette alias metadata", () => {
    const palette = getEditorialFontPalette("fraunces-editorial");

    expect(palette.runtimeCssFamily.toLowerCase()).not.toContain("undefined");
    expect(palette.runtimeCssFamily.toLowerCase()).not.toContain("null");
    expect(palette.runtimeCssFamily.toLowerCase()).not.toContain("nan");
    expect(palette.runtimeFontStack).toContain(palette.runtimeCssFamily);
  });
});
