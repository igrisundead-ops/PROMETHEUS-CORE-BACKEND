import { describe, expect, it } from "vitest";
import { getCaptionContainerStyle, upperSafeZone } from "../caption-layout";
describe("caption placement", () => {
    it("matches locked legacy stage placement geometry", () => {
        const style = getCaptionContainerStyle(upperSafeZone);
        const top = Number(style.top.replace("%", ""));
        const left = Number(style.left.replace("%", ""));
        const width = Number(style.width.replace("%", ""));
        const height = Number(style.height.replace("%", ""));
        expect(top).toBe(24);
        expect(left).toBe(8);
        expect(width).toBe(84);
        expect(height).toBe(34);
    });
});
