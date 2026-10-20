import { getJson, type Num } from "../../shared/format";
import type { FormulaSymbol } from "../../shared/MathFormula";

export type Period = "before_2021" | "since_2021";
export const PERIODS: Period[] = ["before_2021", "since_2021"];
export type Method = "pearson" | "spearman" | "kendall";
export type ListPair = "G10-G10" | "G1-G1" | "G10-G1" | "G1-G10";

export interface FormulaText {
  description: string;
  tex: string;
  symbols: FormulaSymbol[];
}

export interface Section extends FormulaText {
  id: "signal" | "returns" | "group" | "ic" | "overlap";
  title: string;
  chart: "matrix" | "rolling" | "overlap";
  // Section ① only: one formula per correlation method.
  methods?: Record<Method, FormulaText>;
}

export interface SetMember {
  id: string;
  name_cn: string;
  role: string | null;
  role_note: string | null;
}

export interface SetEntry {
  id: string;
  mode: "single_factor" | "composite";
  name_cn: string;
  file: string;
  members: SetMember[];
  default_members: string[];
  comparable: boolean;
}

export interface RelationshipsIndex {
  schema_version: number;
  run_id: string;
  run: string;
  run_manifest_sha256: string;
  baseline_run: string;
  config: {
    signal_methods: Method[];
    default_method: Method;
    min_stocks: number;
    return_min_months: number;
    rolling_windows: number[];
    default_window: number;
    rolling_min_months: number;
    group_pairs: ListPair[];
    period_labels: Record<Period, string>;
    boundary: string;
  };
  sections: Section[];
  notice: string;
  sets: SetEntry[];
}

type Matrix<T> = (T | null)[][];

export interface RollingSeries {
  value: Num[];
  n_months: number[];
}

// Counts are null when they depend on an unknown list; a known empty list counts 0.
export interface OverlapSeries {
  jaccard: Num[];
  n_a: Num[];
  n_b: Num[];
  intersection: Num[];
  union: Num[];
}

export interface PairData {
  rolling: Record<string, Record<string, Record<Period, RollingSeries>>>;
  overlap: Record<string, Record<Period, OverlapSeries>>;
}

export interface SetData {
  schema_version: number;
  set_id: string;
  mode: string;
  members: string[];
  dates: Record<Period, string[]>;
  signal_matrix?: Record<Method, Record<Period, { mean_rho: Matrix<number>; months: Matrix<number>; mean_n: Matrix<number>; min_n: Matrix<number> }>>;
  return_matrix?: Record<Period, { pearson: Matrix<number>; n_months: Matrix<number> }>;
  pairs?: Record<string, PairData>;
  ic_samples?: Record<string, Partial<Record<Period, { valid_months: number; mean_n: Num }>>>;
}

export function loadIndex(): Promise<RelationshipsIndex> {
  return getJson<RelationshipsIndex>("factor_relationships/index.json");
}

const cache = new Map<string, Promise<SetData>>();
export function loadSet(entry: SetEntry): Promise<SetData> {
  if (!cache.has(entry.file)) cache.set(entry.file, getJson<SetData>(`factor_relationships/${entry.file}`));
  return cache.get(entry.file)!;
}

const SWAP: Record<string, string> = { "G10-G10": "G10-G10", "G1-G1": "G1-G1", "G10-G1": "G1-G10", "G1-G10": "G10-G1", IC: "IC" };

/** Pairs are stored once in member order; (B, A) with "G10-G1" is the stored (A, B) "G1-G10". Lookup only. */
export function pairView(set: SetData, a: string, b: string, kind: string): { pair: PairData | undefined; key: string; swapped: boolean } {
  const ia = set.members.indexOf(a);
  const ib = set.members.indexOf(b);
  if (ia <= ib) return { pair: set.pairs?.[`${a}|${b}`], key: kind, swapped: false };
  return { pair: set.pairs?.[`${b}|${a}`], key: SWAP[kind], swapped: true };
}

export function ym(d: string): string {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}`;
}
