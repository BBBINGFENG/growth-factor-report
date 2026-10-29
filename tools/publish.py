"""Publish frozen research results as website JSON.

    python3 website/tools/publish.py factor --id 01
    python3 website/tools/publish.py factor --ids 01 02 03
    python3 website/tools/publish.py benchmark --id csi300
    python3 website/tools/publish.py all
    python3 website/tools/publish.py composite
    python3 website/tools/publish.py relationships --run artifacts/factor_relationships/<run_id>
    python3 website/tools/publish.py check --run artifacts/factor_relationships/<run_id>   # release gate
        (also gates live_composite against the paper-trading run named in its index.json, or --live-run)

`composite`, `relationships` and `check` run website/tools/release_check.py and exit non-zero when a
check fails, so a failed verification stops the publish.

Factors: reads the accepted run named in each Acceptance Record and calls
scripts/stage4_single_factor/core/reporting.py. Benchmarks: copies the shared
processed series unchanged. Composites: D01 and C01-C13 from the current
result interface and frozen runs via scripts/stage6_composite_factors/
website_export.py (not part of `all`). Never downloads data, runs factors or writes
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
COMPOSITE_DIR = DATA_DIR / "composite_backtest"
RELATIONSHIPS_DIR = DATA_DIR / "factor_relationships"
LIVE_DIR = DATA_DIR / "live_composite"
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.stage4_single_factor.core import accepted_runs as AR  # noqa: E402
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
    "26": {"name_en": "Regression-Predicted Net Income Growth", "research_theme": "forward_growth", "source_type": "paper_core", "method_family": "cross_sectional_growth_forecast"},
    "29": {"name_en": "Standardized Unexpected Earnings (SUE)", "research_theme": "earnings_surprise", "source_type": "paper_core", "method_family": "standardized_unexpected_growth"},
    "30": {"name_en": "Standardized Unexpected Revenue (SUR)", "research_theme": "earnings_surprise", "source_type": "paper_core", "method_family": "standardized_unexpected_growth"},
    "31": {"name_en": "Jump of Report Date (MAX)", "research_theme": "earnings_surprise", "source_type": "paper_core", "method_family": "jump_of_report_date"},
    "32": {"name_en": "Jump of Report Date (LAST)", "research_theme": "earnings_surprise", "source_type": "paper_core", "method_family": "jump_of_report_date"},
    "33": {"name_en": "Formal Report vs Forecast / Express Surprise", "research_theme": "earnings_surprise", "source_type": "paper_core", "method_family": "report_expectation_surprise"},
    "35": {"name_en": "PEG (TTM)", "research_theme": "growth_valuation", "source_type": "paper_core", "method_family": "peg"},
    "36": {"name_en": "PEG (Single Quarter)", "research_theme": "growth_valuation", "source_type": "paper_core", "method_family": "peg"},
    "37": {"name_en": "Gross Profit YoY Growth (Single Quarter)", "research_theme": "multidimensional_growth", "source_type": "paper_core", "method_family": "profit_growth"},
    "38": {"name_en": "Operating Profit YoY Growth (Single Quarter)", "research_theme": "multidimensional_growth", "source_type": "paper_core", "method_family": "profit_growth"},
    "39": {"name_en": "CFO YoY Growth (TTM)", "research_theme": "multidimensional_growth", "source_type": "paper_core", "method_family": "cashflow_growth"},
    "41": {"name_en": "CFO / Revenue YoY Change (TTM)", "research_theme": "multidimensional_growth", "source_type": "paper_core", "method_family": "cashflow_to_revenue_change"},
    "42": {"name_en": "Total Asset Turnover YoY Change (Single Quarter)", "research_theme": "multidimensional_growth", "source_type": "paper_core", "method_family": "operating_efficiency_change"},
    "43": {"name_en": "Fixed Asset Turnover YoY Change (Single Quarter)", "research_theme": "multidimensional_growth", "source_type": "paper_core", "method_family": "operating_efficiency_change"},
    "44": {"name_en": "Inventory Turnover YoY Change (Single Quarter)", "research_theme": "multidimensional_growth", "source_type": "paper_core", "method_family": "operating_efficiency_change"},
    "45": {"name_en": "Gross Margin YoY Growth (Single Quarter)", "research_theme": "multidimensional_growth", "source_type": "paper_core", "method_family": "profitability_improvement"},
    "46": {"name_en": "Net Margin YoY Growth (Single Quarter)", "research_theme": "multidimensional_growth", "source_type": "paper_core", "method_family": "profitability_improvement"},
    "47": {"name_en": "Delta ROE (Single Quarter)", "research_theme": "multidimensional_growth", "source_type": "paper_core", "method_family": "profitability_improvement"},
}
METHOD_FAMILY = {
    "growth_rate": "growth_rate",
    "growth_path": "displacement_path_ratio",
    "upward_count_ratio": "upward_count_ratio",
    "path_fit": "path_fit",
}
CATALOG_BASIS = {"single_quarter": "single_quarter", "ttm": "TTM", "stock": "balance_sheet_stock", "not_applicable": "not_applicable", "event_based": "event_based"}
BENCHMARKS = {"csi300": "csi300_monthly_open_to_open.json", "csi300_daily": "csi300_daily_open_close.json"}
REQUIRED_RUN_FILES = ["manifest.json", "benchmark_comparison.csv", "monthly_ic.parquet", "decile_returns.parquet",
                      "factor_panel_raw.parquet"]
SCHEMA_VERSION = 3


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
    try:
        return AR.resolve(factor_id)
    except AR.AcceptedRunError as e:
        raise SystemExit(str(e))


def _accepted_run(key: str, entry: dict) -> tuple:
    try:
        return AR.accepted_run(key, entry, tuple(REQUIRED_RUN_FILES))
    except AR.AcceptedRunError as e:
        raise SystemExit(str(e))


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
        "schema_version": SCHEMA_VERSION,
        "factor": {"id": factor_id, "key": key, "name_cn": entry["display_name"], "name_en": meta["name_en"], "family": entry["family"]},
        "definition": body["definition"],
        "paper_comparison": body["paper_comparison"],
        "display_context": body["display_context"],
        "analysis_by_pool": body["analysis_by_pool"],
        "coverage_by_pool": body["coverage_by_pool"],
        "notes": body["notes"],
        "provenance": {
            "source_run_id": run_dir.name,
            "source_manifest_sha256": _sha256(run_dir / "manifest.json"),
            "acceptance_record": str(record_path.relative_to(PROJECT_ROOT)),
            "analysis_pools": list(body["analysis_by_pool"]),
            "decile_excess_return_benchmark": {
                "run": str(reporting.POOL_BENCHMARK_RUN.relative_to(PROJECT_ROOT)),
                "manifest_sha256": _sha256(reporting.POOL_BENCHMARK_RUN / "manifest.json"),
            },
            "daily_valuation": {
                "run": str(reporting.DAILY_VALUATION_RUN.relative_to(PROJECT_ROOT)),
                "manifest_sha256": _sha256(reporting.DAILY_VALUATION_RUN / "manifest.json"),
            },
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
def check_daily_benchmark(payload: dict) -> None:
    dates, opens, closes = payload["dates"], payload["open"], payload["close"]
    if not dates or not len(dates) == len(opens) == len(closes):
        raise ValueError("daily benchmark arrays are empty or of different lengths")
    if any(a >= b for a, b in zip(dates, dates[1:])):
        raise ValueError("daily benchmark dates are not strictly increasing")
    if any(v is None or not math.isfinite(v) or v <= 0 for v in opens + closes):
        raise ValueError("daily benchmark has a missing or non-positive open/close")
    if (dates[0], dates[-1]) != (payload["benchmark"]["start_date"], payload["benchmark"]["end_date"]):
        raise ValueError("benchmark start_date/end_date do not match the dates")


def check_benchmark(payload: dict) -> None:
    if payload.get("schema_version") != "1.0":
        raise ValueError(f"unsupported schema_version {payload.get('schema_version')!r}")
    for key in ("id", "name_cn", "index_code", "return_basis", "start_date", "end_date"):
        if not payload["benchmark"].get(key):
            raise ValueError(f"benchmark.{key} is missing")
    if "dates" in payload:
        return check_daily_benchmark(payload)
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
    sub.add_parser("composite")
    rel = sub.add_parser("relationships")
    rel.add_argument("--run", required=True, help="Stage 7 observation run directory (relative to the project root)")
    chk = sub.add_parser("check", help="release gate over all website data checks")
    chk.add_argument("--run", required=True, help="Stage 7 observation run published on the site")
    chk.add_argument("--live-run", help="paper-trading run published on the site (default: the run in live_composite/index.json)")
    args = parser.parse_args()
    import release_check as RC

    if args.command == "check":
        argv = ["--relationships-run", args.run]
        live = args.live_run
        if live is None and (LIVE_DIR / "index.json").exists():
            live = f"artifacts/paper_trading/runs/{json.loads((LIVE_DIR / 'index.json').read_text(encoding='utf-8'))['run_id']}"
        sys.exit(RC.main(argv + (["--live-run", live] if live else [])))

    if args.command == "relationships":
        from scripts.stage7_factor_relationships import website_export as RX
        index = RX.build(PROJECT_ROOT / args.run, RELATIONSHIPS_DIR)
        for p in index["parts"]:
            files = [p["matrix_file"], p["pair_file"]] + [g["pair_file"] for g in p["groups"]]
            for f in filter(None, files):
                print(f"factor_relationships/{f}: written")
        print("factor_relationships/index.json: written")
        sys.exit(RC.main([], checks={"factor_relationships": lambda: RC.relationships_check((PROJECT_ROOT / args.run).resolve())}))

    if args.command == "composite":
        from scripts.stage6_composite_factors import website_export as WE
        for entry in WE.build(COMPOSITE_DIR):
            print(f"composite_backtest/{entry['data_file']}: written")
        print("composite_backtest/catalog.json: written")
        sys.exit(RC.main([], checks={"composite_backtest": RC.composite_check}))

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
