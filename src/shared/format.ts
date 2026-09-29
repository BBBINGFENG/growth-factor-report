export type Num = number | null;

export function pct(v: Num, digits = 2): string {
  return v === null ? "—" : `${(v * 100).toFixed(digits)}%`;
}

export function num(v: Num, digits = 2): string {
  return v === null ? "—" : v.toFixed(digits);
}

const base = import.meta.env.BASE_URL;

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}data/${path}`);
  if (!res.ok) throw new Error(`无法读取 ${path}（HTTP ${res.status}）`);
  return (await res.json()) as T;
}
