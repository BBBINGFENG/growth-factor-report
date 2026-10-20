import { useCallback, useEffect, useMemo, useState } from "react";
import FactorChart from "../../shared/FactorChart";
import { pct } from "../../shared/format";
import FormulaPanel from "./FormulaPanel";
import MatrixChart from "./MatrixChart";
import {
  PERIODS, loadIndex, loadSet, pairView, ym,
  type ListPair, type Method, type Period, type RelationshipsIndex, type Section, type SetData, type SetEntry,
} from "./data";

type Mode = "single_factor" | "composite";
const METHOD_CN: Record<Method, string> = { pearson: "Pearson", spearman: "Spearman", kendall: "Kendall tau-b" };

function sub<T>(m: (T | null)[][] | undefined, idx: number[]): (T | null)[][] {
  return idx.map((i) => idx.map((j) => (m ? m[i][j] : null)));
}

function range(xs: number[]): string {
  const v = xs.filter((x) => x > 0);
  return v.length ? (Math.min(...v) === Math.max(...v) ? `${v[0]}` : `${Math.min(...v)}–${Math.max(...v)}`) : "—";
}

export default function RelationshipsPage() {
  const [index, setIndex] = useState<RelationshipsIndex | null>(null);
  const [mode, setMode] = useState<Mode>("single_factor");
  const [categoryId, setCategoryId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<SetData | null>(null);
  const [method, setMethod] = useState<Method>("spearman");
  const [windowLen, setWindowLen] = useState(36);
  const [groupPair, setGroupPair] = useState<ListPair>("G10-G10");
  const [listPair, setListPair] = useState<ListPair>("G10-G10");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadIndex()
      .then((ix) => {
        setIndex(ix);
        setMethod(ix.config.default_method);
        setWindowLen(ix.config.default_window);
        setCategoryId(ix.sets.find((s) => s.mode === "single_factor")!.id);
        setPicked(ix.sets.find((s) => s.mode === "composite")!.default_members);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const entry: SetEntry | undefined = useMemo(() => {
    if (!index) return undefined;
    return mode === "composite" ? index.sets.find((s) => s.mode === "composite") : index.sets.find((s) => s.id === categoryId);
  }, [index, mode, categoryId]);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    loadSet(entry).then((d) => !cancelled && setLoaded(d)).catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const visible = useMemo(() => {
    if (!entry) return [];
    const all = entry.members.map((m) => m.id);
    return mode === "composite" ? all.filter((m) => picked.includes(m)) : all;
  }, [entry, mode, picked]);

  useEffect(() => {
    if (visible.length >= 2 && (!visible.includes(a) || !visible.includes(b) || a === b)) {
      setA(visible[0]);
      setB(visible[1]);
    }
  }, [visible, a, b]);

  // Ignore the previous set until the current one has loaded, so indices never mix sets.
  const data = loaded && entry && loaded.set_id === entry.id ? loaded : null;

  const name = useCallback((id: string) => entry?.members.find((m) => m.id === id)?.name_cn ?? id, [entry]);
  const sec = (id: Section["id"]) => index!.sections.find((s) => s.id === id)!;
  const cfg = index?.config;
  const idx = data ? visible.map((m) => data.members.indexOf(m)) : [];

  if (error) return <p className="error">{error}</p>;
  if (!index || !cfg) return <p className="loading">加载中…</p>;
  const conf: RelationshipsIndex["config"] = cfg;

  const comparable = entry?.comparable && visible.length >= 2;
  const shown = entry ? (mode === "composite" ? entry.members.filter((m) => picked.includes(m.id)) : entry.members) : [];
  const abReady = visible.includes(a) && visible.includes(b) && a !== b;
  const plabel = (p: Period) => `${conf.period_labels[p]}（${p === "before_2021" ? "信号月早于" : "信号月不早于"} ${conf.boundary}）`;

  function matrixPanel(p: Period, kind: "signal" | "returns") {
    if (!data) return null;
    const labels = visible;
    if (kind === "signal") {
      const s = data.signal_matrix![method][p];
      const months = sub(s.months, idx);
      const off = months.flatMap((row, i) => row.filter((_, j) => j !== i)).map((x) => (x ?? 0) as number);
      return (
        <>
          <MatrixChart title={`${plabel(p)}：${METHOD_CN[method]} 期间平均相关`} labels={labels} values={sub(s.mean_rho, idx)}
            detail={(i, j) => {
              const mn = sub(s.mean_n, idx)[i][j];
              return [`有效月份 ${months[i][j] ?? 0}`, mn === null ? "没有有效月份" : `平均共同股票 ${Math.round(mn)}，最少 ${sub(s.min_n, idx)[i][j]}`];
            }} />
          <p className="panel-meta">样本：每对有效月份 {range(off)}；灰色“—”为样本不足或无差异，不是 0。</p>
        </>
      );
    }
    const r = data.return_matrix![p];
    const n = sub(r.n_months, idx);
    const off = n.flatMap((row, i) => row.filter((_, j) => j !== i)).map((x) => (x ?? 0) as number);
    return (
      <>
        <MatrixChart title={`${plabel(p)}：月频 E1 多空收益 Pearson`} labels={labels} values={sub(r.pearson, idx)}
          detail={(i, j) => [`${i === j ? "有效月份" : "共同有效月份"} ${n[i][j] ?? "—"}`, `至少 ${conf.return_min_months} 个月且收益有变化才计算`]} />
        <p className="panel-meta">样本：每对共同有效月份 {range(off)}；少于 {conf.return_min_months} 个月或无变化记为灰色“—”，对角线同样按此规则。</p>
      </>
    );
  }

  function rollingPanel(p: Period, kind: string) {
    if (!data) return null;
    const v = pairView(data, a, b, kind);
    const series = v.pair?.rolling[v.key]?.[String(windowLen)]?.[p];
    if (!series) return <div className="no-compare">无数据</div>;
    const valid = series.value.filter((x) => x !== null).length;
    const icA = data.ic_samples?.[a]?.[p];
    const icB = data.ic_samples?.[b]?.[p];
    return (
      <>
        <FactorChart title={`${plabel(p)}：${kind === "IC" ? "IC 序列" : kind.replace("-", " 对 ")} 滚动相关（${windowLen} 个月）`}
          categories={data.dates[p].map(ym)} series={[{ name: `${a} × ${b}`, data: series.value, color: "#1f4e79" }]}
          valueFormat="number" yMin={-1} yMax={1} height={260}
          tooltipLines={(i) => [`相关：${series.value[i] === null ? "缺失" : (series.value[i] as number).toFixed(3)}`, `窗口内共同有效月：${series.n_months[i]}`]} />
        <p className="panel-meta">
          有效窗口 {valid} / {series.value.length} 个月末；窗口内共同有效月 {range(series.n_months)}。
          {kind === "IC" && ` IC 样本：${a} 有效 ${icA?.valid_months ?? 0} 个月、平均 ${icA?.mean_n ?? "—"} 只；${b} 有效 ${icB?.valid_months ?? 0} 个月、平均 ${icB?.mean_n ?? "—"} 只。`}
        </p>
      </>
    );
  }

  function overlapPanel(p: Period) {
    if (!data) return null;
    const v = pairView(data, a, b, listPair);
    const s = v.pair?.overlap[v.key]?.[p];
    if (!s) return <div className="no-compare">无数据</div>;
    const nA = v.swapped ? s.n_b : s.n_a;
    const nB = v.swapped ? s.n_a : s.n_b;
    const cnt = (x: number | null) => (x === null ? "未知" : `${x}`);
    const ok = s.jaccard.filter((x) => x !== null).length;
    return (
      <>
        <FactorChart title={`${plabel(p)}：${listPair.replace("-", " 名单对 ")} 名单 Jaccard`} categories={data.dates[p].map(ym)}
          series={[{ name: `${a} × ${b}`, data: s.jaccard, color: "#1f4e79" }]} valueFormat="percent" yMin={0} yMax={1} height={260}
          tooltipLines={(i) => [
            `Jaccard：${s.jaccard[i] === null ? "不可比较" : pct(s.jaccard[i], 1)}`,
            `${a} 名单 ${cnt(nA[i])} 只，${b} 名单 ${cnt(nB[i])} 只`, `交集 ${cnt(s.intersection[i])}，并集 ${cnt(s.union[i])}`,
          ]} />
        <p className="panel-meta">可比较月份 {ok} / {s.jaccard.length}；任一侧无有效名单的月份为空缺，不按 100% 或 0 处理。</p>
      </>
    );
  }

  const pair = (render: (p: Period) => JSX.Element | null) => (
    <div className="pair-grid">{PERIODS.map((p) => <div key={p}>{render(p)}</div>)}</div>
  );

  return (
    <>
      <section className="card research-scope">
        <p>{index.notice}</p>
        <p className="caption">数据来源：Stage 7 观察诊断 run {index.run_id}（复用冻结基线 {index.baseline_run.split("/").pop()}）；网页不计算相关、IC 或名单重合。</p>
      </section>

      <section className="card relationship-controls">
        <label className="selector">
          <span>分析模式</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="single_factor">按类别查看单因子</option>
            <option value="composite">比较组合因子</option>
          </select>
        </label>
        {mode === "single_factor" && (
          <label className="selector">
            <span>类别</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {index.sets.filter((s) => s.mode === "single_factor").map((s) => (
                <option key={s.id} value={s.id}>{s.name_cn}（{s.members.length}）</option>
              ))}
            </select>
          </label>
        )}
        {mode === "composite" && entry && (
          <div className="member-picks" aria-label="组合对象">
            {entry.members.map((m) => (
              <label key={m.id} title={m.role_note ?? ""}>
                <input type="checkbox" checked={picked.includes(m.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id))} />
                {m.id}{m.role === "intermediate" ? "（中间项）" : m.role === "limited_research_baseline" ? "（受限基线）" : ""}
              </label>
            ))}
          </div>
        )}
        {comparable && (
          <>
            <label className="selector">
              <span>因子 A</span>
              <select value={a} onChange={(e) => setA(e.target.value)}>
                {visible.filter((m) => m !== b).map((m) => <option key={m} value={m}>{m} · {name(m)}</option>)}
              </select>
            </label>
            <label className="selector">
              <span>因子 B</span>
              <select value={b} onChange={(e) => setB(e.target.value)}>
                {visible.filter((m) => m !== a).map((m) => <option key={m} value={m}>{m} · {name(m)}</option>)}
              </select>
            </label>
          </>
        )}
        {entry && (
          <p className="caption">
            对象：{shown.map((m) => `${m.id} ${m.name_cn}`).join("；")}。
            {shown.filter((m) => m.role_note).map((m) => `${m.id} ${m.role_note}。`).join("")}
            {comparable && "A/B 默认取当前集合编号最前的两个，只是展示默认，不代表推荐；③④⑤ 共用 A/B。"}
          </p>
        )}
      </section>

      {entry && !comparable && (
        <section className="card"><div className="no-compare">{mode === "composite" ? "已选对象少于 2 个，无比较对象。" : `无类内比较对象（${entry.name_cn}只有 ${entry.members.length} 个因子）。`}</div></section>
      )}

      {comparable && !(data && abReady) && <p className="loading">加载中…</p>}

      {comparable && data && abReady && (
        <>
          <section className="card">
            <FormulaPanel section={sec("signal")} method={method} params={[`方法 ${METHOD_CN[method]}`, `每月共同股票 ≥ ${conf.min_stocks} 只`, "矩阵 = 期间内有效月度系数的等权平均"]} />
            <label className="selector">
              <span>相关方法</span>
              <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                {conf.signal_methods.map((m) => <option key={m} value={m}>{METHOD_CN[m]}</option>)}
              </select>
            </label>
            {pair((p) => matrixPanel(p, "signal"))}
          </section>

          <section className="card">
            <FormulaPanel section={sec("returns")} params={["冻结月频 E1 多空收益（G10−G1）", "Pearson", `共同有效月份 ≥ ${conf.return_min_months}`]} />
            {pair((p) => matrixPanel(p, "returns"))}
          </section>

          <section className="card">
            <FormulaPanel section={sec("group")} params={[`A 的 ${groupPair.split("-")[0]} 对 B 的 ${groupPair.split("-")[1]}`, `窗口 ${windowLen} 个连续日历月，不跨 ${conf.boundary}`, `窗口内共同有效月 ≥ ${conf.rolling_min_months}`]} />
            <div className="relationship-controls">
              <label className="selector">
                <span>分组配对</span>
                <select value={groupPair} onChange={(e) => setGroupPair(e.target.value as ListPair)}>
                  {conf.group_pairs.map((g) => <option key={g} value={g}>{g.replace("-", "–")}</option>)}
                </select>
              </label>
              <label className="selector">
                <span>滚动窗口（③④共用）</span>
                <select value={windowLen} onChange={(e) => setWindowLen(Number(e.target.value))}>
                  {conf.rolling_windows.map((w) => <option key={w} value={w}>{w} 个月</option>)}
                </select>
              </label>
            </div>
            {pair((p) => rollingPanel(p, groupPair))}
          </section>

          <section className="card">
            <FormulaPanel section={sec("ic")} params={["正式月度 Rank IC（方向统一，有效股票 ≥ 30）", `窗口 ${windowLen} 个连续日历月，不跨 ${conf.boundary}`, `窗口内共同有效月 ≥ ${conf.rolling_min_months}`, "双方 IC 的股票样本可能不同"]} />
            {pair((p) => rollingPanel(p, "IC"))}
          </section>

          <section className="card">
            <FormulaPanel section={sec("overlap")} params={[`A 的 ${listPair.split("-")[0]} 名单对 B 的 ${listPair.split("-")[1]} 名单`, "Jaccard = 交集股票数 ÷ 并集股票数", "目标分组名单，不是成交持仓"]} />
            <label className="selector">
              <span>名单配对</span>
              <select value={listPair} onChange={(e) => setListPair(e.target.value as ListPair)}>
                {conf.group_pairs.map((g) => <option key={g} value={g}>{g.replace("-", "–")}</option>)}
              </select>
            </label>
            {pair((p) => overlapPanel(p))}
          </section>
        </>
      )}
    </>
  );
}
