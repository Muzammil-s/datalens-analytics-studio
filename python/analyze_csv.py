"""DataLens Analytics Studio — Optional Python CLI companion for automated CSV profiling & cleaning."""

import argparse
import csv
import json
import math
from pathlib import Path
import statistics


def analyze_csv_file(path: Path) -> dict:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        headers = reader.fieldnames or []

    seen = set()
    dupes = 0
    for r in rows:
        sig = tuple((r.get(h) or "").strip() for h in headers)
        if sig in seen:
            dupes += 1
        seen.add(sig)

    columns = []
    for h in headers:
        vals = [(r.get(h) or "").strip() for r in rows]
        non_null = [v for v in vals if v.lower() not in ("", "null", "na", "n/a", "nan", "none")]
        nums = []
        for v in non_null:
            try:
                nums.append(float(v.replace(",", "")))
            except ValueError:
                pass
        is_num = len(non_null) > 0 and (len(nums) / len(non_null)) >= 0.85
        col_info = {
            "column": h,
            "type": "numeric" if is_num else "categorical",
            "missing": len(rows) - len(non_null),
            "unique": len(set(non_null)),
        }
        if is_num and nums:
            col_info.update({
                "mean": round(statistics.mean(nums), 3),
                "median": round(statistics.median(nums), 3),
                "std": round(statistics.pstdev(nums), 3) if len(nums) > 1 else 0.0,
                "min": min(nums),
                "max": max(nums),
            })
        columns.append(col_info)

    return {
        "file": path.name,
        "rows": len(rows),
        "columns_count": len(headers),
        "duplicate_rows": dupes,
        "columns": columns,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="DataLens Python CSV Profiler")
    parser.add_argument("csv_file", help="Path to CSV file")
    parser.add_argument("--out", help="Optional path to save JSON profile")
    args = parser.parse_args()

    report = analyze_csv_file(Path(args.csv_file))
    text = json.dumps(report, indent=2)
    print(text)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
