import { useEffect, useMemo, useState } from "react";
import FactorChart, { type Series } from "../../shared/FactorChart";
import { num, pct } from "../../shared/format";
import { CashTab, Formulas, LayersTab, RiskTab } from "./Diagnostics";
import { PlansTab } from "./PlansTab";
import { ProtocolTab } from "./ProtocolTab";
import { SCENARIOS, bjTime, loadLiveIndex, loadStrategy, money, ymd, type LiveIndex, type Metrics, type Scenario, type StrategyData } from "./data";

type Tab = "performance" | "layers" | "cash" | "risk" | "plans" | "protocol";
type Record_ = "replay" | "forward";

const TABS: { id: Tab; label: string; forward: boolean }[] = [
  { id: "performance", label: "表现概览", forward: true },
  { id: "layers", label: "三层对照", forward: false },
  { id: "cash", label: "现金与持仓偏差", forward: false },
  { id: "risk", label: "风险与损益来源", forward: false },
  { id: "plans", label: "计划与执行", forward: true },
  { id: "protocol", label: "研究方案与假设", forward: true },
];

const COST_CN: Record<string, string> = {
  commission: "净佣金", 经手费: "经手费", 证管费: "证管费", 过户费: "过户费", 印花税: "印花税", execution_cost: "执行成本（模型假设）",
};

function daysBetween(a: string, b: Date): number {
  const d = new Date(`${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6)}T15:00:00+08:00`);
  return Math.floor((b.getTime() - d.getTime()) / 86400000);
}

function MetricRow({ label, m }: { label: string; m: Metrics }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{pct(m.return)}</td><td>{pct(m.benchmark_return)}</td><td>{pct(m.relative)}</td>
      <td>{num(m.sharpe)}</td><td>{pct(m.annualized_volatility)}</td><td>{pct(m.max_drawdown)}</td>
      <td>{pct(m.cash_ratio_last, 1)}</td><td>{num(m.turnover)}</td><td>{pct(m.fill_rate, 1)}</td><td>{money(m.costs_total)}</td>
    </tr>
  );
}

const METRIC_HEAD = <tr><th>口径</th><th>区间收益</th><th>参考组合</th><th>相对表现</th><th>日频 Sharpe</th><th>年化波动</th><th>最大回撤</th><th>期末现金</th><th>双边换手（倍）</th><th>成交率</th><th>累计成本（元）</th></tr>;

export default function LiveCompositePage() {
  const [index, setIndex] = useState<LiveIndex | null>(null);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState<StrategyData | null>(null);
  const [scenario, setScenario] = useState<Scenario>("base");
  const [record, setRecord] = useState<Record_>("replay");
  const [tab, setTab] = useState<Tab>("performance");
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
    loadStrategy(selected).then((d) => !cancelled && setData(d)).catch((e: Error) => !cancelled && setError(e.message));
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
  const fwd = index.records.forward;
  const active = fwd.status === "active";
  const pc = index.primary_comparison;
  const visible = TABS.filter((t) => record === "replay" || t.forward);
  const current = visible.some((t) => t.id === tab) ? tab : "performance";
  const m = data?.metrics[scenario];

  return (
    <>
      <section className="card research-scope" aria-labelledby="live-title">
        <h2 id="live-title">组合策略模拟表现</h2>
        <p className="tags">
          <span>模拟成交，非真实账户</span><span>历史回放不是样本外表现</span>
          <span>{lag > 3 ? `距数据截至日已 ${lag} 天（含非交易日），请留意是否更新停滞` : "数据按交易日更新"}</span>
        </p>
        <dl className="spec">
          <dt>记录类型</dt><dd>历史回放：{ymd(index.start_date)} 起，每个策略独立账户、初始现金 100 万元，各月计划为事后重建。Forward 记录：{active ? `${ymd(fwd.start_signal_date)} 起，已执行 ${(fwd.executed ?? []).length} 次盘前计划` : `尚未开始（首个调仓日 ${ymd(fwd.start_signal_date)}，规则冻结于北京时间 ${bjTime(fwd.rules_frozen_at_beijing)}）`}</dd>
          <dt>数据截至交易日</dt><dd>{ymd(index.data_through)}（北京时间每日 08:00 起只使用此前已收盘且数据齐备的交易日）</dd>
          <dt>最近成功检查 / 数据更新</dt><dd>{bjTime(index.status.last_check_beijing)} / {bjTime(index.status.data_updated_beijing)}（北京时间；仅在发布时更新）</dd>
          <dt>版本</dt><dd>假设 {index.versions.assumptions}；策略 {index.versions.strategy}；模拟 run {index.run_id}</dd>
        </dl>
        <details>
          <summary>重要限制</summary>
          <ul className="scope-impacts">{index.limitations.map((x) => <li key={x}>{x}</li>)}</ul>
        </details>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>12 个策略汇总</h2>
          <nav className="tabs compact" aria-label="记录类型">
            <button className={record === "replay" ? "active" : ""} onClick={() => setRecord("replay")}>历史回放</button>
            <button className={record === "forward" ? "active" : ""} onClick={() => setRecord("forward")}>Forward 记录</button>
          </nav>
        </div>
        <p>主比较（预先指定）：{pc.strategy} 相对 {pc.control} 的可交易费后累计收益 = 历史回放 {pct(pc.replay)}；forward {pc.forward === null ? "尚未开始" : pct(pc.forward)}。{pc.definition}。</p>
        {record === "forward" && !active ? (
          <p className="notice">Forward 记录尚未开始：首个调仓日为 {ymd(fwd.start_signal_date)}，计划须在当日北京时间 {fwd.rules.decision_deadline_beijing} 前生成并保存；开始前不显示任何业绩。{fwd.rules.start_rule}。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>策略</th><th>区间收益</th><th>参考组合</th><th>相对表现</th><th>日频 Sharpe</th><th>年化波动</th><th>最大回撤</th><th>期末现金</th><th>双边换手（倍）</th><th>成交率</th><th>累计成本（元）</th></tr></thead>
              <tbody>
                {index.summary.map((s) => {
                  const x = record === "forward" ? s.forward : s.base;
                  return (
                    <tr key={s.id} className={s.id === selected ? "selected-row" : ""} onClick={() => setSelected(s.id)} style={{ cursor: "pointer" }}>
                      <td>{s.id} · {s.name_cn}</td>
                      {x ? <><td>{pct(x.return)}</td><td>{pct(x.benchmark_return)}</td><td>{pct(x.relative)}</td>
                        <td>{num(x.sharpe)}</td><td>{pct(x.annualized_volatility)}</td><td>{pct(x.max_drawdown)}</td>
                        <td>{pct(x.cash_ratio_last, 1)}</td><td>{num(x.turnover)}</td><td>{pct(x.fill_rate, 1)}</td><td>{money(x.costs_total)}</td></> : <td colSpan={10}>—</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="caption">费后（执行成本 10bps）；不足一年以区间收益为准。点击一行查看该策略。默认 C12（主研究策略），C10 为对照、C13 为补充；其余为观察对象。各策略是独立账户，不合并为一个组合。</p>
      </section>

      <div className="filters">
        <label className="selector factor-select">
          <span>策略</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {index.summary.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name_cn}</option>)}
          </select>
        </label>
        {[index.default_strategy, ...index.focus_pair].map((c) => <button key={c} className={`chip${c === selected ? " active" : ""}`} onClick={() => setSelected(c)}>{c}</button>)}
        {record === "replay" && current === "performance" && (
          <label className="selector">
            <span>成本情景</span>
            <select value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
              {SCENARIOS.map((s) => <option key={s} value={s}>{index.scenarios[s]}</option>)}
            </select>
          </label>
        )}
      </div>

      <nav className="tabs" aria-label="模拟视图">
        {visible.map((t, i) => (
          <button key={t.id} className={`${current === t.id ? "active" : ""}${i === 1 && record === "replay" ? " tab-group-start" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
      {record === "replay" && ["layers", "cash", "risk"].includes(current) && <p className="caption">研究诊断：基于历史回放账户，用于理解实现偏差与收益来源，不用于调整策略。</p>}

      {!data && current !== "protocol" && <p className="loading">加载中…</p>}

      {data && m && current === "performance" && record === "replay" && (
        <div className="tab-body">
          <section className="card">
            <h2>{data.id} · {data.name_cn}：{index.scenarios[scenario]}</h2>
            <div className="table-wrap">
              <table>
                <thead>{METRIC_HEAD}</thead>
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
            <FactorChart title={`日频回撤（${index.scenarios[scenario]}，初始资金计入高水位）`} categories={cats}
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
            <Formulas items={index.formulas.filter((f) => f.section === "performance")} />
          </section>
        </div>
      )}

      {data && current === "performance" && record === "forward" && (
        <div className="tab-body">
          <section className="card">
            <h2>{data.id} · {data.name_cn}：forward 记录</h2>
            {data.forward.status === "active" && data.forward.metrics && data.forward.dates ? (
              <>
                <div className="table-wrap"><table><thead>{METRIC_HEAD}</thead><tbody><MetricRow label="费后（执行成本 10bps）" m={data.forward.metrics} /></tbody></table></div>
                <FactorChart title="Forward 账户净值（起始 = 1）" categories={data.forward.dates.map(ymd)} valueFormat="number" height={300}
                  series={[{ name: data.id, data: data.forward.nav ?? [], color: "#1f4e79", width: 1.75 }, { name: "全市场等权参考组合（不计成本）", data: data.forward.benchmark ?? [], color: "#7f7f7f", width: 1.25 }]} />
                <FactorChart title="日频回撤（初始资金计入高水位）" categories={data.forward.dates.map(ymd)} valueFormat="percent" height={200}
                  series={[{ name: "回撤", data: data.forward.drawdown ?? [], color: "#c0504d", width: 1.25 }]} />
              </>
            ) : <p className="notice">尚未开始。首个调仓日 {ymd(fwd.start_signal_date)}；开始前不显示业绩，也不把历史回放拼接进 forward 记录。盘前计划生成后可在“计划与执行”查看。</p>}
          </section>
        </div>
      )}

      {data && current === "layers" && <LayersTab index={index} data={data} />}
      {data && current === "cash" && <CashTab key={data.id} index={index} data={data} />}
      {data && current === "risk" && <RiskTab key={data.id} index={index} data={data} />}
      {data && current === "plans" && <PlansTab key={`${data.id}-${record}`} index={index} data={data} record={record} />}
      {current === "protocol" && <ProtocolTab index={index} />}
    </>
  );
}
