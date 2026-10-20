import { useEffect, useMemo, useState } from "react";
import FactorChart, { type Series } from "../../shared/FactorChart";
import { num, pct } from "../../shared/format";
import { chartNote, loadCsi300Daily, type DailyBenchmark, type DailyValuation, type DisplayContext } from "./data";
import { FormulaLink } from "./CalculationMethods";
import type { ShowFormula } from "./methodologyDefinitions";

type MarketState = { status: "loading" } | { status: "ok"; data: DailyBenchmark } | { status: "error" };

function label(date: string, point: "open" | "close", i: number, n: number): string {
  return point === "open" && (i === 0 || i === n - 1) ? `${date} 开盘` : date;
}

export default function DailyRisk({ daily: v, poolName, ctx, onShowFormula }: {
  daily: DailyValuation;
  poolName: string;
  ctx: DisplayContext;
  onShowFormula: ShowFormula;
}) {
  const [market, setMarket] = useState<MarketState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadCsi300Daily()
      .then((data) => !cancelled && setMarket({ status: "ok", data }))
      .catch(() => !cancelled && setMarket({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);

  const charts = useMemo(() => {
    const n = v.nav.dates.length;
    const categories = v.nav.dates.map((d, i) => label(d, v.nav.points[i], i, n));
    const navSeries: Series[] = [{ name: "因子多空组合 G10−G1（日度估值）", data: v.nav.value, color: "#1f4e79", width: 1.5 }];
    if (market.status === "ok") {
      const index = new Map(market.data.dates.map((d, i) => [d, i]));
      const level = (d: string, p: "open" | "close") => {
        const i = index.get(d);
        return i === undefined ? null : market.data[p][i];
      };
      const base = level(v.nav.dates[0], v.nav.points[0]);
      navSeries.push({
        name: `${market.data.benchmark.name_cn}（市场环境参考）`,
        data: v.nav.dates.map((d, i) => {
          const x = level(d, v.nav.points[i]);
          return x === null || base === null ? null : x / base;
        }),
        color: "#b0602a",
        width: 1.25,
        dashed: true,
      });
    }
    return { categories, navSeries, ddSeries: [{ name: "日频回撤", data: v.nav.drawdown, color: "#c0504d", width: 1.25 }] as Series[] };
  }, [v, market]);

  const s = v.summary;
  const rec = v.reconciliation;
  return (
    <>
      <section className="card">
        <FactorChart title={`多空组合日度净值（月度调仓、日度估值）——${poolName}`} categories={charts.categories} series={charts.navSeries} valueFormat="number" yAxisName="净值" />
        {market.status === "loading" && <p className="caption">沪深300价格指数（市场环境参考）加载中…</p>}
        {market.status === "error" && <p className="market-error">市场参考暂时无法加载</p>}
        <p className="caption">{chartNote(ctx, "daily_nav", poolName)}</p>
        <FactorChart title={`日频回撤——${poolName}`} categories={charts.categories} series={charts.ddSeries} valueFormat="percent" yAxisName="回撤" height={220} />
        <p className="caption">{chartNote(ctx, "daily_drawdown", poolName)}</p>
        <FormulaLink section="risk" onShow={onShowFormula}>查看资金尺度、日度估值与日频指标公式</FormulaLink>
      </section>

      <section className="card">
        <h2>日频年度表现（完整策略）——{poolName}</h2>
        <dl className="spec method-context">
          <dt>频率</dt><dd>月度调仓、日度收盘估值；{v.start_date} 开盘至 {v.end_date} 开盘</dd>
          <dt>有效期</dt><dd>{v.sample.rule_cn}{v.sample.factor_unavailable_months > 0 ? `；此前 ${v.sample.factor_unavailable_months} 个月因子尚不可用（至 ${v.sample.factor_unavailable_last_month}），不补作现金` : ""}{v.sample.outside_pool_coverage_months > 0 ? `；股票池尚无历史覆盖的 ${v.sample.outside_pool_coverage_months} 个月不计入` : ""}</dd>
          <dt>统计口径</dt><dd>完整交易日 {s.valid_days} 个{s.cash_days > 0 ? `（其中无信号空仓现金日 ${s.cash_days} 个，收益为0，计入统计；空仓月 ${s.cash_months} 个）` : ""}；样本标准差 ddof = {v.std_ddof}；A = {v.annualization_days} 个交易日；r<sub>f</sub> = {v.risk_free_rate}</dd>
          <dt>缺价估值</dt><dd>持有期无收盘价按最近有效价格估值的持仓日：停牌 {s.stale_position_days.suspended.toLocaleString()}、退市 {s.stale_position_days.delisted.toLocaleString()}、未知缺口 {s.stale_position_days.unknown.toLocaleString()}；调仓日无开盘价未建仓 {s.entry_without_open} 只次</dd>
          <dt>退出代理</dt><dd>下一调仓日无开盘价的 {s.exit_carried_positions} 只次（停牌 {s.exit_positions_by_reason.suspended}、退市 {s.exit_positions_by_reason.delisted}、未知 {s.exit_positions_by_reason.unknown}）按最近有效价格估值并假设可平仓（theoretical proxy），可能遗漏其复牌后的损益，不代表真实成交</dd>
        </dl>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>期间</th><th>收益</th><th>年化波动率（完整策略）</th><th>Sharpe（完整策略）</th><th>日频最大回撤</th>
                <th>回撤区间</th><th>完整交易日</th><th>持仓期 Sharpe（补充）</th><th>持仓期波动率（补充）</th>
                <th>同期沪深300（市场环境参考）</th>
              </tr>
            </thead>
            <tbody>
              {v.annual_performance.map((y) => (
                <tr key={y.period}>
                  <td>{y.label}{y.return_type === "cagr" ? "（CAGR）" : ""}</td>
                  <td>{pct(y.return)}</td>
                  <td>{pct(y.annualized_volatility)}</td>
                  <td>{num(y.sharpe)}</td>
                  <td>{pct(y.max_drawdown)}</td>
                  <td>{y.max_drawdown !== null && y.max_drawdown < 0 ? `${y.max_drawdown_peak_date} → ${y.max_drawdown_trough_date}` : "—"}</td>
                  <td>{y.valid_days}{y.cash_days > 0 ? `（现金 ${y.cash_days}）` : ""}</td>
                  <td>{num(y.conditional_sharpe)}</td>
                  <td>{pct(y.conditional_annualized_volatility)}</td>
                  <td>{pct(y.csi300_return)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption">{chartNote(ctx, "daily_annual", poolName)}</p>
        <FormulaLink section="risk" onShow={onShowFormula}>日频 Sharpe / 波动率 / 回撤 / CAGR 公式</FormulaLink>
      </section>

      <section className="card">
        <h2>日月对账（按月度 E1 端点）——{poolName}</h2>
        <p className="caption">
          按月对账：可比月份（两腿持仓在下一调仓日开盘都有价格）{s.comparable_months}/{s.position_months} 个，日度模型的开盘到开盘月收益与月度 E1 的最大差为 {rec.max_abs_difference_comparable_months?.toExponential(1) ?? "—"}；
          把同一持仓按 E1 规则定价（剔除下一调仓日无开盘价的股票）后，全部持仓月的最大差为 {rec.max_abs_difference_e1_pricing?.toExponential(1) ?? "—"}。
          因此在“同一月份、开盘到开盘”的层面，日月差异只来自缺价持仓的退出处理；整段复合：月度 E1 {num(rec.e1_compounded, 4)}，日度模型 {num(rec.daily_compounded, 4)}。
          年度与整体指标的差异还来自年度边界（自然年 vs 调仓开盘端点）、年化时间基准（日历时长 vs 有效收益月数）、空仓现金月和统计频率（日收益 vs 月收益）。与 E1 对账一致不代表退出假设可交易。
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>年度（调仓开盘端点）</th><th>月数</th><th>月度 E1</th><th>日度模型</th><th>日度持仓按 E1 定价</th><th>含结转股票的月数</th></tr>
            </thead>
            <tbody>
              {rec.e1_endpoint_years.map((y) => (
                <tr key={y.year}>
                  <td>{y.year}（{y.begin_open} → {y.end_open}）</td>
                  <td>{y.months}</td>
                  <td>{pct(y.e1_monthly)}</td>
                  <td>{pct(y.daily_model)}</td>
                  <td>{pct(y.daily_model_e1_pricing)}</td>
                  <td>{y.months_with_carried_exit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption">本表按月度调仓开盘端点汇总，与上方按自然年（上年末收盘至当年末收盘）的日频年度表边界不同。</p>
      </section>
    </>
  );
}
