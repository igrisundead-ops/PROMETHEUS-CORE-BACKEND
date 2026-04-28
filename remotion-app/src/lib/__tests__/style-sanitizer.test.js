import { describe, expect, it } from "vitest";
import { resolvePartTypographyStyle } from "../../components/CinematicCaptionOverlay";
import { sanitizeTypographyPresetForSeries } from "../style-sanitizer";
import { typographyPresets } from "../presets/typography-presets";
describe("style sanitizer", () => {
    it("removes split-size contrast from presets while keeping uppercase baseline", () => {
        const sanitized = sanitizeTypographyPresetForSeries(typographyPresets.duo_clean_punch);
        expect(sanitized.textTransform).toBe("uppercase");
        expect(sanitized.twoA?.sizeMult).toBe(1);
        expect(sanitized.twoB?.sizeMult).toBe(1);
    });
    it("keeps uppercase-unsafe script fonts out of the rendered two-word pair and widens the gap", () => {
        const resolved = resolvePartTypographyStyle({ fontFamily: "\"Great Vibes\", cursive" }, "secondary", true);
        const sanitized = sanitizeTypographyPresetForSeries(typographyPresets.duo_script_block);
        expect(resolved.fontFamily).toBe("\"Cormorant Garamond\", \"Times New Roman\", serif");
        expect(sanitized.twoA?.fontFamily).toBe("\"Cormorant Garamond\", \"Times New Roman\", serif");
        expect(typographyPresets.duo_script_block.twoLayoutGap).toBe("0.24em");
    });
});
