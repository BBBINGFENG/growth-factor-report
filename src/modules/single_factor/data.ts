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
  time_series_quantile: "时序分位数",
  analyst_revision: "分析师预期调整",
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
  mean_monthly_return: Num;
  arithmetic_annualized_return: Num;
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

export interface FactorReport {
  schema_version: string;
  factor: { id: string; key: string; name_cn: string; name_en: string; family: string };
  definition: {
    economic_hypothesis: string;
    formula: string;
    input_field: string;
    window: string;
    direction: string;
    missing_rule: string;
    accounting_basis: string;
  };
  core_performance: {
    pool_metrics: PoolMetric[];
    decile_returns: DecileRow[];
    benchmark_comparison: BenchmarkRow[];
  };
  stability: {
    monthly_ic: { date: string; rank_ic: Num; rolling_12m_ic: Num; n_valid: number | null; below_min_n: boolean | null }[];
    long_short_nav: { period_start: string; period_end: string | null; monthly_long_short_return: Num; nav: Num }[];
    annual_performance: {
      year: number;
      annual_long_short_return: Num;
      mean_rank_ic: Num;
      ic_positive_ratio: Num;
      valid_ic_months: number;
      valid_long_short_months: number;
    }[];
    coverage: { date: string; universe_count: number; valid_count: number | null; coverage_rate: Num }[];
  };
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
    primary_branch: { pool: string; preprocessing_universe: string; pool_display_name: string };
    source_files: { file: string; sha256: string | null }[];
  };
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

// NAV display points: initial value 1 at the first period_start, then each NAV at its period_end.
export function navPoints(rows: { period_start: string; period_end: string | null; nav: Num }[]): Map<string, Num> {
  const points = new Map<string, Num>();
  if (!rows.length) return points;
  points.set(rows[0].period_start, 1);
  for (const r of rows) if (r.period_end) points.set(r.period_end, r.nav);
  return points;
}

export const CLASSIFICATION_CN: Record<string, string> = {
  unresolved_replication_discrepancy: "超出项目±20%容差，原因尚未查明，未做参数调整",
};

export function metricValue(metric: string, v: Num): string {
  return metric === "icir" ? num(v) : pct(v);
}
