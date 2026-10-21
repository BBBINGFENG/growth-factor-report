import { getJson, type Num } from "../../shared/format";
import type { FormulaSymbol } from "../../shared/MathFormula";

export type Role = "dependency" | "main" | "intermediate";

export interface CatalogItem {
  id: string;
  name_cn: string;
  role: Role;
  role_cn: string;
  inherits_d01: boolean;
  data_file: string;
}

export interface CompositeCatalog {
  schema_version: number;
  items: CatalogItem[];
  notice: { title: string; points: string[] };
  status_note: { composites: string; d01: string; not_claimed: string };
  interface_revision: string;
}

export interface MonthlyRow {
  period: string;
  label: string;
  return_type: "cagr" | "interval";
  return: Num;
  annualized_volatility: Num;
  sharpe: Num;
  max_drawdown: Num;
  mean_rank_ic: Num;
  annualized_icir: Num;
  ic_positive_ratio: Num;
  valid_ic_months: number;
  valid_long_short_months: number;
  csi300_return: Num;
}

export interface DailyRow {
  period: string;
  label: string;
  begin_point: string;
  end_point: string;
  return: Num;
  return_type: "cagr" | "interval";
  annualized_volatility: Num;
  sharpe: Num;
  max_drawdown: Num;
  max_drawdown_peak_date: string;
  max_drawdown_trough_date: string;
  valid_days: number;
  cash_days: number;
  csi300_return?: Num;
}

export interface PeriodCoverage {
  months: number;
  first_month: string | null;
  last_month: string | null;
  mean_universe: Num;
  mean_valid: Num;
  mean_coverage: Num;
}

export interface Comparison {
  from: string;
  reason: string;
  monthly: { ic_summary: Record<string, Num>; long_short: Record<string, Num>; annual: MonthlyRow[] };
  daily: DailyRow[];
  coverage_by_period: Record<string, PeriodCoverage>;
  long_short_arithmetic_by_period: Record<string, Num>;
}

export interface ImplementationChoice {
  item: string;
  choice: string;
  type: string;
  paper_basis: string;
  supporting_context?: string;
  user_confirmed: boolean | string;
  confirmed_on?: string;
}

export interface CompositeReport {
  schema_version: number;
  id: string;
  name_cn: string;
  role: Role;
  role_cn: string;
  purpose: string;
  structure: {
    hierarchy: string | null;
    components: { id: string; name_cn: string }[];
    weights: string;
    missing_rule: string;
    universe: string;
    formula_tex: string;
    formula_symbols: FormulaSymbol[];
    route_tex: string;
    route_symbols: FormulaSymbol[];
    mean_tex: string;
  };
  status: {
    acceptance_status: string;
    components: Record<string, unknown>;
    record: string;
    record_sha256: string;
    external_review?: { status: string; reviewer: string };
    review_record?: string;
    verification_record?: string;
  };
  implementation_choices: ImplementationChoice[];
  method_detail: Record<string, unknown> | null;
  erratum: { issue: string; correct: string; computation_affected: boolean } | null;
  limitations: { inherits_d01: boolean; specific: string[]; recorded: string[] };
  paper_comparison: {
    paper_item: string;
    comparable_construction: boolean;
    long_short_annualization: string;
    metrics: Record<string, { replicated: number; paper: number; relative_difference: number; classification: string }>;
    caveat: string;
  } | null;
  metrics: {
    monthly_annual: MonthlyRow[];
    ic_summary: Record<string, Num>;
    long_short: { effective_month_count: Num; long_short_arithmetic_annualized: Num; long_short_geometric_annualized_diagnostic: Num };
    long_short_arithmetic_by_period: Record<string, Num>;
    daily: DailyRow[];
    deciles: { mean_group_returns: Num[]; spearman_group_vs_mean_return: Num; months_grouped: number; monthly_spearman_mean: Num };
    deciles_excess: {
      benchmark: { name_cn: string; pool: string; basis: string; file: string };
      groups: { group: string; raw_monthly: Num; benchmark_monthly: Num; excess_monthly: Num; valid_month_count: number }[];
      first_month: string | null;
      last_month: string | null;
      months: number;
      sample_note: string | null;
    };
  };
  effective_period: {
    rule: string;
    signal_calendar_months: number;
    factor_unavailable_months: number;
    factor_unavailable_last_month: string | null;
    cash_months: string[];
    start: string;
    end: string;
  };
  coverage_by_period: Record<string, PeriodCoverage>;
  coverage_denominator: string;
  comparisons: Record<string, Comparison>;
  series: {
    monthly: {
      dates: string[];
      rank_ic: Num[];
      ic_below_min_n: (boolean | null)[];
      long_short_return: Num[];
      long_short_nav: Num[];
      universe: (number | null)[];
      valid: (number | null)[];
      coverage: Num[];
      n_categories?: Record<string, number[]>;
    };
    daily: { dates: string[]; points: ("open" | "close")[]; value: Num[]; drawdown: Num[] };
  };
  checks: Record<string, number | null>;
  provenance: { run: string; run_manifest_sha256: string; interface: string; interface_sha256: string; interface_revision: string };
}

export function loadCompositeCatalog(): Promise<CompositeCatalog> {
  return getJson<CompositeCatalog>("composite_backtest/catalog.json");
}

export function loadComposite(item: CatalogItem): Promise<CompositeReport> {
  return getJson<CompositeReport>(`composite_backtest/${item.data_file}`);
}

export const STATUS_CN: Record<string, string> = {
  accepted_after_external_review: "已验收：分公式复核与 Codex 外部审查通过；数据限制仍在",
  accepted_after_external_review_inherits_d01_limitations: "已验收：分公式复核与 Codex 外部审查通过；继承 D01 限制，非完全一致复现",
  limited_research_baseline_limited_scope_review_passed: "受限研究基线（冻结 run 状态 candidate）：限定范围独立计算审查通过；不证明严格 PIT 或完整原文复现",
};

export function ymd(d: string | null | undefined): string {
  if (!d) return "—";
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d;
}
