"""Select and extract two portrait PNG assets from the provided ZIP archive.

Selection rules:
1. Include only PNG files with aspect ratio < 0.8 (portrait).
2. Sort by area descending, then filename ascending (deterministic).
3. Pick the first two entries.
4. Extract to assets/hero-a.png and assets/hero-b.png.
5. Write assets/manifest.json with metadata.
"""

from __future__ import annotations

import argparse
import json
import struct
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


@dataclass(frozen=True)
class ImageCandidate:
    name: str
    width: int
    height: int

    @property
    def area(self) -> int:
        return self.width * self.height

    @property
    def ratio(self) -> float:
        return self.width / self.height


def read_png_dimensions(archive: zipfile.ZipFile, filename: str) -> tuple[int, int]:
    with archive.open(filename, "r") as file_handle:
        header = file_handle.read(24)

    if len(header) < 24 or header[:8] != PNG_SIGNATURE:
        raise ValueError(f"Entry is not a valid PNG: {filename}")

    width, height = struct.unpack(">II", header[16:24])
    if height == 0:
        raise ValueError(f"Invalid PNG dimensions for {filename}: {width}x{height}")
    return width, height


def selectAssetsFromZip(zip_path: str | Path, output_dir: str | Path) -> dict:
    """Select two portrait PNG files and extract them with deterministic names."""
    zip_file_path = Path(zip_path)
    if not zip_file_path.exists():
        raise FileNotFoundError(f"ZIP file not found: {zip_file_path}")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_file_path, "r") as archive:
        candidates: list[ImageCandidate] = []

        for info in archive.infolist():
            if info.is_dir() or not info.filename.lower().endswith(".png"):
                continue

            try:
                width, height = read_png_dimensions(archive, info.filename)
            except ValueError:
                continue

            candidate = ImageCandidate(name=info.filename, width=width, height=height)
            if candidate.ratio < 0.8:
                candidates.append(candidate)

        candidates.sort(key=lambda item: (-item.area, item.name))

        if len(candidates) < 2:
            raise RuntimeError("Not enough portrait PNG files found in the ZIP archive.")

        selected = candidates[:2]
        slot_names = ["hero-a.png", "hero-b.png"]
        manifest_assets = []

        for index, candidate in enumerate(selected):
            destination = output_path / slot_names[index]
            with archive.open(candidate.name, "r") as source, destination.open("wb") as target:
                target.write(source.read())

            manifest_assets.append(
                {
                    "slot": f"hero-{chr(ord('a') + index)}",
                    "output_file": slot_names[index],
                    "source_name": candidate.name,
                    "width": candidate.width,
                    "height": candidate.height,
                    "area": candidate.area,
                    "ratio": round(candidate.ratio, 6),
                }
            )

    manifest = {
        "zip_path": str(zip_file_path.resolve()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "selection_rules": {
            "file_extension": ".png",
            "ratio_rule": "width/height < 0.8",
            "sort_order": "area desc, filename asc",
            "selection_count": 2,
        },
        "assets": manifest_assets,
    }

    manifest_path = output_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Extract deterministic portrait assets from ZIP.")
    parser.add_argument(
        "--zip",
        dest="zip_path",
        default=r"C:\Users\HomePC\Downloads\PROME - images_no_bg_HQ.zip",
        help="Path to source ZIP archive.",
    )
    parser.add_argument(
        "--output",
        dest="output_dir",
        default="assets",
        help="Output directory for extracted assets and manifest.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    manifest = selectAssetsFromZip(args.zip_path, args.output_dir)

    print("Asset extraction complete.")
    for asset in manifest["assets"]:
        print(
            f"- {asset['slot']} -> {asset['output_file']} | "
            f"{asset['source_name']} ({asset['width']}x{asset['height']})"
        )
    print(f"- manifest -> {Path(args.output_dir).resolve() / 'manifest.json'}")


if __name__ == "__main__":
    main()
