"""Publish accepted factor results as website JSON.

    python3 website/tools/publish_factor.py --factor 07
    python3 website/tools/publish_factor.py --all

Reads the accepted run named in each factor's Acceptance Record and calls
scripts/stage4_single_factor/core/reporting.py. Writes only under
website/public/data/, and only when the content changed.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import sys
from pathlib import Path

WEBSITE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = WEBSITE_DIR.parent
DATA_DIR = WEBSITE_DIR / "public" / "data"
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.stage4_single_factor.core import registry  # noqa: E402
from scripts.stage4_single_factor.core import reporting  # noqa: E402

NAME_EN = {
    "07": "Total Assets Displacement-to-Path Ratio",
    "08": "Net Income Upward-Count Ratio",
    "09": "Revenue Upward-Count Ratio",
}
REQUIRED_FILES = ["manifest.json", "benchmark_comparison.csv", "monthly_ic.parquet", "decile_returns.parquet"]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1, sort_keys=False, allow_nan=False) + "\n"


def _write_if_changed(path: Path, text: str) -> bool:
    if path.is_file() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def _resolve(factor_id: str) -> tuple:
    folders = sorted((PROJECT_ROOT / "scripts" / "stage4_single_factor").glob(f"factor_{factor_id}_*"))
    if len(folders) != 1:
        raise SystemExit(f"factor {factor_id}: expected one factor folder, found {len(folders)}")
    folder = folders[0]
    module_prefix = f"scripts.stage4_single_factor.{folder.name}."
    keys = [k for k in registry.list_factors() if registry.get(k)["runner"].startswith(module_prefix)]
    if len(keys) != 1:
        raise SystemExit(f"factor {factor_id}: expected one registry entry for {folder.name}, found {keys}")
    return folder, keys[0], registry.get(keys[0])


def _accepted_run(key: str, entry: dict) -> tuple:
    record_path = PROJECT_ROOT / entry["acceptance_record_path"]
    record = json.loads(record_path.read_text(encoding="utf-8"))
    if record.get("acceptance_status") != "accepted":
        raise SystemExit(f"{key}: Acceptance Record status is {record.get('acceptance_status')!r}")
    runs_root = PROJECT_ROOT / "artifacts" / "factor_runs" / key
    present = [r for r in record["accepted_run_ids"] if (runs_root / r).is_dir()]
    if len(present) != 1:
        raise SystemExit(f"{key}: expected exactly one retained accepted run, found {present}")
    run_dir = runs_root / present[0]
    missing = [f for f in REQUIRED_FILES if not (run_dir / f).is_file()]
    if missing:
        raise SystemExit(f"{key}: accepted run {present[0]} is missing {missing}")
    return run_dir, record, record_path


def publish(factor_id: str) -> dict:
    folder, key, entry = _resolve(factor_id)
    run_dir, record, record_path = _accepted_run(key, entry)
    definition = importlib.import_module(f"scripts.stage4_single_factor.{folder.name}.definition")
    body = reporting.build_factor_report(run_dir, definition, record)

    manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
    recorded = {Path(o["file"]).name: o.get("sha256") for o in manifest["outputs"]}
    source_files = [{"file": name, "sha256": recorded.get(name)} for name in body.pop("source_files") if name != "manifest.json"]

    data_file = f"factors/{folder.name.removeprefix('factor_')}.json"
    meta = {
        "id": factor_id,
        "key": key,
        "name_cn": entry["display_name"],
        "name_en": NAME_EN[factor_id],
        "family": entry["family"],
    }
    report = {
        "schema_version": "1.0",
        "factor": meta,
        "definition": body["definition"],
        "core_performance": body["core_performance"],
        "stability": body["stability"],
        "risk_exposure": body["risk_exposure"],
        "notes": body["notes"],
        "provenance": {
            "source_run_id": run_dir.name,
            "source_manifest_sha256": _sha256(run_dir / "manifest.json"),
            "acceptance_record": str(record_path.relative_to(PROJECT_ROOT)),
            "primary_branch": body["primary_branch"],
            "source_files": source_files,
        },
    }
    written = _write_if_changed(DATA_DIR / data_file, _dumps(report))
    return {**meta, "data_file": data_file, "_written": written}


def update_index(entries: list) -> bool:
    index_path = DATA_DIR / "factors.json"
    current = json.loads(index_path.read_text(encoding="utf-8")) if index_path.is_file() else []
    by_id = {e["id"]: e for e in current}
    for e in entries:
        by_id[e["id"]] = {k: v for k, v in e.items() if not k.startswith("_")}
    return _write_if_changed(index_path, _dumps([by_id[i] for i in sorted(by_id)]))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--factor", choices=sorted(NAME_EN))
    group.add_argument("--all", action="store_true")
    args = parser.parse_args()

    ids = sorted(NAME_EN) if args.all else [args.factor]
    entries = [publish(i) for i in ids]
    index_written = update_index(entries)
    for e in entries:
        print(f"{e['id']} {e['data_file']}: {'written' if e['_written'] else 'unchanged'}")
    print(f"factors.json: {'written' if index_written else 'unchanged'}")


if __name__ == "__main__":
    main()
