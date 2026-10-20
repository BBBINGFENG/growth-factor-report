import { getJson, num, pct, type Num } from "../../shared/format";

export interface CatalogEntry {
  id: string;
  key: string;
  name_cn: string;
  name_en: string;
  research_theme: string;
  method_family: string;
  source_type: string;
  accounting_basis: string;
  published: boolean;
  data_file: string;
}

export const THEME_CN: Record<string, string> = {
  traditional_growth: "传统成长",
  growth_path: "成长路径",
  growth_momentum: "成长动能",
  forward_growth: "预期成长",
  earnings_surprise: "业绩超预期",
  growth_valuation: "成长估值",
  multidimensional_growth: "多维成长",
  low_base: "低基数",
};

export const METHOD_CN: Record<string, string> = {
  growth_rate: "同比增速",
  displacement_path_ratio: "位移路程比",
  upward_count_ratio: "上涨次数占比",
  path_fit: "路径拟合程度",
  growth_acceleration: "成长加速度",
  rank_growth_acceleration: "Rank成长加速度",
  time_series_quantile: "增速时序分位点",
  time_series_regression_coefficient: "增速时序回归系数",
  cross_sectional_growth_forecast: "回归预测增速",
  analyst_revision: "分析师预期调整",
  standardized_unexpected_growth: "标准化预期外增长",
  jump_of_report_date: "公告跳空JOR",
  report_expectation_surprise: "财报超预告快报",
  analyst_earnings_surprise: "超分析师预期",
  peg: "PEG",
  profit_growth: "利润同比增速",
  cashflow_growth: "现金流同比增速",
  cashflow_to_revenue_change: "现金流/收入比变化",
  operating_efficiency_change: "周转率同比变化",
  profitability_improvement: "盈利能力提升",
};

export const BASIS_CN: Record<string, string> = {
  single_quarter: "单季度",
  TTM: "TTM",
  balance_sheet_stock: "资产负债表存量",
  event_based: "事件",
  not_applicable: "不适用",
};

export interface PoolMetric {
  pool: string;
  pool_display_name: string;
  rank_ic: Num;
  annualized_icir: Num;
  long_short_annualized: Num;
  paper_rank_ic: Num;
  paper_icir: Num;
  paper_long_short_annualized: Num;
}

export interface DecileRow {
  group: string;
  raw_annualized: Num;
  benchmark_annualized: Num;
  excess_annualized: Num;
  valid_month_count: number;
}

export interface BenchmarkRow {
  pool: string;
  pool_display_name: string;
  metric: "rank_ic" | "icir" | "long_short_annualized";
  metric_display_name: string;
  replicated: Num;
  paper: Num;
  absolute_difference: Num;
  relative_difference: Num;
}

export interface DatedBeforeAfter {
  date: string;
  n: number;
  before_neutralization: Num;
  after_neutralization: Num;
}

export interface AnnualRow {
  period: string;
  label: string;
  return_type: "interval" | "cagr";
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

export interface DailyAnnualRow {
  period: string;
  label: string;
  return_type: "interval" | "cagr";
  begin_point: string;
  end_point: string;
  calendar_days: number;
  return: Num;
  annualized_volatility: Num;
  sharpe: Num;
  max_drawdown: Num;
  max_drawdown_peak_date: string;
  max_drawdown_trough_date: string;
  valid_days: number;
  cash_days: number;
  invested_days: number;
  conditional_annualized_volatility: Num;
  conditional_sharpe: Num;
  csi300_return: Num;
}

export interface E1EndpointYear {
  year: string;
  months: number;
  begin_open: string;
  end_open: string;
  e1_monthly: Num;
  daily_model: Num;
  daily_model_e1_pricing: Num;
  months_with_carried_exit: number;
}

// Monthly rebalancing, daily close valuation; computed by the research layer.
export interface DailyValuation {
  basis: string;
  annualization_days: number;
  risk_free_rate: number;
  std_ddof: number;
  start_date: string;
  end_date: string;
  nav: { dates: string[]; points: ("open" | "close")[]; value: number[]; drawdown: number[] };
  annual_performance: DailyAnnualRow[];
  sample: {
    rule: string;
    rule_cn: string;
    outside_pool_coverage_months: number;
    factor_unavailable_months: number;
    factor_unavailable_last_month: string | null;
    cash_months: string[];
  };
  summary: {
    position_months: number;
    cash_months: number;
    comparable_months: number;
    valid_days: number;
    cash_days: number;
    invested_days: number;
    stale_position_days: Record<"suspended" | "delisted" | "unknown", number>;
    exit_carried_positions: number;
    exit_positions_by_reason: Record<"suspended" | "delisted" | "unknown", number>;
    entry_without_open: number;
  };
  reconciliation: {
    max_abs_difference_comparable_months: Num;
    max_abs_difference_e1_pricing: Num;
    e1_compounded: Num;
    daily_compounded: Num;
    e1_endpoint_years: E1EndpointYear[];
  };
}

export interface PoolAnalysis {
  pool_display_name: string;
  preprocessing_universe: string;
  deciles: DecileRow[];
  monthly_ic: { date: string; rank_ic: Num; rolling_12m_ic: Num; n_valid: number | null; below_min_n: boolean | null }[];
  long_short_nav: { period_start: string; period_end: string | null; monthly_long_short_return: Num; nav: Num }[];
  annual_performance: AnnualRow[];
  daily_valuation?: DailyValuation;
  risk_exposure: {
    size: DatedBeforeAfter[];
    industry: {
      monthly_dispersion: DatedBeforeAfter[];
      long_run_bias: {
        industry_code: string;
        industry_name: string;
        mean_exposure_before_neutralization: Num;
        mean_exposure_after_neutralization: Num;
        months: number;
      }[];
    };
  };
}

export interface PoolCoverage {
  pool_display_name: string;
  summary: {
    full_sample_mean: Num;
    effective_mean: Num;
    effective_min: Num;
    latest: Num;
    first_effective_month: string | null;
  };
  monthly: { date: string; eligible_count: number; valid_count: number; coverage_rate: Num }[];
}

export type ChartKey =
  | "deciles"
  | "monthly_ic"
  | "long_short_nav"
  | "annual_performance"
  | "coverage"
  | "size_exposure"
  | "industry_exposure"
  | "daily_nav"
  | "daily_drawdown"
  | "daily_annual";

export interface DisplayContext {
  frequency: string;
  preprocessing: string;
  return_basis: string;
  decile_benchmark: string;
  transaction_cost: string;
  chart_notes: Record<ChartKey, string>;
}

export interface FactorReport {
  schema_version: number;
  factor: { id: string; key: string; name_cn: string; name_en: string; family: string };
  definition: {
    economic_hypothesis: string;
    formula: string;
    formula_tex?: string;
    formula_symbols?: { tex: string; meaning: string }[];
    input_field: string;
    window: string;
    direction: string;
    missing_rule: string;
    accounting_basis: string;
  };
  paper_comparison: { pool_metrics: PoolMetric[]; comparison: BenchmarkRow[] };
  display_context: DisplayContext;
  analysis_by_pool: Record<string, PoolAnalysis>;
  coverage_by_pool: Record<string, PoolCoverage>;
  notes: {
    known_replication_discrepancies: {
      pool: string;
      metric: string;
      metric_display_name: string;
      replicated: Num;
      paper: Num;
      relative_difference: Num;
      classification: string;
    }[];
  };
  provenance: {
    source_run_id: string;
    source_manifest_sha256: string;
    acceptance_record: string;
    analysis_pools: string[];
    source_files: { file: string; sha256: string | null }[];
  };
}

export function chartNote(ctx: DisplayContext, key: ChartKey, poolName: string): string {
  return (ctx.chart_notes[key] ?? "").replace("{pool}", poolName);
}

export const loadCatalog = () => getJson<CatalogEntry[]>("single_factor/catalog.json");
export const loadFactor = (entry: CatalogEntry) => getJson<FactorReport>(`single_factor/${entry.data_file}`);

export interface BenchmarkReport {
  schema_version: string;
  benchmark: {
    id: string;
    name_cn: string;
    index_code: string;
    role: string;
    return_basis: string;
    start_date: string;
    end_date: string;
    research_end_date: string;
  };
  series: { period_start: string; period_end: string; monthly_return: Num; nav: Num }[];
}

let csi300Promise: Promise<BenchmarkReport> | null = null;

// One request per page session, shared by every factor.
export function loadCsi300(): Promise<BenchmarkReport> {
  csi300Promise ??= getJson<BenchmarkReport>("shared/benchmarks/csi300_monthly_open_to_open.json").catch((e) => {
    csi300Promise = null;
    throw e;
  });
  return csi300Promise;
}

export interface DailyBenchmark {
  benchmark: { id: string; name_cn: string; role: string; start_date: string; end_date: string };
  dates: string[];
  open: number[];
  close: number[];
}

let csi300DailyPromise: Promise<DailyBenchmark> | null = null;

export function loadCsi300Daily(): Promise<DailyBenchmark> {
  csi300DailyPromise ??= getJson<DailyBenchmark>("shared/benchmarks/csi300_daily_open_close.json").catch((e) => {
    csi300DailyPromise = null;
    throw e;
  });
  return csi300DailyPromise;
}

// NAV display points: initial value 1 at the period_start of the first row with a NAV,
// then each NAV at its period_end. Earlier rows without a NAV are left out entirely.
export function navPoints(rows: { period_start: string; period_end: string | null; nav: Num }[]): Map<string, Num> {
  const points = new Map<string, Num>();
  const first = rows.findIndex((r) => r.nav !== null);
  if (first < 0) return points;
  points.set(rows[first].period_start, 1);
  for (const r of rows.slice(first)) if (r.period_end) points.set(r.period_end, r.nav);
  return points;
}

export const CLASSIFICATION_CN: Record<string, string> = {
  unresolved_replication_discrepancy: "超出项目±20%容差，原因尚未查明，未做参数调整",
};

export function metricValue(metric: string, v: Num): string {
  return metric === "icir" ? num(v) : pct(v);
}
