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

export interface Member {
  id: string;
  name_cn: string;
  group: string;
  role: string | null;
  role_note: string | null;
  inherits_d01: boolean;
  sample_note: string | null;
}

export interface Group {
  id: string;
  name_cn: string;
  members: string[];
  pair_file: string | null;
}

export interface Part {
  id: "single_factors" | "composites";
  mode: "single_factor" | "composite";
  name_cn: string;
  matrix_file: string;
  pairs: "within_group" | "all";
  pair_file: string | null;
  groups: Group[];
  members: Member[];
  default_hidden: string[];
  note: string;
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
    calendar_first: string;
    calendar_last: string;
  };
  benchmark: { name_cn: string; basis: string; run: string; pool: string; first: string; last: string; aligned: boolean };
  sections: Section[];
  notice: string;
  parts: Part[];
}

type Matrix<T> = (T | null)[][];

export interface MatrixData {
  schema_version: number;
  set_id: string;
  members: string[];
  signal_matrix: Record<Method, Record<Period, { mean_rho: Matrix<number>; months: Matrix<number>; mean_n: Matrix<number>; min_n: Matrix<number> }>>;
  member_months: Record<Period, Record<string, { months: number; first: string | null; last: string | null }>>;
  return_matrix: Record<Period, { pearson: Matrix<number>; n_months: Matrix<number> }>;
}

export interface RollingSeries {
  value: Num[];
  n_months: number[];
  first_valid: { signal_date: string; window_start: string; n_months: number } | null;
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
  rolling: Record<string, Record<string, RollingSeries>>;
  overlap: Record<string, OverlapSeries>;
  summary: Record<string, Record<"raw" | "excess", { pearson: Num; n_months: number }>>;
}

export interface ObjectInfo {
  excess_months: Record<"G10" | "G1", number>;
  excess_first: string | null;
  ic_valid_months: number;
  ic_first: string | null;
  ic_mean_n: Num;
}

export interface PairFile {
  schema_version: number;
  set_id: string;
  calendar: string[];
  objects: Record<string, ObjectInfo>;
  pairs: Record<string, PairData>;
}

export function loadIndex(): Promise<RelationshipsIndex> {
  return getJson<RelationshipsIndex>("factor_relationships/index.json");
}

const cache = new Map<string, Promise<unknown>>();
function cached<T>(file: string): Promise<T> {
  if (!cache.has(file)) cache.set(file, getJson<T>(`factor_relationships/${file}`));
  return cache.get(file) as Promise<T>;
}
export const loadMatrix = (file: string) => cached<MatrixData>(file);
export const loadPairs = (file: string) => cached<PairFile>(file);

const SWAP: Record<string, string> = { "G10-G10": "G10-G10", "G1-G1": "G1-G1", "G10-G1": "G1-G10", "G1-G10": "G10-G1", IC: "IC" };

/** Pairs are stored once in member order; (B, A) with "G10-G1" is the stored (A, B) "G1-G10". Lookup only. */
export function pairView(file: PairFile, order: string[], a: string, b: string, kind: string): { pair: PairData | undefined; key: string; swapped: boolean } {
  if (order.indexOf(a) <= order.indexOf(b)) return { pair: file.pairs[`${a}|${b}`], key: kind, swapped: false };
  return { pair: file.pairs[`${b}|${a}`], key: SWAP[kind], swapped: true };
}

export function ym(d: string | null | undefined): string {
  return d ? `${d.slice(0, 4)}-${d.slice(4, 6)}` : "—";
}
