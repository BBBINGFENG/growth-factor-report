export type Num = number | null;

export interface FactorIndexEntry {
  id: string;
  key: string;
  name_cn: string;
  name_en: string;
  family: string;
  data_file: string;
}

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
  factor: Omit<FactorIndexEntry, "data_file">;
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
    long_short_nav: { date: string; monthly_long_short_return: Num; nav: Num }[];
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
      registered_note: string;
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

const base = import.meta.env.BASE_URL;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}data/${path}`);
  if (!res.ok) throw new Error(`无法读取 ${path}（HTTP ${res.status}）`);
  return (await res.json()) as T;
}

export const loadIndex = () => getJson<FactorIndexEntry[]>("factors.json");
export const loadFactor = (entry: FactorIndexEntry) => getJson<FactorReport>(entry.data_file);

export function pct(v: Num, digits = 2): string {
  return v === null ? "—" : `${(v * 100).toFixed(digits)}%`;
}

export function num(v: Num, digits = 2): string {
  return v === null ? "—" : v.toFixed(digits);
}

export function metricValue(metric: string, v: Num): string {
  return metric === "icir" ? num(v) : pct(v);
}
