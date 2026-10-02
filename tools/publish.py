"""Publish frozen research results as website JSON.

    python3 website/tools/publish.py factor --id 01
    python3 website/tools/publish.py factor --ids 01 02 03
    python3 website/tools/publish.py benchmark --id csi300
    python3 website/tools/publish.py all

Factors: reads the accepted run named in each Acceptance Record and calls
scripts/stage4_single_factor/core/reporting.py. Benchmarks: copies the shared
processed series unchanged. Never downloads data, runs factors or writes
outside website/public/data/. Unchanged files are not rewritten.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import math
import shutil
import sys
from pathlib import Path

WEBSITE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = WEBSITE_DIR.parent
DATA_DIR = WEBSITE_DIR / "public" / "data"
SINGLE_FACTOR_DIR = DATA_DIR / "single_factor"
SHARED_BENCHMARK_DIR = DATA_DIR / "shared" / "benchmarks"
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.stage4_single_factor.core import registry  # noqa: E402
from scripts.stage4_single_factor.core import reporting  # noqa: E402

# Catalog classification, as specified in website/ARCHITECTURE.md §4–5.
FACTORS = {
    "01": {"name_en": "Revenue YoY Growth (Single Quarter)", "research_theme": "traditional_growth", "source_type": "paper_core"},
    "02": {"name_en": "Revenue YoY Growth (TTM)", "research_theme": "traditional_growth", "source_type": "paper_core"},
    "03": {"name_en": "Net Income YoY Growth (Single Quarter)", "research_theme": "traditional_growth", "source_type": "paper_core"},
    "04": {"name_en": "Net Income YoY Growth (TTM)", "research_theme": "traditional_growth", "source_type": "paper_core"},
    "05": {"name_en": "Net Income Displacement-to-Path Ratio", "research_theme": "growth_path", "source_type": "paper_core"},
    "06": {"name_en": "Revenue Displacement-to-Path Ratio", "research_theme": "growth_path", "source_type": "paper_core"},
    "07": {"name_en": "Total Assets Displacement-to-Path Ratio", "research_theme": "growth_path", "source_type": "paper_core"},
    "08": {"name_en": "Net Income Upward-Count Ratio", "research_theme": "growth_path", "source_type": "paper_core"},
    "09": {"name_en": "Revenue Upward-Count Ratio", "research_theme": "growth_path", "source_type": "paper_core"},
    "10": {"name_en": "Total Assets Upward-Count Ratio", "research_theme": "growth_path", "source_type": "paper_core"},
    "11": {"name_en": "Net Income Path Fit", "research_theme": "growth_path", "source_type": "paper_core"},
    "12": {"name_en": "Revenue Path Fit", "research_theme": "growth_path", "source_type": "paper_core"},
    "13": {"name_en": "Total Assets Path Fit", "research_theme": "growth_path", "source_type": "paper_core"},
    # Factor 14-19 share one code family; the catalog separates raw and Rank versions.
    "14": {"name_en": "Net Income Growth Acceleration (TTM)", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "growth_acceleration"},
    "15": {"name_en": "Revenue Growth Acceleration (TTM)", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "growth_acceleration"},
    "16": {"name_en": "Total Assets Growth Acceleration", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "growth_acceleration"},
    "17": {"name_en": "Net Income Rank Growth Acceleration (TTM)", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "rank_growth_acceleration"},
    "18": {"name_en": "Revenue Rank Growth Acceleration (TTM)", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "rank_growth_acceleration"},
    "19": {"name_en": "Total Assets Rank Growth Acceleration", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "rank_growth_acceleration"},
    "20": {"name_en": "Net Income YoY Growth Time-Series Percentile", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "time_series_quantile"},
    "21": {"name_en": "Revenue YoY Growth Time-Series Percentile", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "time_series_quantile"},
    "22": {"name_en": "Total Assets YoY Growth Time-Series Percentile", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "time_series_quantile"},
    "23": {"name_en": "Net Income YoY Growth Time-Series Regression Coefficient", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "time_series_regression_coefficient"},
    "24": {"name_en": "Revenue YoY Growth Time-Series Regression Coefficient", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "time_series_regression_coefficient"},
    "25": {"name_en": "Total Assets YoY Growth Time-Series Regression Coefficient", "research_theme": "growth_momentum", "source_type": "paper_core", "method_family": "time_series_regression_coefficient"},
}
METHOD_FAMILY = {
    "growth_rate": "growth_rate",
    "growth_path": "displacement_path_ratio",
    "upward_count_ratio": "upward_count_ratio",
    "path_fit": "path_fit",
}
CATALOG_BASIS = {"single_quarter": "single_quarter", "ttm": "TTM", "stock": "balance_sheet_stock"}
BENCHMARKS = {"csi300": "csi300_monthly_open_to_open.json"}
REQUIRED_RUN_FILES = ["manifest.json", "benchmark_comparison.csv", "monthly_ic.parquet", "decile_returns.parquet"]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1, allow_nan=False) + "\n"


def _write_if_changed(path: Path, text: str) -> bool:
    if path.is_file() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


# ------------------------------------------------------------------ factors
def _resolve(factor_id: str) -> tuple:
    folders = sorted((PROJECT_ROOT / "scripts" / "stage4_single_factor").glob(f"factor_{factor_id}_*"))
    if len(folders) != 1:
        raise SystemExit(f"factor {factor_id}: expected one factor folder, found {len(folders)}")
    prefix = f"scripts.stage4_single_factor.{folders[0].name}."
    keys = [k for k in registry.list_factors() if registry.get(k)["runner"].startswith(prefix)]
    if len(keys) != 1:
        raise SystemExit(f"factor {factor_id}: expected one registry entry for {folders[0].name}, found {keys}")
    return folders[0], keys[0], registry.get(keys[0])


def _accepted_run(key: str, entry: dict) -> tuple:
    record_path = PROJECT_ROOT / entry.get("acceptance_record_path", f"artifacts/factor_acceptance/{key}/ACCEPTANCE_RECORD.json")
    record = json.loads(record_path.read_text(encoding="utf-8"))
    if record.get("acceptance_status") != "accepted":
        raise SystemExit(f"{key}: Acceptance Record status is {record.get('acceptance_status')!r}")
    runs_root = PROJECT_ROOT / "artifacts" / "factor_runs" / key
    present = [r for r in record["accepted_run_ids"] if (runs_root / r).is_dir()]
    if len(present) != 1:
        raise SystemExit(f"{key}: expected exactly one retained accepted run, found {present}")
    run_dir = runs_root / present[0]
    missing = [f for f in REQUIRED_RUN_FILES if not (run_dir / f).is_file()]
    if missing:
        raise SystemExit(f"{key}: accepted run {present[0]} is missing {missing}")
    return run_dir, record, record_path


def publish_factor(factor_id: str) -> tuple:
    if factor_id not in FACTORS:
        raise SystemExit(f"factor {factor_id} is not in the website catalog")
    folder, key, entry = _resolve(factor_id)
    run_dir, record, record_path = _accepted_run(key, entry)
    definition = importlib.import_module(f"scripts.stage4_single_factor.{folder.name}.definition")
    body = reporting.build_factor_report(run_dir, definition, record, entry)

    source_files = verified_source_files(run_dir, body.pop("source_files"))

    data_file = f"factors/{folder.name.removeprefix('factor_')}.json"
    meta = FACTORS[factor_id]
    report = {
        "schema_version": "1.0",
        "factor": {"id": factor_id, "key": key, "name_cn": entry["display_name"], "name_en": meta["name_en"], "family": entry["family"]},
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
    written = _write_if_changed(SINGLE_FACTOR_DIR / data_file, _dumps(report))
    catalog_entry = {
        "id": factor_id,
        "key": key,
        "name_cn": entry["display_name"],
        "name_en": meta["name_en"],
        "research_theme": meta["research_theme"],
        "method_family": meta.get("method_family") or METHOD_FAMILY[entry["family"]],
        "source_type": meta["source_type"],
        "accounting_basis": CATALOG_BASIS[reporting.accounting_kind(entry)],
        "published": True,
        "data_file": data_file,
    }
    return catalog_entry, written


def recorded_sources(manifest: dict) -> dict:
    """file name -> (path, recorded sha256), from the run's own outputs and
    from the shared Stage 4 inputs it references."""
    entries = list(manifest["outputs"]) + list((manifest.get("shared_stage4_inputs") or {}).get("outputs", []))
    return {Path(o["file"]).name: (PROJECT_ROOT / o["file"], o.get("sha256")) for o in entries}


def verified_source_files(run_dir: Path, names: list) -> list:
    recorded = recorded_sources(json.loads((run_dir / "manifest.json").read_text(encoding="utf-8")))
    out = []
    for name in names:
        if name == "manifest.json":
            continue
        path, sha = recorded.get(name, (None, None))
        if not sha:
            raise SystemExit(f"{run_dir.name}: no recorded sha256 for source file {name}")
        if _sha256(path) != sha:
            raise SystemExit(f"{run_dir.name}: {name} on disk does not match its recorded sha256")
        out.append({"file": name, "sha256": sha})
    return out


def update_catalog(entries: list) -> bool:
    path = SINGLE_FACTOR_DIR / "catalog.json"
    current = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else []
    by_id = {e["id"]: e for e in current}
    by_id.update({e["id"]: e for e in entries})
    return _write_if_changed(path, _dumps([by_id[i] for i in sorted(by_id)]))


# --------------------------------------------------------------- benchmarks
def check_benchmark(payload: dict) -> None:
    if payload.get("schema_version") != "1.0":
        raise ValueError(f"unsupported schema_version {payload.get('schema_version')!r}")
    for key in ("id", "name_cn", "index_code", "return_basis", "start_date", "end_date"):
        if not payload["benchmark"].get(key):
            raise ValueError(f"benchmark.{key} is missing")
    series = payload["series"]
    if not series:
        raise ValueError("series is empty")
    nav, previous_end = 1.0, None
    for row in series:
        start, end, r, n = row["period_start"], row["period_end"], row["monthly_return"], row["nav"]
        if not start < end or (previous_end is not None and start != previous_end):
            raise ValueError(f"interval {start}..{end} is out of order or not contiguous")
        previous_end = end
        if r is None or n is None or not (math.isfinite(r) and math.isfinite(n)) or r <= -1 or n <= 0:
            raise ValueError(f"{start}: missing or invalid monthly_return/nav")
        nav *= 1.0 + r
        if abs(n - nav) > 1e-9 * max(1.0, nav):
            raise ValueError(f"{start}: nav {n} does not equal the compounded returns {nav}")
    if (series[0]["period_start"], series[-1]["period_end"]) != (payload["benchmark"]["start_date"], payload["benchmark"]["end_date"]):
        raise ValueError("benchmark start_date/end_date do not match the series")


def publish_benchmark(benchmark_id: str) -> bool:
    if benchmark_id not in BENCHMARKS:
        raise SystemExit(f"unknown benchmark {benchmark_id!r}")
    name = BENCHMARKS[benchmark_id]
    source = PROJECT_ROOT / "data" / "processed" / "benchmarks" / name
    target = SHARED_BENCHMARK_DIR / name
    check_benchmark(json.loads(source.read_text(encoding="utf-8")))
    if target.is_file() and _sha256(target) == _sha256(source):
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    if _sha256(target) != _sha256(source):
        raise RuntimeError(f"{target} does not match {source}")
    return True


# ---------------------------------------------------------------------- CLI
def _report(label: str, written: bool) -> None:
    print(f"{label}: {'written' if written else 'unchanged'}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish frozen research results as website JSON.")
    sub = parser.add_subparsers(dest="command", required=True)
    factor = sub.add_parser("factor")
    ids = factor.add_mutually_exclusive_group(required=True)
    ids.add_argument("--id", choices=sorted(FACTORS))
    ids.add_argument("--ids", nargs="+", choices=sorted(FACTORS))
    bench = sub.add_parser("benchmark")
    bench.add_argument("--id", required=True, choices=sorted(BENCHMARKS))
    sub.add_parser("all")
    args = parser.parse_args()

    factor_ids, benchmark_ids = [], []
    if args.command == "factor":
        factor_ids = [args.id] if args.id else sorted(set(args.ids))
    elif args.command == "benchmark":
        benchmark_ids = [args.id]
    else:
        factor_ids, benchmark_ids = sorted(FACTORS), sorted(BENCHMARKS)

    entries = []
    for fid in factor_ids:
        entry, written = publish_factor(fid)
        entries.append(entry)
        _report(f"single_factor/{entry['data_file']}", written)
    if entries:
        _report("single_factor/catalog.json", update_catalog(entries))
    for bid in benchmark_ids:
        _report(f"shared/benchmarks/{BENCHMARKS[bid]}", publish_benchmark(bid))


if __name__ == "__main__":
    main()
