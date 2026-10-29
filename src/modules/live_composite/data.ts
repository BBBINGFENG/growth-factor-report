import { getJson, type Num } from "../../shared/format";
import type { FormulaSymbol } from "../../shared/MathFormula";

export type Scenario = "base" | "low" | "high" | "gross";
export const SCENARIOS: Scenario[] = ["base", "low", "high", "gross"];
export type Layer = "ideal" | "gross" | "base";
export const LAYERS: Layer[] = ["ideal", "gross", "base"];
export const LAYER_CN: Record<Layer, string> = { ideal: "理想参考", gross: "可交易费前", base: "可交易费后" };

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
  section: "performance" | "layers" | "cash" | "risk";
  title: string;
  tex: string;
  symbols: FormulaSymbol[];
  note: string;
}

export interface MissedDecision {
  type: string;
  signal_date: string;
  candidate_day: string | null;
  deadline_beijing?: string;
  detected_at_beijing: string;
  note?: string;
}

export interface ForwardRecord {
  status: "not_started" | "active" | null;
  start_signal_date: string;
  rules_frozen_at_beijing: string;
  pending: string[] | null;
  missed: MissedDecision[] | null;
  trading_days?: number | null;
  executed?: string[] | null;
  plans: { signal_date: string; execution_day: string; generated_at_beijing: string }[];
  rules: Record<string, string>;
}

export interface Protocol {
  roles: string[][];
  hypotheses: string[];
  primary_comparison: string;
  metrics: string[];
  defined_vs_implementation: Record<string, string[]>;
  records: Record<string, string>;
  freeze: string;
  change_process: string[];
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
  reference: Record<string, string>;
  scenario_note: string;
  primary_comparison: { strategy: string; control: string; replay: Num; forward: Num; definition: string };
  summary: ({ id: string; name_cn: string; forward: Metrics | null } & Record<Scenario | "ideal", Metrics>)[];
  formulas: Formula[];
  protocol: Protocol;
  layer_definitions: { columns: string[]; rows: string[][]; note: string };
  records: { replay: { label: string; start_date: string; data_through: string }; forward: ForwardRecord };
  assumptions: Record<string, unknown>;
  limitations: string[];
  signal_months: { signal_date: string; sha256: string }[];
  signal_validation: { frozen_overlap?: Record<string, { months: string[]; max_abs_diff: number; nan_pattern_mismatch: number; rows_only_one_side: number }> } | null;
}

export interface Batch {
  signal_date: string;
  nav_base: number;
  targets: [string, string, string, Num, number, Num, Num][];
  orders: [string, string, string, Num, Num, string, string, number, string | null][];
  trades: [string, string, string, string, Num, Num, Num, Num, Num, Num, Num][];
}

export type Positions = Record<string, { cash: number; receivable: number; total: number; rows: [string, string, string, Num, Num, Num, string][] }>;

export interface CashBatch {
  batch: string;
  window_end: string;
  nav_base: Num;
  cash_before: Num;
  planned_cash: Num;
  plan: Record<string, Num>;
  execution: { unfilled_buys: Record<string, Num>; unfilled_sells: Num; price_gap: Num; execution_cost: Num; fees: Num; dividends_paid: Num };
  cash_at_window_end: Num;
  target_shortfall_value: Num;
  excess_holding_value: Num;
  n_targets: number;
  n_nonzero_targets: number;
  n_held: number;
  n_targets_held: number;
  n_held_outside_targets: number;
  weight_deviation_half_l1: Num;
  max_weight_deviation: Num;
  zero_share_targets: [string, string, Num, Num, Num][];
  unit_rule_not_placed: [string, string, string, Num, Num][];
  buy_fill_ratio: Num;
  sell_fill_ratio: Num;
  buy_days_to_fill: { n: number; first_day: number; max: number };
  lingering: [string, string, string, Num, number, string][];
}

export interface PnlTable {
  initial: number;
  final: Num;
  account_pnl: Num;
  stock_pnl_sum: Num;
  residual: Num;
  max_daily_residual: Num;
  stocks: [string, string, string, Num, Num, Num, Num, Num, Num, number][];
  industries: [string, Num, Num, Num, Num][];
  months: { month: string; start: Num; end: Num; return: Num; stock_pnl: Num; residual: Num; top: [string, string, Num, Num][]; bottom: [string, string, Num, Num][] }[];
  concentration: { top5_stock_pnl: Num; top5_share_of_total: Num; top5_share_of_positive: Num; n_stocks: number; n_positive: number; top_industry: string | null; top_industry_share_of_total: Num };
}

export interface LayerSummary {
  return: Num;
  final: Num;
  cash_ratio_mean: Num;
  turnover: Num;
  n_holdings_mean: Num;
  n_targets_held_mean: Num;
  target_weight_held_mean: Num;
  fill_ratio: Num;
  costs: Num;
  cash_ratio: Num[];
}

export interface Diagnostics {
  same_targets_across_layers: boolean;
  layers: {
    layers: Record<Layer, LayerSummary>;
    months: ({ month: string } & Record<Layer, Num>)[];
    stocks: [string, string, Num, Num, Num, Num, Num][];
  };
  cash: Record<"base" | "gross", CashBatch[]>;
  risk: {
    industry: { date: string; stock_weight: Num; rows: [string, Num, Num, Num][] }[];
    size: { batch: string; date: string; weights: Record<string, Num>; median_mv_holdings_yi: Num; median_mv_pool_yi: Num }[];
    concentration: { max_weight: Num[]; top5_weight: Num[]; n_holdings: number[]; summary: Record<string, Num> };
    beta: { market: string; n: number; start?: string; end?: string; beta?: Num; beta_se?: Num; intercept_daily?: Num; intercept_se?: Num; r2?: Num }[];
  };
  pnl: Record<"base" | "gross" | "ideal", PnlTable>;
}

export interface ForwardPlan {
  signal_date: string;
  execution_day: string;
  generated_at_beijing: string;
  deadline_beijing: string;
  information_cutoff: string;
  market_data_through: string;
  sha256: string;
  inputs: Record<string, string>;
  account_before: { cash: number; receivable: number; total: number; holdings: [string, string, Num, Num, Num, string][] };
  n_scored: number;
  candidates: [number, string, string, string, Num, boolean, string][];
  targets: [number, string, string, string, Num, Num, Num, Num, Num, string][];
  orders: [string, string, string, Num, number, Num][];
}

export interface StrategyData {
  id: string;
  name_cn: string;
  dates: string[];
  nav: Record<Scenario | "ideal", Num[]>;
  drawdown: Record<Scenario | "ideal", Num[]>;
  cash_ratio: Num[];
  benchmark: Num[];
  csi300: Num[];
  metrics: Record<Scenario | "ideal", Metrics>;
  costs_by_scenario: Record<Scenario | "ideal", Record<string, Num>>;
  plan_kind: string;
  batches: Batch[];
  positions: Positions;
  events: Record<string, string | number | null>[];
  diagnostics: Diagnostics;
  forward: {
    status: "not_started" | "active" | null;
    plans: ForwardPlan[];
    dates?: string[];
    nav?: Num[];
    drawdown?: Num[];
    benchmark?: Num[];
    metrics?: Metrics;
    batches?: Batch[];
    positions?: Positions;
  };
}

export function loadLiveIndex(): Promise<LiveIndex> {
  return getJson<LiveIndex>("live_composite/index.json");
}

const cache = new Map<string, Promise<StrategyData>>();
export function loadStrategy(id: string): Promise<StrategyData> {
  if (!cache.has(id)) {
    cache.set(id, getJson<StrategyData>(`live_composite/strategies/${id}.json`).catch((e: Error) => {
      cache.delete(id);
      throw e;
    }));
  }
  return cache.get(id)!;
}

export function ymd(d: string | null | undefined): string {
  return d && d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d ?? "—";
}

export function bjTime(s: string | null | undefined): string {
  return s ? s.slice(0, 16).replace("T", " ") : "—";
}

export function money(v: Num): string {
  return v === null || v === undefined ? "—" : v.toLocaleString("zh-CN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
