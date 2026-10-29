import { getJson, type Num } from "../../shared/format";
import type { FormulaSymbol } from "../../shared/MathFormula";

export type Scenario = "base" | "low" | "high" | "gross";
export const SCENARIOS: Scenario[] = ["base", "low", "high", "gross"];

export interface Metrics {
  return: Num;
  benchmark_return: Num;
  relative: Num;
  cagr: Num;
  benchmark_cagr: Num;
  short_sample: boolean;
  calendar_days: number;
  trading_days: number;
  annualized_volatility: Num;
  sharpe: Num;
  max_drawdown: Num;
  benchmark_annualized_volatility: Num;
  benchmark_sharpe: Num;
  benchmark_max_drawdown: Num;
  cash_ratio_mean: Num;
  cash_ratio_last: Num;
  turnover: Num;
  traded_amount: Num;
  fill_rate: Num;
  costs: Record<string, Num>;
  costs_total: Num;
  n_trades: number;
  final_total: Num;
}

export interface Formula {
  id: string;
  title: string;
  tex: string;
  symbols: FormulaSymbol[];
  note: string;
}

export interface LiveIndex {
  schema_version: number;
  run_id: string;
  run_manifest_sha256: string;
  status: { last_check_beijing: string; data_through: string; data_updated_beijing: string; source_incomplete_calls: Record<string, number>; run_id: string };
  start_date: string;
  data_through: string;
  versions: { assumptions: string; strategy: string };
  default_strategy: string;
  focus_pair: string[];
  scenarios: Record<Scenario, string>;
  scenario_note: string;
  summary: ({ id: string; name_cn: string } & Record<Scenario, Metrics>)[];
  formulas: Formula[];
  assumptions: Record<string, unknown>;
  limitations: string[];
  signal_months: { signal_date: string; sha256: string }[];
  signal_validation: { frozen_overlap?: Record<string, { months: string[]; max_abs_diff: number; nan_pattern_mismatch: number; rows_only_one_side: number }> } | null;
}

export interface Batch {
  signal_date: string;
  nav_base: number;
  targets: [string, string, string, Num, number, number, Num][];
  orders: [string, string, string, number, number, string, string, number, string | null][];
  trades: [string, string, string, string, number, Num, Num, Num, Num, Num, Num][];
}

export interface StrategyData {
  id: string;
  name_cn: string;
  dates: string[];
  nav: Record<Scenario, Num[]>;
  drawdown: Record<Scenario, Num[]>;
  cash_ratio: Num[];
  benchmark: Num[];
  csi300: Num[];
  metrics: Record<Scenario, Metrics>;
  costs_by_scenario: Record<Scenario, Record<string, Num>>;
  batches: Batch[];
  positions: Record<string, { cash: number; receivable: number; total: number; rows: [string, string, string, number, Num, Num, string][] }>;
  events: Record<string, string | number | null>[];
}

export function loadLiveIndex(): Promise<LiveIndex> {
  return getJson<LiveIndex>("live_composite/index.json");
}

const cache = new Map<string, Promise<StrategyData>>();
export function loadStrategy(id: string): Promise<StrategyData> {
  if (!cache.has(id)) cache.set(id, getJson<StrategyData>(`live_composite/strategies/${id}.json`));
  return cache.get(id)!;
}

export function ymd(d: string | null | undefined): string {
  return d && d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d ?? "—";
}

export function money(v: Num): string {
  return v === null ? "—" : v.toLocaleString("zh-CN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
