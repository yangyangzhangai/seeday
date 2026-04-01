"""
Plant image post-processor for Tshine.
Usage:
    python scripts/process_plant_image.py <source_image> <root_type> <variant_index> <nameCN> <nameEN> <nameIT>

Example:
    python scripts/process_plant_image.py ~/Desktop/raw/clematis.png bra 2 铁线莲 Clematis Clematide

What it does:
1. Crops the horizontal image into left (early) and right (late) halves
2. Resizes each to 450x450
3. Saves as {rootType}_early_{variantIndex:04d}.png and {rootType}_late_{variantIndex:04d}.png
4. Moves to public/assets/plants/
5. Appends rows to docs/plant_assets_registry.csv
"""

import sys
import os
from PIL import Image

def main():
    if len(sys.argv) < 7:
        print("Usage: python process_plant_image.py <source> <rootType> <variantIndex> <nameCN> <nameEN> <nameIT>")
        sys.exit(1)

    source = sys.argv[1]
    root_type = sys.argv[2]
    variant_index = int(sys.argv[3])
    name_cn = sys.argv[4]
    name_en = sys.argv[5]
    name_it = sys.argv[6]

    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    plants_dir = os.path.join(project_root, "public", "assets", "plants")
    csv_path = os.path.join(project_root, "docs", "plant_assets_registry.csv")

    # Open and crop
    img = Image.open(source)
    w, h = img.size
    mid = w // 2

    # Horizontal: left=full bloom(late), right=buds(early)
    left = img.crop((0, 0, mid, h)).resize((450, 450), Image.LANCZOS)
    right = img.crop((mid, 0, w, h)).resize((450, 450), Image.LANCZOS)

    # File names
    idx = f"{variant_index:04d}"
    early_name = f"{root_type}_early_{idx}.png"
    late_name = f"{root_type}_late_{idx}.png"

    early_path = os.path.join(plants_dir, early_name)
    late_path = os.path.join(plants_dir, late_name)

    # Save: left=late(full bloom), right=early(buds)
    left.save(late_path, "PNG")
    right.save(early_path, "PNG")
    print(f"Saved: {early_path}")
    print(f"Saved: {late_path}")

    # Update CSV
    early_id = f"{root_type}_early_{idx}"
    late_id = f"{root_type}_late_{idx}"

    lines = []
    for plant_id, fname, stage in [
        (early_id, early_name, "early"),
        (late_id, late_name, "late"),
    ]:
        lines.append(
            f"{plant_id},{root_type},{stage},{variant_index},,{fname},png,TRUE,{name_cn},{name_en},{name_it},live"
        )

    with open(csv_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove trailing empty lines, append new rows
    content = content.rstrip("\n") + "\n"
    for line in lines:
        content += line + "\n"

    with open(csv_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"CSV updated: {csv_path}")
    print("Done!")


if __name__ == "__main__":
    main()
