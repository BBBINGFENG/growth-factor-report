import { useCallback, useMemo } from "react";
import FactorChart from "../../shared/FactorChart";
import { num, pct } from "../../shared/format";
import { CLASSIFICATION_CN, chartNote, metricValue, type FactorReport } from "./data";
import { FormulaLink } from "./CalculationMethods";
import { FactorFormula } from "./FactorFormula";
import type { ShowFormula } from "./methodologyDefinitions";

export default function DefinitionPerformance({ report, pool, onShowFormula }: { report: FactorReport; pool: string; onShowFormula: ShowFormula }) {
  const { definition: d, paper_comparison: paper, notes, display_context: ctx } = report;
  const analysis = report.analysis_by_pool[pool];
  const hasPaper = paper.comparison.some((r) => r.paper !== null);
  const groups = analysis.deciles.filter((r) => r.group !== "G10−G1");
  const spread = analysis.deciles.find((r) => r.group === "G10−G1");
  const poolName = new Map(paper.pool_metrics.map((m) => [m.pool, m.pool_display_name]));

  const decileCats = useMemo(() => groups.map((r) => r.group), [report, pool]);
  const decileSeries = useMemo(
    () => [{ name: "超额收益", type: "bar" as const, data: groups.map((r) => r.excess_annualized) }],
    [report, pool],
  );
  const decileTooltip = useCallback(
    (i: number) => [
      `原始收益：${pct(groups[i].raw_annualized)}`,
      `股票池等权benchmark：${pct(groups[i].benchmark_annualized)}`,
      `超额收益：${pct(groups[i].excess_annualized)}`,
    ],
    [report, pool],
  );

  return (
    <div className="tab-body">
      <section className="card">
        <h2>经济含义</h2>
        <p>{d.economic_hypothesis}</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>因子定义</h2>
          <FormulaLink section="preprocessing" onShow={onShowFormula}>查看预处理与 Neutralization 公式</FormulaLink>
        </div>
        <FactorFormula definition={d} />
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
              {paper.pool_metrics.map((m) => (
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
        <p className="caption">论文包含的全部股票池；不随上方分析市场切换。多空收益为月均收益 × 12（算术年化）。</p>
        <div className="formula-links">
          <FormulaLink section="ic" onShow={onShowFormula}>Rank IC / ICIR 公式</FormulaLink>
          <FormulaLink section="returns" onShow={onShowFormula}>分组与收益公式</FormulaLink>
        </div>
      </section>

      <section className="card">
        <FactorChart
          title={`十档组合相对同股票池等权组合的算术年化超额收益——${analysis.pool_display_name}`}
          categories={decileCats}
          series={decileSeries}
          valueFormat="percent"
          tooltipLines={decileTooltip}
        />
        <p className="caption">
          {chartNote(ctx, "deciles", analysis.pool_display_name)}
          {spread && ` 多空组合（G10−G1）算术年化 ${pct(spread.excess_annualized)}，有效月份 ${spread.valid_month_count}；benchmark在价差中相互抵消。`}
        </p>
        <FormulaLink section="returns" onShow={onShowFormula}>查看十档、benchmark 与算术年化公式</FormulaLink>
      </section>

      <section className="card">
        <h2>与原文 benchmark 对比</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>股票池</th><th>指标</th><th>复现</th><th>原文</th><th>绝对差</th><th>相对差</th></tr>
            </thead>
            <tbody>
              {paper.comparison.map((r) => (
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
        <p className="caption">
          {hasPaper
            ? "相对差 = (复现 − 原文) ÷ |原文|。未做任何参数调整以贴近原文。"
            : "原文对该因子只有定性结论，没有可核对的数值 benchmark，因此不计算复现差异；原文列显示“—”。"}
        </p>
        <FormulaLink section="comparison" onShow={onShowFormula}>查看论文差异与市场参考口径</FormulaLink>
      </section>

      <section className="card">
        <h2>已登记的复现差异</h2>
        {!hasPaper ? (
          <p>原文没有可核对的数值 benchmark，不做复现差异分类。</p>
        ) : notes.known_replication_discrepancies.length === 0 ? (
          <p>验收记录没有单独登记超出项目容差（±20%）的指标差异。各指标的完整差异见上方对比表。</p>
        ) : (
          notes.known_replication_discrepancies.map((x) => (
            <div key={`${x.pool}-${x.metric}`} className="note">
              <p>
                <strong>{poolName.get(x.pool) ?? x.pool} · {x.metric_display_name}</strong>：复现 {metricValue(x.metric, x.replicated)}，原文{" "}
                {metricValue(x.metric, x.paper)}，相对差 {pct(x.relative_difference, 1)}。{CLASSIFICATION_CN[x.classification] ?? x.classification}。
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
