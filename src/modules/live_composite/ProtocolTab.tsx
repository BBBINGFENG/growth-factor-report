import { Fragment } from "react";
import { ymd, bjTime, type LiveIndex } from "./data";
import { Formulas } from "./Diagnostics";

const SECTION_CN: Record<string, string> = {
  portfolio: "组合构建", universe: "股票池", signal: "信号与信息时点", execution: "模拟成交", corporate_actions: "公司行动",
  costs: "成本", benchmark: "参考组合", metrics: "指标口径", forward: "Forward 记录与盘前计划", d01: "D01", timezone: "时区",
  daily_run_hour: "每日运行时间（北京时间，时）",
};

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

export function ProtocolTab({ index }: { index: LiveIndex }) {
  const P = index.protocol;
  const fwd = index.records.forward;
  return (
    <div className="tab-body">
      <section className="card">
        <h2>研究方案（research protocol）</h2>
        <p className="caption">假设版本 {index.versions.assumptions}，策略版本 {index.versions.strategy}；规则冻结于北京时间 {bjTime(fwd.rules_frozen_at_beijing)}；forward 记录首个调仓日 {ymd(fwd.start_signal_date)}。</p>
        <div className="table-wrap"><table>
          <thead><tr><th>组合</th><th>角色</th><th>说明</th></tr></thead>
          <tbody>{P.roles.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td className="wrap-cell">{r[2]}</td></tr>)}</tbody>
        </table></div>
        <h3>研究假设</h3>
        <ul className="scope-impacts">{P.hypotheses.map((x) => <li key={x}>{x}</li>)}</ul>
        <h3>主比较与评价指标</h3>
        <p>主比较：{P.primary_comparison}</p>
        <ul className="scope-impacts">{P.metrics.map((x) => <li key={x}>{x}</li>)}</ul>
        {Object.entries(P.defined_vs_implementation).map(([k, v]) => (
          <Fragment key={k}><h3>{k}</h3><ul className="scope-impacts">{v.map((x) => <li key={x}>{x}</li>)}</ul></Fragment>
        ))}
        <h3>历史回放与 forward 记录</h3>
        <ul className="scope-impacts">{Object.entries(P.records).map(([k, v]) => <li key={k}><strong>{k}</strong>：{v}</li>)}</ul>
        <h3>规则冻结与变更</h3>
        <ul className="scope-impacts">{[P.freeze.replace("FORWARD.rules_frozen_at_beijing", bjTime(fwd.rules_frozen_at_beijing)), ...P.change_process].map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
      <section className="card">
        <h2>全部公式与指标口径</h2>
        <Formulas items={index.formulas} />
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
          <div className="table-wrap"><table>
            <thead><tr><th>对象</th><th>与冻结研究重叠的信号月</th><th>最大绝对差</th><th>缺失位置不一致</th><th>仅一侧存在</th></tr></thead>
            <tbody>{Object.entries(index.signal_validation.frozen_overlap).map(([k, v]) => (
              <tr key={k}><td>{k}</td><td>{v.months.map(ymd).join("、")}</td><td>{v.max_abs_diff.toExponential(2)}</td><td>{v.nan_pattern_mismatch}</td><td>{v.rows_only_one_side}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        <p className="caption">2026 年 1–7 月信号由同一套代码重算，并与冻结组合研究逐值对账；此后月份由增量数据计算。网页只展示研究层输出，不重新计算因子或收益。</p>
      </section>
    </div>
  );
}
