#!/usr/bin/env python3
"""Evaluate live-input classification using the real TypeScript classifier.

This script only handles sample loading/filtering from xlsx,
then delegates scoring to scripts/live_input_eval_runner.ts via vite-node.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import openpyxl


def load_samples(path: Path) -> list[dict[str, Any]]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    if ws is None:
        return []

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    header = [str(cell) if cell is not None else "" for cell in rows[0]]
    samples: list[dict[str, Any]] = []
    for row in rows[1:]:
        if not any(cell is not None for cell in row):
            continue
        sample = dict(zip(header, row))
        samples.append(sample)
    return samples


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate live input classifier with gold samples."
    )
    parser.add_argument("--lang", default="all", help="Filter by lang, for example: zh")
    parser.add_argument(
        "--top-errors", type=int, default=15, help="How many errors to show"
    )
    parser.add_argument(
        "--gold-path",
        default=str(
            Path(__file__).resolve().parent.parent.parent
            / "timeshine_gold_samples.xlsx"
        ),
        help="Path to xlsx sample file",
    )
    args = parser.parse_args()

    sample_path = Path(args.gold_path)
    samples = load_samples(sample_path)
    if args.lang != "all":
        samples = [sample for sample in samples if sample.get("lang") == args.lang]

    if not samples:
        print("No samples found for the selected filter.")
        return

    repo_root = Path(__file__).resolve().parent.parent
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", encoding="utf-8", delete=False
    ) as temp_file:
        json.dump(samples, temp_file, ensure_ascii=False)
        temp_file_path = Path(temp_file.name)

    try:
        npx_cmd = "npx.cmd" if sys.platform.startswith("win") else "npx"
        completed = subprocess.run(
            [
                npx_cmd,
                "vite-node",
                "scripts/live_input_eval_runner.ts",
                "--samples-json",
                str(temp_file_path),
                "--top-errors",
                str(args.top_errors),
            ],
            cwd=repo_root,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if completed.stdout:
            print(completed.stdout, end="")
        if completed.returncode != 0 and completed.stderr:
            print(completed.stderr, end="")
            raise SystemExit(completed.returncode)
    finally:
        temp_file_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
