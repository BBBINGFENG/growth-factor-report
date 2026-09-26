import { useMemo } from "react";
import FactorChart from "./FactorChart";
import { metricValue, num, pct, type FactorReport } from "./factorData";

export default function CorePerformance({ report }: { report: FactorReport }) {
  const { definition: d, core_performance: core, notes } = report;
  const groups = core.decile_returns.filter((r) => r.group !== "G10−G1");
  const longShort = core.decile_returns.find((r) => r.group === "G10−G1");

  const decileSeries = useMemo(
    () => [{ name: "年化收益", type: "bar" as const, data: groups.map((r) => r.arithmetic_annualized_return) }],
    [report],
  );
  const decileCats = useMemo(() => groups.map((r) => r.group), [report]);

  return (
    <div className="tab-body">
      <section className="card">
        <h2>经济含义</h2>
        <p>{d.economic_hypothesis}</p>
      </section>

      <section className="card">
        <h2>因子定义</h2>
        <pre className="formula">{d.formula}</pre>
        <dl className="spec">
          <dt>输入字段</dt><dd>{d.input_field}</dd>
          <dt>数据窗口</dt><dd>{d.window}</dd>
          <dt>会计口径</dt><dd>{d.accounting_basis}</dd>
          <dt>因子方向</dt><dd>{d.direction}</dd>
          <dt>缺失处理</dt><dd>{d.missing_rule}</dd>
        </dl>
      </section>

      <section className="card">
        <h2>核心表现</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>股票池</th><th>Rank IC</th><th>年化ICIR</th><th>多空年化收益</th></tr>
            </thead>
            <tbody>
              {core.pool_metrics.map((m) => (
                <tr key={m.pool}>
                  <td>{m.pool_display_name}</td>
                  <td>{pct(m.rank_ic)}</td>
                  <td>{num(m.annualized_icir)}</td>
                  <td>{pct(m.long_short_annualized)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <FactorChart title="十档分组年化收益（算术年化，月均收益×12）" categories={decileCats} series={decileSeries} valueFormat="percent" />
        {longShort && (
          <p className="caption">
            多空组合（G10−G1）：月均 {pct(longShort.mean_monthly_return)}，算术年化 {pct(longShort.arithmetic_annualized_return)}，
            有效月份 {longShort.valid_month_count}。
          </p>
        )}
      </section>

      <section className="card">
        <h2>与原文 benchmark 对比</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>股票池</th><th>指标</th><th>复现</th><th>原文</th><th>绝对差</th><th>相对差</th></tr>
            </thead>
            <tbody>
              {core.benchmark_comparison.map((r) => (
                <tr key={`${r.pool}-${r.metric}`}>
                  <td>{r.pool_display_name}</td>
                  <td>{r.metric_display_name}</td>
                  <td>{metricValue(r.metric, r.replicated)}</td>
                  <td>{metricValue(r.metric, r.paper)}</td>
                  <td>{r.metric === "icir" ? num(r.absolute_difference) : pct(r.absolute_difference)}</td>
                  <td>{pct(r.relative_difference, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption">相对差 = (复现 − 原文) ÷ |原文|。未做任何参数调整以贴近原文。</p>
      </section>

      <section className="card">
        <h2>已登记的复现差异</h2>
        {notes.known_replication_discrepancies.length === 0 ? (
          <p>验收记录中该因子没有超出项目容差（±20%）的指标差异。</p>
        ) : (
          notes.known_replication_discrepancies.map((x) => (
            <div key={x.metric} className="note">
              <p>
                <strong>{x.metric_display_name}</strong>：复现 {metricValue(x.metric, x.replicated)}，原文{" "}
                {metricValue(x.metric, x.paper)}，相对差 {pct(x.relative_difference, 1)}（{x.classification}）。
              </p>
              {x.registered_note && <p className="caption">{x.registered_note}</p>}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
