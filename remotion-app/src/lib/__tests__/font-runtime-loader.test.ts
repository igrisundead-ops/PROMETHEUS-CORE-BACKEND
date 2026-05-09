import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const remotionMocks = vi.hoisted(() => ({
  continueRender: vi.fn(),
  delayRender: vi.fn((label: string) => `handle:${label}`),
  staticFile: vi.fn((path: string) => `/static/${path}`)
}));

const testState = vi.hoisted(() => ({
  editorialPalettes: [] as Array<{id: string; primaryFamilyName: string}>,
  houseDefinitions: [] as Array<{
    id: string;
    family: string;
    sources: Array<{
      path: string;
      format: "otf" | "ttf" | "woff" | "woff2";
      weight: number;
      style: "normal" | "italic";
    }>;
  }>
}));

vi.mock("remotion", () => remotionMocks);
vi.mock("../cinematic-typography/font-runtime-registry", () => ({
  EDITORIAL_FONT_PALETTES: testState.editorialPalettes
}));
vi.mock("../cinematic-typography/house-font-registry", () => ({
  getActiveHouseFontDefinitions: () => testState.houseDefinitions
}));

type MockDocument = {
  fonts: {
    add: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
  };
  createElement: ReturnType<typeof vi.fn>;
  getElementById: ReturnType<typeof vi.fn>;
  head: {
    appendChild: ReturnType<typeof vi.fn>;
  };
};

const createMockDocument = (): MockDocument => ({
  fonts: {
    add: vi.fn(),
    load: vi.fn(() => Promise.resolve([]))
  },
  createElement: vi.fn(() => ({
    dataset: {},
    id: "",
    textContent: ""
  })),
  getElementById: vi.fn(() => null),
  head: {
    appendChild: vi.fn()
  }
});

describe("house font loader synchronization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
    testState.editorialPalettes.length = 0;
    testState.houseDefinitions.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses delayRender and continueRender while waiting for editorial font readiness", async () => {
    testState.editorialPalettes.push({
      id: "fraunces-editorial",
      primaryFamilyName: "Fraunces"
    });

    const mockDocument = createMockDocument();
    vi.stubGlobal("document", mockDocument);

    const {primeHouseTypographyFonts} = await import("../cinematic-typography/house-font-loader");
    await primeHouseTypographyFonts();

    expect(remotionMocks.delayRender).toHaveBeenCalledTimes(1);
    expect(remotionMocks.continueRender).toHaveBeenCalledTimes(1);
    expect(mockDocument.fonts.load).toHaveBeenCalledWith("1em \"Fraunces\"");
  });

  it("times out safely and still releases the Remotion render handle", async () => {
    vi.useFakeTimers();
    testState.editorialPalettes.push({
      id: "fraunces-editorial",
      primaryFamilyName: "Fraunces"
    });

    const mockDocument = createMockDocument();
    mockDocument.fonts.load.mockReturnValue(new Promise(() => undefined));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("document", mockDocument);

    const {primeHouseTypographyFonts} = await import("../cinematic-typography/house-font-loader");
    const loadPromise = primeHouseTypographyFonts();

    await vi.advanceTimersByTimeAsync(3005);
    await loadPromise;

    expect(remotionMocks.delayRender).toHaveBeenCalledTimes(1);
    expect(remotionMocks.continueRender).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it("reuses the in-flight promise so repeated calls do not create duplicate delayRender handles", async () => {
    testState.editorialPalettes.push({
      id: "fraunces-editorial",
      primaryFamilyName: "Fraunces"
    });

    let resolveLoad!: () => void;
    const mockDocument = createMockDocument();
    mockDocument.fonts.load.mockReturnValue(new Promise<void>((resolve) => {
      resolveLoad = resolve;
    }));
    vi.stubGlobal("document", mockDocument);

    const {primeHouseTypographyFonts} = await import("../cinematic-typography/house-font-loader");
    const firstLoad = primeHouseTypographyFonts();
    const secondLoad = primeHouseTypographyFonts();

    expect(remotionMocks.delayRender).toHaveBeenCalledTimes(1);

    resolveLoad();
    await Promise.all([firstLoad, secondLoad]);

    expect(remotionMocks.continueRender).toHaveBeenCalledTimes(1);
  });

  it("falls back to stylesheet injection when FontFace is unavailable for house fonts", async () => {
    testState.houseDefinitions.push({
      id: "louize",
      family: "Louize",
      sources: [{
        path: "fonts/house/louize/Louize-Regular.otf",
        format: "otf",
        weight: 400,
        style: "normal"
      }]
    });

    const mockDocument = createMockDocument();
    vi.stubGlobal("document", mockDocument);
    // @ts-expect-error exercising the non-FontFace fallback path
    delete globalThis.FontFace;

    const {primeHouseTypographyFonts} = await import("../cinematic-typography/house-font-loader");
    await primeHouseTypographyFonts();

    expect(remotionMocks.delayRender).not.toHaveBeenCalled();
    expect(remotionMocks.continueRender).not.toHaveBeenCalled();
    expect(mockDocument.head.appendChild).toHaveBeenCalledTimes(1);
  });
});
