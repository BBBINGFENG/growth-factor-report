import { useCallback, useEffect, useMemo, useState } from "react";
import FactorChart from "../../shared/FactorChart";
import { num, pct } from "../../shared/format";
import FormulaPanel from "./FormulaPanel";
import MatrixChart from "./MatrixChart";
import {
  PERIODS, loadIndex, loadMatrix, loadPairs, pairView, ym,
  type ListPair, type MatrixData, type Method, type PairFile, type Part, type Period, type RelationshipsIndex, type Section,
} from "./data";

const METHOD_CN: Record<Method, string> = { pearson: "Pearson", spearman: "Spearman", kendall: "Kendall tau-b" };
const ALL = "__all__";

function sub<T>(m: (T | null)[][], rows: number[], cols: number[]): (T | null)[][] {
  return rows.map((i) => cols.map((j) => m[i][j]));
}

function range(xs: (number | null)[]): string {
  const v = xs.filter((x): x is number => x !== null && x > 0);
  return v.length ? (Math.min(...v) === Math.max(...v) ? `${v[0]}` : `${Math.min(...v)}–${Math.max(...v)}`) : "—";
}

function breaks(ids: string[], groupOf: (id: string) => string): number[] {
  return ids.flatMap((id, k) => (k > 0 && groupOf(id) !== groupOf(ids[k - 1]) ? [k] : []));
}

export default function RelationshipsPage() {
  const [index, setIndex] = useState<RelationshipsIndex | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    loadIndex().then(setIndex).catch((e: Error) => setError(e.message));
  }, []);
  if (error) return <p className="error">{error}</p>;
  if (!index) return <p className="loading">加载中…</p>;
  return (
    <>
      <section className="card research-scope">
        <p>{index.notice}</p>
        <p className="caption">数据来源：Stage 7 观察诊断 run {index.run_id}（复用冻结基线 {index.baseline_run.split("/").pop()}）；网页只显示研究层结果，不计算相关、IC 或名单重合。</p>
      </section>
      {index.parts.map((part, k) => <PartView key={part.id} index={index} part={part} order={k + 1} />)}
    </>
  );
}

function PartView({ index, part, order }: { index: RelationshipsIndex; part: Part; order: number }) {
  const conf = index.config;
  const single = part.mode === "single_factor";
  const sec = (id: Section["id"]) => index.sections.find((s) => s.id === id)!;
  const member = useCallback((id: string) => part.members.find((m) => m.id === id)!, [part]);
  const groupName = (gid: string) => part.groups.find((g) => g.id === gid)?.name_cn ?? gid;
  const label = (id: string) => `${id} ${member(id).name_cn}`;
  const order_ = useMemo(() => part.members.map((m) => m.id), [part]);

  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [method, setMethod] = useState<Method>(conf.default_method);
  const [rowGroup, setRowGroup] = useState(ALL);
  const [colGroup, setColGroup] = useState(ALL);
  const [showRef, setShowRef] = useState(false);
  useEffect(() => {
    loadMatrix(part.matrix_file).then(setMatrix).catch(() => setMatrix(null));
  }, [part]);

  const shown = useMemo(() => order_.filter((id) => showRef || !part.default_hidden.includes(id)), [order_, part, showRef]);
  const rows = useMemo(() => (single && rowGroup !== ALL ? shown.filter((id) => member(id).group === rowGroup) : shown), [single, rowGroup, shown, member]);
  const cols = useMemo(() => (single && colGroup !== ALL ? shown.filter((id) => member(id).group === colGroup) : shown), [single, colGroup, shown, member]);
  const groupOf = (id: string) => member(id).group;

  // pair selection
  const [pairGroup, setPairGroup] = useState(single ? part.groups.find((g) => g.members.length >= 2)?.id ?? "" : "");
  const candidates = useMemo(() => (single ? part.groups.find((g) => g.id === pairGroup)?.members ?? [] : shown), [single, part, pairGroup, shown]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  useEffect(() => {
    if (candidates.length >= 2 && (!candidates.includes(a) || !candidates.includes(b) || a === b)) {
      setA(candidates[0]);
      setB(candidates[1]);
    }
  }, [candidates, a, b]);
  const pairFileName = single ? part.groups.find((g) => g.id === pairGroup)?.pair_file ?? null : part.pair_file;
  const [pairs, setPairs] = useState<PairFile | null>(null);
  useEffect(() => {
    if (!pairFileName) return;
    let cancelled = false;
    loadPairs(pairFileName).then((d) => !cancelled && setPairs(d)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pairFileName]);
  const [groupPair, setGroupPair] = useState<ListPair>("G10-G10");
  const [listPair, setListPair] = useState<ListPair>("G10-G10");
  const [windowLen, setWindowLen] = useState(conf.default_window);

  const plabel = (p: Period) => `${conf.period_labels[p]}（信号月${p === "before_2021" ? "早于" : "不早于"} ${conf.boundary}）`;
  const side = cols.length <= 13;

  function signalMatrix(p: Period) {
    if (!matrix) return null;
    const s = matrix.signal_matrix[method][p];
    const ri = rows.map((id) => matrix.members.indexOf(id));
    const ci = cols.map((id) => matrix.members.indexOf(id));
    const months = sub(s.months, ri, ci);
    const meanN = sub(s.mean_n, ri, ci);
    const minN = sub(s.min_n, ri, ci);
    const mm = matrix.member_months[p];
    const detail = (i: number, j: number) => {
      const ra = rows[i], cb = cols[j];
      const lines = [`${label(ra)} × ${label(cb)}`, `有效月份 ${months[i][j] ?? 0}`];
      if (meanN[i][j] !== null) lines.push(`平均共同股票 ${Math.round(meanN[i][j] as number)}，最少 ${minN[i][j]}`);
      else if (!mm[ra]?.months || !mm[cb]?.months) lines.push(`缺失原因：${[ra, cb].filter((x) => !mm[x]?.months).join("、")} 在本期没有可用信号（每月至少 ${conf.min_stocks} 只且有差异）`);
      else lines.push(`缺失原因：没有共同股票达到 ${conf.min_stocks} 只且双方有差异的月份`);
      return lines;
    };
    const valid = months.flatMap((r, i) => r.filter((_, j) => rows[i] !== cols[j]));
    return (
      <>
        <MatrixChart title={`${plabel(p)}：${METHOD_CN[method]} 期间平均相关`} rowLabels={rows} colLabels={cols} values={sub(s.mean_rho, ri, ci)}
          detail={detail} rowBreaks={breaks(rows, groupOf)} colBreaks={breaks(cols, groupOf)} />
        <p className="panel-meta">每对有效月份 {range(valid)}；灰色“—”为缺失（样本不足或无差异），不是 0；悬停可看样本数与缺失原因。</p>
      </>
    );
  }

  function returnMatrix(p: Period) {
    if (!matrix) return null;
    const r = matrix.return_matrix[p];
    const ri = rows.map((id) => matrix.members.indexOf(id));
    const ci = cols.map((id) => matrix.members.indexOf(id));
    const n = sub(r.n_months, ri, ci);
    const vals = sub(r.pearson, ri, ci);
    const detail = (i: number, j: number) => {
      const lines = [`${label(rows[i])} × ${label(cols[j])}`, `${rows[i] === cols[j] ? "有效月份" : "共同有效月份"} ${n[i][j] ?? 0}`];
      if (vals[i][j] === null) lines.push((n[i][j] ?? 0) < conf.return_min_months ? `缺失原因：少于 ${conf.return_min_months} 个月` : "缺失原因：收益无变化");
      return lines;
    };
    return (
      <>
        <MatrixChart title={`${plabel(p)}：月频 E1 多空收益 Pearson`} rowLabels={rows} colLabels={cols} values={vals}
          detail={detail} rowBreaks={breaks(rows, groupOf)} colBreaks={breaks(cols, groupOf)} />
        <p className="panel-meta">每对共同有效月份 {range(n.flatMap((x, i) => x.filter((_, j) => rows[i] !== cols[j])))}；少于 {conf.return_min_months} 个月或无变化记为灰色“—”。</p>
      </>
    );
  }

  const markerIndex = pairs ? pairs.calendar.findIndex((d) => d >= conf.boundary.replace(/-/g, "")) : -1;
  const markers = useMemo(() => (markerIndex > 0 ? [{ index: markerIndex, label: "2021 分界（窗口不重置）" }] : []), [markerIndex]);
  const pairReady = !!pairs && candidates.length >= 2 && candidates.includes(a) && candidates.includes(b) && a !== b && !!pairs.objects[a] && !!pairs.objects[b];

  function rollingPanel(kind: string) {
    if (!pairs) return null;
    const v = pairView(pairs, order_, a, b, kind);
    const s = v.pair?.rolling[v.key]?.[String(windowLen)];
    if (!s) return <div className="no-compare">无数据</div>;
    const cal = pairs.calendar;
    const [ga, gb] = kind === "IC" ? ["IC", "IC"] : kind.split("-");
    const valid = s.value.filter((x) => x !== null).length;
    const oa = pairs.objects[a], ob = pairs.objects[b];
    const sample = kind === "IC"
      ? `IC 样本：${a} 有效 ${oa.ic_valid_months} 个月（自 ${ym(oa.ic_first)}，平均 ${oa.ic_mean_n ?? "—"} 只）；${b} 有效 ${ob.ic_valid_months} 个月（自 ${ym(ob.ic_first)}，平均 ${ob.ic_mean_n ?? "—"} 只）；双方 IC 的股票样本可能不同。`
      : `超额收益样本：${a} ${ga} 有效 ${oa.excess_months[ga as "G10" | "G1"]} 个月；${b} ${gb} 有效 ${ob.excess_months[gb as "G10" | "G1"]} 个月。`;
    return (
      <>
        <FactorChart title={`${kind === "IC" ? `${a} 与 ${b} 的 IC 序列` : `${a} ${ga} 与 ${b} ${gb} 的分组超额收益`} 滚动相关（${windowLen} 个月，全时段）`}
          categories={cal.map(ym)} series={[{ name: kind === "IC" ? `${a} IC × ${b} IC` : `${a} ${ga} × ${b} ${gb}`, data: s.value, color: "#1f4e79" }]}
          valueFormat="number" yMin={-1} yMax={1} height={280} markers={markers}
          tooltipLines={(i) => i + 1 < windowLen
            ? [`warm-up：样本开头不足 ${windowLen} 个日历月，保持缺失`]
            : [`相关：${s.value[i] === null ? "缺失" : (s.value[i] as number).toFixed(3)}`, `窗口：${ym(cal[i + 1 - windowLen])} 至 ${ym(cal[i])}`,
               `窗口内共同有效月：${s.n_months[i]}${s.value[i] === null && s.n_months[i] < conf.rolling_min_months ? `（少于 ${conf.rolling_min_months}，缺失）` : ""}`]} />
        <p className="panel-meta">
          {s.first_valid
            ? `首个有效结果 ${ym(s.first_valid.signal_date)}（窗口 ${ym(s.first_valid.window_start)} 至 ${ym(s.first_valid.signal_date)}，共同有效月 ${s.first_valid.n_months}）；`
            : "没有有效窗口；"}
          有效窗口 {valid} / {cal.length} 个月末；前 {windowLen - 1} 个月为 warm-up。横轴为信号月，窗口内各月收益事后才实现。{sample}
        </p>
      </>
    );
  }

  function summaryTable() {
    if (!pairs) return null;
    const v = pairView(pairs, order_, a, b, groupPair);
    const s = v.pair?.summary[v.key];
    if (!s) return null;
    const [ga, gb] = groupPair.split("-");
    return (
      <details className="formula-details">
        <summary>数值对照：原始分组收益与超额收益的全样本相关</summary>
        <div className="table-wrap">
          <table>
            <thead><tr><th>序列</th><th>全样本 Pearson</th><th>共同有效月</th></tr></thead>
            <tbody>
              <tr><td>{a} {ga} 与 {b} {gb}：原始分组收益</td><td>{num(s.raw.pearson, 3)}</td><td>{s.raw.n_months}</td></tr>
              <tr><td>{a} {ga} 与 {b} {gb}：超额收益（减 {index.benchmark.name_cn}）</td><td>{num(s.excess.pearson, 3)}</td><td>{s.excess.n_months}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="caption">原始分组收益相关包含两边共同的市场波动；减去共同参考后仍可能保留 beta 或风格暴露。此表为全样本单一数值，不是滚动结果。</p>
      </details>
    );
  }

  function overlapPanel() {
    if (!pairs) return null;
    const v = pairView(pairs, order_, a, b, listPair);
    const s = v.pair?.overlap[v.key];
    if (!s) return <div className="no-compare">无数据</div>;
    const nA = v.swapped ? s.n_b : s.n_a;
    const nB = v.swapped ? s.n_a : s.n_b;
    const cnt = (x: number | null) => (x === null ? "未知" : `${x}`);
    const [la, lb] = listPair.split("-");
    const ok = s.jaccard.filter((x) => x !== null).length;
    return (
      <>
        <FactorChart title={`${a} ${la} 名单与 ${b} ${lb} 名单的 Jaccard（逐月，全时段）`} categories={pairs.calendar.map(ym)}
          series={[{ name: `${a} ${la} × ${b} ${lb}`, data: s.jaccard, color: "#1f4e79" }]} valueFormat="percent" yMin={0} yMax={1} height={260} markers={markers}
          tooltipLines={(i) => [
            `Jaccard：${s.jaccard[i] === null ? "不可比较" : pct(s.jaccard[i], 1)}`,
            `${a} 名单 ${cnt(nA[i])} 只，${b} 名单 ${cnt(nB[i])} 只`, `交集 ${cnt(s.intersection[i])}，并集 ${cnt(s.union[i])}`,
          ]} />
        <p className="panel-meta">可比较月份 {ok} / {s.jaccard.length}；任一侧当月没有名单时为空缺（不按 0 或 100% 处理），提示框仍给出真实的名单数量。</p>
      </>
    );
  }

  const selectedNotes = part.members.filter((m) => (m.id === a || m.id === b) && (m.role_note || m.sample_note || m.inherits_d01));

  return (
    <>
      <section className="card part-head">
        <h2>第{order === 1 ? "一" : "二"}部分：{single ? "单因子之间的关系" : "组合因子之间的关系"}</h2>
        <p>{part.note}</p>
        {single && (
          <p className="caption">类别：{part.groups.map((g) => `${g.name_cn} ${g.members.join("、")}`).join("；")}。</p>
        )}
      </section>

      <section className="card">
        <FormulaPanel section={sec("signal")} method={method}
          params={[`方法 ${METHOD_CN[method]}`, `每月共同股票 ≥ ${conf.min_stocks} 只`, "矩阵 = 期间内有效月度系数的等权平均", single ? "单因子信号为方向统一后的实际评估信号" : "组合为冻结组合分数"]} />
        <div className="relationship-controls">
          <label className="selector">
            <span>相关方法</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
              {conf.signal_methods.map((m) => <option key={m} value={m}>{METHOD_CN[m]}</option>)}
            </select>
          </label>
          {single && (
            <>
              <label className="selector">
                <span>行（类别）</span>
                <select value={rowGroup} onChange={(e) => setRowGroup(e.target.value)}>
                  <option value={ALL}>全部 {part.members.length} 个</option>
                  {part.groups.map((g) => <option key={g.id} value={g.id}>{g.name_cn}（{g.members.length}）</option>)}
                </select>
              </label>
              <label className="selector">
                <span>列（类别）</span>
                <select value={colGroup} onChange={(e) => setColGroup(e.target.value)}>
                  <option value={ALL}>全部 {part.members.length} 个</option>
                  {part.groups.map((g) => <option key={g.id} value={g.id}>{g.name_cn}（{g.members.length}）</option>)}
                </select>
              </label>
            </>
          )}
          {!single && part.default_hidden.length > 0 && (
            <label className="selector checkbox">
              <input type="checkbox" checked={showRef} onChange={(e) => setShowRef(e.target.checked)} />
              <span>显示 D01（估值参考，受限研究基线；不算成长组合）</span>
            </label>
          )}
        </div>
        {single && <p className="caption">粗线为类别分界。选“行”“列”类别可只看类内或两类之间的局部；矩阵较大时在框内横向滚动。</p>}
        {!matrix ? <p className="loading">加载中…</p> : <div className={side ? "pair-grid" : "matrix-stack"}>{PERIODS.map((p) => <div key={p}>{signalMatrix(p)}</div>)}</div>}
      </section>

      <section className="card">
        <FormulaPanel section={sec("returns")} params={["冻结月频 E1 多空收益（G10−G1）", "分期内时间序列 Pearson", `共同有效月份 ≥ ${conf.return_min_months}`]} />
        {matrix && <div className={side ? "pair-grid" : "matrix-stack"}>{PERIODS.map((p) => <div key={p}>{returnMatrix(p)}</div>)}</div>}
      </section>

      <section className="card pair-controls">
        <h3>配对诊断：{single ? "选择类别与 Factor A、Factor B" : "选择 Composite A、Composite B"}</h3>
        <div className="relationship-controls">
          {single && (
            <label className="selector">
              <span>类别</span>
              <select value={pairGroup} onChange={(e) => setPairGroup(e.target.value)}>
                {part.groups.map((g) => <option key={g.id} value={g.id} disabled={g.members.length < 2}>{g.name_cn}（{g.members.length}）{g.members.length < 2 ? "：类内不足两个因子" : ""}</option>)}
              </select>
            </label>
          )}
          {candidates.length >= 2 && (
            <>
              <label className="selector">
                <span>{single ? "Factor A" : "Composite A"}</span>
                <select value={a} onChange={(e) => setA(e.target.value)}>
                  {candidates.filter((m) => m !== b).map((m) => <option key={m} value={m}>{label(m)}</option>)}
                </select>
              </label>
              <label className="selector">
                <span>{single ? "Factor B" : "Composite B"}</span>
                <select value={b} onChange={(e) => setB(e.target.value)}>
                  {candidates.filter((m) => m !== a).map((m) => <option key={m} value={m}>{label(m)}</option>)}
                </select>
              </label>
            </>
          )}
          <label className="selector">
            <span>滚动窗口（③④共用）</span>
            <select value={windowLen} onChange={(e) => setWindowLen(Number(e.target.value))}>
              {conf.rolling_windows.map((w) => <option key={w} value={w}>{w} 个月</option>)}
            </select>
          </label>
        </div>
        {single && part.groups.some((g) => g.members.length < 2) && (
          <p className="caption">{part.groups.filter((g) => g.members.length < 2).map((g) => `${g.name_cn}只有 ${g.members[0]}`).join("；")}，类内没有可比较的配对，不生成重复或虚构的配对；它仍出现在上面的跨类别矩阵中。</p>
        )}
        <p className="caption">A/B 默认取{single ? "所选类别内" : ""}编号最前的两个，只是展示默认，不代表推荐。{single ? `当前类别：${groupName(pairGroup)}。` : ""}</p>
        {selectedNotes.map((m) => (
          <p key={m.id} className="caption">{m.id}：{[m.role_note, m.sample_note && `${m.sample_note}；③ 减去的是共同的全市场等权参考，不是其自身股票池的基准`, m.inherits_d01 && "依赖 D01，继承其 PIT、股票池与历史覆盖限制"].filter(Boolean).join("；")}。</p>
        ))}
      </section>

      {!pairReady ? (
        <section className="card"><p className="loading">{candidates.length < 2 ? "所选范围内不足两个有效对象，无法配对。" : "加载中…"}</p></section>
      ) : (
        <>
          <section className="card">
            <FormulaPanel section={sec("group")}
              params={[`A 的 ${groupPair.split("-")[0]} 对 B 的 ${groupPair.split("-")[1]}`, `基准 ${index.benchmark.name_cn}（${ym(index.benchmark.first)} 至 ${ym(index.benchmark.last)}，与分组收益同一信号月、同一 E1 区间）`,
                `窗口 ${windowLen} 个连续日历月，2021 年不重新起算`, `窗口内共同有效月 ≥ ${conf.rolling_min_months}`]} />
            <label className="selector">
              <span>分组配对</span>
              <select value={groupPair} onChange={(e) => setGroupPair(e.target.value as ListPair)}>
                {conf.group_pairs.map((g) => <option key={g} value={g}>{g.replace("-", "–")}</option>)}
              </select>
            </label>
            {rollingPanel(groupPair)}
            {summaryTable()}
          </section>

          <section className="card">
            <FormulaPanel section={sec("ic")}
              params={["正式月度 Rank IC（方向统一，有效股票 ≥ 30）", `窗口 ${windowLen} 个连续日历月，2021 年不重新起算`, `窗口内共同有效月 ≥ ${conf.rolling_min_months}`, "双方 IC 的股票样本可能不同"]} />
            {rollingPanel("IC")}
          </section>

          <section className="card">
            <FormulaPanel section={sec("overlap")}
              params={[`A 的 ${listPair.split("-")[0]} 名单对 B 的 ${listPair.split("-")[1]} 名单`, "Jaccard = 交集股票数 ÷ 并集股票数", "逐月指标，不做滚动", "目标分组名单，不是成交持仓"]} />
            <label className="selector">
              <span>名单配对</span>
              <select value={listPair} onChange={(e) => setListPair(e.target.value as ListPair)}>
                {conf.group_pairs.map((g) => <option key={g} value={g}>{g.replace("-", "–")}</option>)}
              </select>
            </label>
            {overlapPanel()}
          </section>
        </>
      )}
    </>
  );
}
