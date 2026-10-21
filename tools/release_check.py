"""Release gate for the website data: exit code 0 only when every check passes.

    python3 website/tools/release_check.py --relationships-run artifacts/factor_relationships/<run_id>

Checks (run from the project root, read-only):
- factor_relationships: the observation run's output files match the sha256 in its manifest,
  then scripts.stage7_factor_relationships.verify_website.verify(run) must return all_pass True;
- composite_backtest: scripts.stage6_composite_factors.verify_website.verify() must return all_pass True.

A check passes only when verify() returns a dict whose all_pass is exactly True. all_pass False or
missing, an exception (missing data, changed code, hash mismatch) or a missing run all fail the gate.
The verify modules' own command lines only print their JSON and always exit 0, so they are not a
release criterion. This gate is tracked in the website repository; it is not part of any research
run's recorded code.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import traceback
from pathlib import Path
from typing import Callable

WEBSITE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = WEBSITE_DIR.parent
RELATIONSHIPS_WEB = WEBSITE_DIR / "public" / "data" / "factor_relationships"
sys.path.insert(0, str(PROJECT_ROOT))


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def run_outputs_unchanged(run: Path) -> list:
    """Output files of a run whose content differs from (or is missing against) its manifest."""
    manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
    return [o["file"] for o in manifest["outputs"] if not (run / o["file"]).is_file() or _sha256(run / o["file"]) != o["sha256"]]


def relationships_check(run: Path, web: Path = RELATIONSHIPS_WEB) -> dict:
    if not run.is_dir():
        raise FileNotFoundError(f"observation run not found: {run}")
    bad = run_outputs_unchanged(run)
    if bad:
        raise RuntimeError(f"{run.name} outputs differ from its manifest: {bad}")
    from scripts.stage7_factor_relationships import verify_website as S7
    return S7.verify(run, None, web)


def composite_check() -> dict:
    from scripts.stage6_composite_factors import verify_website as S6
    return S6.verify(None)


def gate(checks: dict[str, Callable[[], object]]) -> tuple[bool, dict]:
    """Run every check; a check passes only if it returns a dict with all_pass exactly True."""
    results = {}
    for name, check in checks.items():
        try:
            out = check()
            ok = isinstance(out, dict) and out.get("all_pass") is True
            results[name] = {"status": "pass" if ok else "fail",
                             "detail": None if ok else (out.get("mismatches") or out.get("failed") or "all_pass is not True") if isinstance(out, dict)
                             else f"unexpected result {type(out).__name__}"}
        except Exception as exc:                       # missing data, changed code, hash mismatch ...
            results[name] = {"status": "error", "detail": f"{type(exc).__name__}: {exc}", "trace": traceback.format_exc(limit=3)}
    return all(r["status"] == "pass" for r in results.values()), results


def main(argv: list | None = None, checks: dict | None = None) -> int:
    ap = argparse.ArgumentParser(description="Website release gate (exit 0 only if every check passes).")
    ap.add_argument("--relationships-run", required=checks is None, type=Path,
                    help="Stage 7 observation run published on the site, relative to the project root")
    ap.add_argument("--skip-composite", action="store_true", help="only for local debugging; a release must not skip checks")
    args = ap.parse_args(argv)
    if checks is None:
        run = (PROJECT_ROOT / args.relationships_run).resolve()
        checks = {"factor_relationships": lambda: relationships_check(run)}
        if not args.skip_composite:
            checks["composite_backtest"] = composite_check
    ok, results = gate(checks)
    for name, r in results.items():
        print(f"[{r['status'].upper()}] {name}" + (f": {r['detail']}" if r["detail"] else ""), file=sys.stderr if r["status"] != "pass" else sys.stdout)
    print("RELEASE GATE: PASS" if ok and not args.skip_composite else "RELEASE GATE: FAIL" if not ok else "RELEASE GATE: INCOMPLETE (composite skipped)")
    return 0 if ok and not args.skip_composite else 1


if __name__ == "__main__":
    sys.exit(main())
