import json
import sys
from pathlib import Path
from typing import Any


NAME_IDS = {
    "copyright": 0,
    "family": 1,
    "subfamily": 2,
    "full": 4,
    "version": 5,
    "postscript": 6,
    "license_description": 13,
    "license_url": 14,
}

UNICODE_RANGES = [
    ("Basic Latin", 0x0000, 0x007F),
    ("Latin-1 Supplement", 0x0080, 0x00FF),
    ("Latin Extended-A", 0x0100, 0x017F),
    ("Latin Extended-B", 0x0180, 0x024F),
    ("IPA Extensions", 0x0250, 0x02AF),
    ("Spacing Modifier Letters", 0x02B0, 0x02FF),
    ("Greek and Coptic", 0x0370, 0x03FF),
    ("Cyrillic", 0x0400, 0x04FF),
    ("General Punctuation", 0x2000, 0x206F),
    ("Currency Symbols", 0x20A0, 0x20CF),
]


def safe_name(font: Any, name_id: int) -> str | None:
    try:
        name = font["name"].getName(name_id, 3, 1, 0x409) or font["name"].getName(name_id, 1, 0, 0)
        if name is None:
            return None
        return str(name)
    except Exception:
        return None


def infer_unicode_ranges(font: Any) -> list[str]:
    ranges: set[str] = set()
    try:
      cmap = font.getBestCmap() or {}
      codepoints = cmap.keys()
      for label, start, end in UNICODE_RANGES:
          if any(start <= codepoint <= end for codepoint in codepoints):
              ranges.add(label)
    except Exception:
      return []
    return sorted(ranges)


def variation_axes(font: Any) -> list[dict[str, Any]]:
    try:
        if "fvar" not in font:
            return []
        axes = []
        for axis in font["fvar"].axes:
            axes.append(
                {
                    "tag": axis.axisTag,
                    "min": float(axis.minValue),
                    "default": float(axis.defaultValue),
                    "max": float(axis.maxValue),
                    "name": getattr(axis, "axisNameID", None),
                }
            )
        return axes
    except Exception:
        return []


def extract_font_metadata(file_path: str) -> dict[str, Any]:
    warnings: list[str] = []
    errors: list[str] = []
    try:
        from fontTools.ttLib import TTFont
    except Exception as error:
        return {
            "file_path": file_path,
            "status": "fallback",
            "warnings": [],
            "errors": [f"fontTools import failed: {error}"],
        }

    try:
        font = TTFont(file_path, lazy=True)
    except Exception as error:
        return {
            "file_path": file_path,
            "status": "fallback",
            "warnings": warnings,
            "errors": [f"Failed to read font: {error}"],
        }

    try:
        os2 = font["OS/2"] if "OS/2" in font else None
        head = font["head"] if "head" in font else None
        post = font["post"] if "post" in font else None
        hhea = font["hhea"] if "hhea" in font else None
        glyph_order = font.getGlyphOrder() if hasattr(font, "getGlyphOrder") else []
        italic = None
        if head is not None and hasattr(head, "macStyle"):
            italic = bool(head.macStyle & 0b10)
        if italic is None and post is not None and getattr(post, "italicAngle", 0) != 0:
            italic = True

        licenses = []
        for name_key in ("copyright", "license_description", "license_url", "version"):
            value = safe_name(font, NAME_IDS[name_key])
            if value:
                licenses.append(value)

        observed = {
            "familyName": safe_name(font, NAME_IDS["family"]),
            "subfamilyName": safe_name(font, NAME_IDS["subfamily"]),
            "fullName": safe_name(font, NAME_IDS["full"]),
            "postscriptName": safe_name(font, NAME_IDS["postscript"]),
            "weightClass": int(getattr(os2, "usWeightClass", 0) or 0) or None,
            "widthClass": int(getattr(os2, "usWidthClass", 0) or 0) or None,
            "italic": italic,
            "glyphCount": len(glyph_order) if glyph_order else None,
            "unicodeRanges": infer_unicode_ranges(font),
            "ascent": int(getattr(hhea, "ascent", 0) or 0) or None,
            "descent": int(getattr(hhea, "descent", 0) or 0) or None,
            "capHeight": int(getattr(os2, "sCapHeight", 0) or 0) or None,
            "xHeight": int(getattr(os2, "sxHeight", 0) or 0) or None,
            "licenseTexts": licenses,
            "variationAxes": variation_axes(font),
        }
        if observed["familyName"] is None and observed["fullName"] is None:
            warnings.append("Font name table did not expose family/full names.")
        return {
            "file_path": file_path,
            "status": "ok",
            "warnings": warnings,
            "errors": errors,
            "observed": observed,
        }
    except Exception as error:
        return {
            "file_path": file_path,
            "status": "fallback",
            "warnings": warnings,
            "errors": [f"Metadata extraction failed: {error}"],
        }


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        font_paths = payload.get("font_paths", [])
    except Exception as error:
        sys.stderr.write(f"Invalid metadata input payload: {error}\n")
        return 1

    results = [extract_font_metadata(str(Path(file_path))) for file_path in font_paths]
    sys.stdout.write(json.dumps(results))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
