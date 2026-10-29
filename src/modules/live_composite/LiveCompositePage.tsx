import { Fragment, useEffect, useMemo, useState } from "react";
import FactorChart, { type Series } from "../../shared/FactorChart";
import { MathBlock, SymbolList } from "../../shared/MathFormula";
import { num, pct, type Num } from "../../shared/format";
import { SCENARIOS, loadLiveIndex, loadStrategy, money, ymd, type LiveIndex, type Metrics, type Scenario, type StrategyData } from "./data";

type Tab = "performance" | "holdings" | "assumptions";

const COST_CN: Record<string, string> = {
  commission: "净佣金", 经手费: "经手费", 证管费: "证管费", 过户费: "过户费", 印花税: "印花税", execution_cost: "执行成本（模型假设）",
};
const SECTION_CN: Record<string, string> = {
  portfolio: "组合构建", universe: "股票池", signal: "信号与信息时点", execution: "模拟成交", corporate_actions: "公司行动",
  costs: "成本", benchmark: "参考组合", metrics: "指标口径", d01: "D01", timezone: "时区", daily_run_hour: "每日运行时间（北京时间，时）",
};

function daysBetween(a: string, b: Date): number {
  const d = new Date(`${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6)}T15:00:00+08:00`);
  return Math.floor((b.getTime() - d.getTime()) / 86400000);
}

function Value({ v }: { v: unknown }) {
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === "object") {
      return <ul className="scope-impacts">{v.map((x, i) => <li key={i}><Value v={x} /></li>)}</ul>;
    }
    return <>{v.map(String).join("；")}</>;
  }
  if (v && typeof v === "object") {
    return (
      <dl className="spec config-spec">
        {Object.entries(v as Record<string, unknown>).map(([k, x]) => (
          <Fragment key={k}><dt>{k}</dt><dd><Value v={x} /></dd></Fragment>
        ))}
      </dl>
    );
  }
  if (typeof v === "number" && !Number.isInteger(v)) return <>{String(Number(v.toPrecision(6)))}</>;
  return <>{String(v)}</>;
}

function MetricRow({ label, m, scen }: { label: string; m: Metrics; scen?: string }) {
  return (
    <tr>
      <td>{label}{scen ? `（${scen}）` : ""}</td>
      <td>{pct(m.return)}</td><td>{pct(m.benchmark_return)}</td><td>{pct(m.relative)}</td>
      <td>{num(m.sharpe)}</td><td>{pct(m.annualized_volatility)}</td><td>{pct(m.max_drawdown)}</td>
      <td>{pct(m.cash_ratio_last, 1)}</td><td>{num(m.turnover)}</td><td>{pct(m.fill_rate, 1)}</td><td>{money(m.costs_total)}</td>
    </tr>
  );
}

export default function LiveCompositePage() {
  const [index, setIndex] = useState<LiveIndex | null>(null);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState<StrategyData | null>(null);
  const [scenario, setScenario] = useState<Scenario>("base");
  const [tab, setTab] = useState<Tab>("performance");
  const [posDate, setPosDate] = useState("");
  const [batch, setBatch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadLiveIndex().then((ix) => {
      setIndex(ix);
      setSelected(ix.default_strategy);
    }).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setData(null);
    loadStrategy(selected).then((d) => {
      if (cancelled) return;
      setData(d);
      setPosDate(d.dates[d.dates.length - 1]);
      setBatch(d.batches.length ? d.batches[d.batches.length - 1].signal_date : "");
    }).catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const cats = useMemo(() => (data ? data.dates.map(ymd) : []), [data]);
  const navSeries = useMemo<Series[]>(() => data ? [
    { name: `${data.id} ${index?.scenarios[scenario] ?? ""}`, data: data.nav[scenario], color: "#1f4e79", width: 1.75 },
    { name: "全市场等权参考组合（不计成本）", data: data.benchmark, color: "#7f7f7f", width: 1.25 },
    { name: "沪深300价格指数（市场环境参考）", data: data.csi300, color: "#b0602a", width: 1.25, dashed: true },
  ] : [], [data, scenario, index]);
  const navTips = useMemo(() => (i: number) => data ? [
    `策略：${num(data.nav[scenario][i], 4)}`, `参考组合：${num(data.benchmark[i], 4)}`, `沪深300：${num(data.csi300[i], 4)}`,
    `现金比例：${pct(data.cash_ratio[i], 1)}`,
  ] : [], [data, scenario]);

  if (error) return <p className="error">{error}</p>;
  if (!index) return <p className="loading">加载中…</p>;

  const lag = daysBetween(index.data_through, new Date());
  const m = data?.metrics[scenario];
  const b = data?.batches.find((x) => x.signal_date === batch);
  const pos = data && posDate ? data.positions[posDate] : undefined;
  const industry = pos ? Object.entries(pos.rows.reduce<Record<string, number>>((acc, r) => {
    acc[r[2]] = (acc[r[2]] ?? 0) + (r[5] ?? 0);
    return acc;
  }, {})).sort((x, y) => y[1] - x[1]) : [];

  return (
    <>
      <section className="card research-scope" aria-labelledby="live-title">
        <h2 id="live-title">组合策略模拟表现</h2>
        <p className="tags">
          <span>历史模拟（historical simulation），非真实账户成交</span><span>不是严格样本外表现</span>
          <span>{lag > 3 ? `数据已 ${lag} 天未更新` : "数据按交易日更新"}</span>
        </p>
        <dl className="spec">
          <dt>账户起始日</dt><dd>{ymd(index.start_date)}（每个策略独立账户，初始现金 100 万元）</dd>
          <dt>数据截至交易日</dt><dd>{ymd(index.data_through)}（北京时间每日 08:00 起只使用此前已收盘且数据齐备的交易日）</dd>
          <dt>最近成功检查 / 数据更新</dt><dd>{index.status.last_check_beijing?.slice(0, 16).replace("T", " ")} / {index.status.data_updated_beijing?.slice(0, 16).replace("T", " ")}（北京时间；仅在发布时更新）</dd>
          <dt>版本</dt><dd>假设 {index.versions.assumptions}；策略 {index.versions.strategy}；模拟 run {index.run_id}</dd>
        </dl>
        <details>
          <summary>重要限制</summary>
          <ul className="scope-impacts">{index.limitations.map((x) => <li key={x}>{x}</li>)}</ul>
        </details>
      </section>

      <section className="card">
        <h2>12 个策略汇总（费后，执行成本 10bps；不足一年以区间收益为准）</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>策略</th><th>区间收益</th><th>参考组合</th><th>相对表现</th><th>日频 Sharpe</th><th>年化波动</th><th>最大回撤</th><th>期末现金</th><th>双边换手（倍）</th><th>成交率</th><th>累计成本（元）</th></tr></thead>
            <tbody>
              {index.summary.map((s) => (
                <tr key={s.id} className={s.id === selected ? "selected-row" : ""} onClick={() => setSelected(s.id)} style={{ cursor: "pointer" }}>
                  <td>{s.id} · {s.name_cn}</td>
                  <td>{pct(s.base.return)}</td><td>{pct(s.base.benchmark_return)}</td><td>{pct(s.base.relative)}</td>
                  <td>{num(s.base.sharpe)}</td><td>{pct(s.base.annualized_volatility)}</td><td>{pct(s.base.max_drawdown)}</td>
                  <td>{pct(s.base.cash_ratio_last, 1)}</td><td>{num(s.base.turnover)}</td><td>{pct(s.base.fill_rate, 1)}</td><td>{money(s.base.costs_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption">点击一行查看该策略。默认 C12；常用对照为 {index.focus_pair.join(" 与 ")}。各策略是独立账户，不合并为一个组合。</p>
      </section>

      <div className="filters">
        <label className="selector factor-select">
          <span>策略</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {index.summary.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name_cn}</option>)}
          </select>
        </label>
        {index.focus_pair.map((c) => <button key={c} className="chip" onClick={() => setSelected(c)}>{c}</button>)}
        <label className="selector">
          <span>成本情景</span>
          <select value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
            {SCENARIOS.map((s) => <option key={s} value={s}>{index.scenarios[s]}</option>)}
          </select>
        </label>
      </div>

      <nav className="tabs" aria-label="模拟视图">
        <button className={tab === "performance" ? "active" : ""} onClick={() => setTab("performance")}>表现与成本</button>
        <button className={tab === "holdings" ? "active" : ""} onClick={() => setTab("holdings")}>持仓与成交</button>
        <button className={tab === "assumptions" ? "active" : ""} onClick={() => setTab("assumptions")}>假设、公式与来源</button>
      </nav>

      {!data && <p className="loading">加载中…</p>}

      {data && m && tab === "performance" && (
        <div className="tab-body">
          <section className="card">
            <h2>{data.id} · {data.name_cn}：{index.scenarios[scenario]}</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>口径</th><th>区间收益</th><th>参考组合</th><th>相对表现</th><th>日频 Sharpe</th><th>年化波动</th><th>最大回撤</th><th>期末现金</th><th>双边换手（倍）</th><th>成交率</th><th>累计成本（元）</th></tr></thead>
                <tbody>{SCENARIOS.map((s) => <MetricRow key={s} label={index.scenarios[s]} m={data.metrics[s]} />)}</tbody>
              </table>
            </div>
            <p className="caption">
              区间 {ymd(index.start_date)} 至 {ymd(index.data_through)}，{m.trading_days} 个交易日（现金日计入）。
              {m.short_sample ? `样本不足一年：年化收益 ${pct(m.cagr)}（参考组合 ${pct(m.benchmark_cagr)}）仅作补充。` : `年化收益 ${pct(m.cagr)}。`}
              参考组合：Sharpe {num(m.benchmark_sharpe)}，年化波动 {pct(m.benchmark_annualized_volatility)}，最大回撤 {pct(m.benchmark_max_drawdown)}。{index.scenario_note}
            </p>
          </section>
          <section className="card">
            <FactorChart title="账户净值（起始 = 1，每日收盘）" categories={cats} series={navSeries} valueFormat="number" height={320} tooltipLines={navTips} />
            <FactorChart title={`日频回撤（${index.scenarios[scenario]}）`} categories={cats}
              series={[{ name: "回撤", data: data.drawdown[scenario], color: "#c0504d", width: 1.25 }]} valueFormat="percent" height={200} />
            <p className="caption">回撤基于每日收盘估值，不反映盘中回撤。参考组合为同一基础股票池的月度等权组合，不计成本；沪深300为价格指数，仅作市场环境参考。</p>
          </section>
          <section className="card">
            <h2>累计成本（元）</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>情景</th>{Object.keys(COST_CN).map((k) => <th key={k}>{COST_CN[k]}</th>)}<th>合计</th></tr></thead>
                <tbody>
                  {SCENARIOS.map((s) => (
                    <tr key={s}><td>{index.scenarios[s]}</td>
                      {Object.keys(COST_CN).map((k) => <td key={k}>{money(data.costs_by_scenario[s][k] ?? null)}</td>)}
                      <td>{money(data.metrics[s].costs_total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="caption">佣金、执行成本为模型假设，不是真实协议或已测得的滑点；规费与印花税按成交日适用标准计算。执行成本已体现在成交价中，表中单列以便核对，不重复收费。</p>
          </section>
        </div>
      )}

      {data && tab === "holdings" && (
        <div className="tab-body">
          <section className="card">
            <div className="card-head">
              <h2>按日期查看模拟持仓（费后 10bps 情景）</h2>
              <label className="selector">
                <span>日期</span>
                <select value={posDate} onChange={(e) => setPosDate(e.target.value)}>
                  {[...data.dates].reverse().map((d) => <option key={d} value={d}>{ymd(d)}</option>)}
                </select>
              </label>
            </div>
            {pos ? (
              <>
                <p>总资产 {money(pos.total)} 元；现金 {money(pos.cash)} 元（{pct(pos.cash / pos.total, 1)}）；应收股利 {money(pos.receivable)} 元；持仓 {pos.rows.length} 只。</p>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>代码</th><th>名称</th><th>行业</th><th>股数</th><th>市值（元）</th><th>权重</th><th>价格状态</th></tr></thead>
                    <tbody>{pos.rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{money(r[4])}</td><td>{pct(r[5])}</td><td>{r[6]}</td></tr>)}</tbody>
                  </table>
                </div>
                <h3>行业分布（按收盘市值）</h3>
                <p>{industry.map(([k, v]) => `${k} ${pct(v, 1)}`).join("；")}</p>
              </>
            ) : <p>该日无持仓（全部现金）。</p>}
          </section>
          <section className="card">
            <div className="card-head">
              <h2>调仓批次：目标、订单与成交</h2>
              <label className="selector">
                <span>批次</span>
                <select value={batch} onChange={(e) => setBatch(e.target.value)}>
                  {[...data.batches].reverse().map((x) => <option key={x.signal_date} value={x.signal_date}>{ymd(x.signal_date)}</option>)}
                </select>
              </label>
            </div>
            {b && (
              <>
                <p className="caption">目标名单不等于成交名单：订单可能因停牌、涨跌停、流动性上限、现金不足或 T+1 未成交、部分成交或顺延后撤销。目标按上一交易日收盘总资产 {money(b.nav_base)} 元与上一交易日收盘价计算，按申报单位向下取整：一手金额高于目标金额的股票目标为 0 股、该份额留现金；不足一个申报单位的增减不下单，差额留在持仓里。</p>
                <details open>
                  <summary>目标持仓（{b.targets.length} 只）</summary>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>排名</th><th>代码</th><th>名称</th><th>行业</th><th>组合分数</th><th>目标股数</th><th>目标权重</th></tr></thead>
                      <tbody>{b.targets.map((r) => <tr key={r[0]}><td>{r[4]}</td><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{num(r[3], 4)}</td><td>{r[5]}</td><td>{pct(r[6])}</td></tr>)}</tbody>
                    </table>
                  </div>
                </details>
                <details>
                  <summary>订单（{b.orders.length} 笔，含撤销与未完成）</summary>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>代码</th><th>名称</th><th>方向</th><th>订单股数</th><th>成交股数</th><th>状态</th><th>原因</th><th>尝试天数</th><th>结束日</th></tr></thead>
                      <tbody>{b.orders.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2] === "buy" ? "买入" : "卖出"}</td><td>{r[3]}</td><td>{r[4]}</td><td>{r[5]}</td><td>{r[6]}</td><td>{r[7]}</td><td>{ymd(r[8])}</td></tr>)}</tbody>
                    </table>
                  </div>
                </details>
                <details>
                  <summary>成交（{b.trades.length} 笔）</summary>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>日期</th><th>代码</th><th>名称</th><th>方向</th><th>股数</th><th>成交价</th><th>成交额</th><th>佣金</th><th>规费</th><th>印花税</th><th>执行成本</th></tr></thead>
                      <tbody>{b.trades.map((r, i) => <tr key={i}><td>{ymd(r[0])}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3] === "buy" ? "买入" : "卖出"}</td><td>{r[4]}</td><td>{num(r[5] as Num, 3)}</td><td>{money(r[6] as Num)}</td><td>{money(r[7] as Num)}</td><td>{money(r[8] as Num)}</td><td>{money(r[9] as Num)}</td><td>{money(r[10] as Num)}</td></tr>)}</tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </section>
          <section className="card">
            <h2>公司行动与特殊事件</h2>
            {data.events.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>日期</th><th>代码</th><th>类型</th><th>持股</th><th>每股</th><th>金额 / 送转股</th><th>派息 / 上市日</th></tr></thead>
                  <tbody>{data.events.map((e, i) => (
                    <tr key={i}><td>{ymd(String(e.date))}</td><td>{e.ts_code}</td>
                      <td>{e.type === "cash_dividend" ? "现金分红" : e.type === "stock_dividend" ? "送转股" : "复权因子变动无法由分红送转解释"}</td>
                      <td>{e.shares ?? "—"}</td><td>{e.per_share ?? e.adj_ratio ?? "—"}</td><td>{e.amount ?? e.bonus_shares ?? "—"}</td><td>{ymd(String(e.pay_date ?? e.listing_date ?? ""))}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p>本策略持仓期内没有分红送转记录。</p>}
          </section>
        </div>
      )}

      {tab === "assumptions" && (
        <div className="tab-body">
          <section className="card">
            <h2>公式与指标口径</h2>
            {index.formulas.map((f) => (
              <div key={f.id} className="formula-panel">
                <h3>{f.title}</h3>
                <MathBlock tex={f.tex} label={f.title} />
                <details className="formula-details">
                  <summary>符号与口径</summary>
                  <SymbolList symbols={f.symbols} />
                  <p className="formula-params">{f.note}</p>
                </details>
              </div>
            ))}
          </section>
          <section className="card">
            <h2>全部模拟假设（与运行记录同一份配置）</h2>
            {Object.entries(index.assumptions).map(([k, v]) => (
              <details key={k} open={k === "portfolio"}>
                <summary>{SECTION_CN[k] ?? k}</summary>
                <Value v={v} />
              </details>
            ))}
          </section>
          <section className="card">
            <h2>信号来源与对账</h2>
            <p>信号月：{index.signal_months.map((s) => ymd(s.signal_date)).join("、")}。每月信号首次计算后存档，此后不改写。</p>
            {index.signal_validation?.frozen_overlap && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>对象</th><th>与冻结研究重叠的信号月</th><th>最大绝对差</th><th>缺失位置不一致</th><th>仅一侧存在</th></tr></thead>
                  <tbody>{Object.entries(index.signal_validation.frozen_overlap).map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td>{v.months.map(ymd).join("、")}</td><td>{v.max_abs_diff.toExponential(2)}</td><td>{v.nan_pattern_mismatch}</td><td>{v.rows_only_one_side}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <p className="caption">2026 年 1–7 月信号由同一套代码重算，并与冻结组合研究逐值对账；此后月份由增量数据计算。网页只展示研究层输出，不重新计算因子或收益。</p>
          </section>
        </div>
      )}
    </>
  );
}
