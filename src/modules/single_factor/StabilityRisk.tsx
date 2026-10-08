import { useEffect, useMemo, useState } from "react";
import FactorChart, { type Series } from "../../shared/FactorChart";
import { num, pct } from "../../shared/format";
import { chartNote, loadCsi300, navPoints, type BenchmarkReport, type FactorReport } from "./data";

const TOP_INDUSTRIES = 10;

type MarketState = { status: "loading" } | { status: "ok"; data: BenchmarkReport } | { status: "error" };

export default function StabilityRisk({ report, pool }: { report: FactorReport; pool: string }) {
  const ctx = report.display_context;
  const a = report.analysis_by_pool[pool];
  const r = a.risk_exposure;
  const coveragePools = Object.keys(report.coverage_by_pool);
  const [coveragePool, setCoveragePool] = useState(coveragePools.includes(pool) ? pool : coveragePools[0]);
  const [market, setMarket] = useState<MarketState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadCsi300()
      .then((data) => !cancelled && setMarket({ status: "ok", data }))
      .catch(() => !cancelled && setMarket({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);

  const cov = report.coverage_by_pool[coveragePool];

  const charts = useMemo(() => {
    const factorNav = navPoints(a.long_short_nav);
    const navDates = [...factorNav.keys()];
    const navSeries: Series[] = [
      { name: "因子多空组合 G10−G1", data: navDates.map((d) => factorNav.get(d) ?? null), color: "#1f4e79", width: 2 },
    ];
    if (market.status === "ok") {
      const marketNav = navPoints(market.data.series);
      const marketBase = marketNav.get(navDates[0]) ?? null;
      navSeries.push({
        name: `${market.data.benchmark.name_cn}（市场环境参考）`,
        data: navDates.map((d) => {
          const v = marketNav.get(d);
          return v == null || marketBase == null ? null : v / marketBase;
        }),
        color: "#b0602a",
        width: 1.75,
        dashed: true,
      });
    }
    const bias = [...r.industry.long_run_bias]
      .filter((x) => x.mean_exposure_before_neutralization !== null)
      .sort((x, y) => Math.abs(y.mean_exposure_before_neutralization!) - Math.abs(x.mean_exposure_before_neutralization!))
      .slice(0, TOP_INDUSTRIES);
    return {
      icDates: a.monthly_ic.map((x) => x.date),
      icSeries: [
        { name: "月度 Rank IC", data: a.monthly_ic.map((x) => x.rank_ic), color: "#9fb6cd", width: 1 },
        { name: "12个月滚动均值", data: a.monthly_ic.map((x) => x.rolling_12m_ic), color: "#1f4e79", width: 2 },
      ],
      navDates,
      navSeries,
      sizeDates: r.size.map((x) => x.date),
      sizeSeries: [
        { name: "中性化前", data: r.size.map((x) => x.before_neutralization), color: "#7f7f7f" },
        { name: "中性化后", data: r.size.map((x) => x.after_neutralization), color: "#1f4e79" },
      ],
      dispDates: r.industry.monthly_dispersion.map((x) => x.date),
      dispSeries: [
        { name: "中性化前", data: r.industry.monthly_dispersion.map((x) => x.before_neutralization), color: "#7f7f7f" },
        { name: "中性化后", data: r.industry.monthly_dispersion.map((x) => x.after_neutralization), color: "#1f4e79" },
      ],
      bias,
      biasCats: bias.map((x) => x.industry_name),
      biasSeries: [
        { name: "中性化前", type: "bar" as const, data: bias.map((x) => x.mean_exposure_before_neutralization), color: "#7f7f7f" },
        { name: "中性化后", type: "bar" as const, data: bias.map((x) => x.mean_exposure_after_neutralization), color: "#1f4e79" },
      ],
    };
  }, [report, pool, market]);

  const covChart = useMemo(
    () => ({
      dates: cov.monthly.map((x) => x.date),
      series: [{ name: "覆盖率", data: cov.monthly.map((x) => x.coverage_rate) }],
    }),
    [report, coveragePool],
  );

  return (
    <div className="tab-body">
      <section className="card">
        <FactorChart title={`月度 Rank IC 与 12个月滚动均值——${a.pool_display_name}`} categories={charts.icDates} series={charts.icSeries} valueFormat="percent" />
        <p className="caption">{chartNote(ctx, "monthly_ic", a.pool_display_name)}</p>
      </section>

      <section className="card">
        <FactorChart title={`多空组合累计净值——${a.pool_display_name}`} categories={charts.navDates} series={charts.navSeries} valueFormat="number" yAxisName="净值" />
        {market.status === "loading" && <p className="caption">沪深300价格指数（市场环境参考）加载中…</p>}
        {market.status === "error" && <p className="market-error">市场参考暂时无法加载</p>}
        <p className="caption">{chartNote(ctx, "long_short_nav", a.pool_display_name)}</p>
      </section>

      <section className="card">
        <h2>年度表现——{a.pool_display_name}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>期间</th><th>多空收益</th><th>年化波动率</th><th>月频最大回撤</th><th>Sharpe</th>
                <th>平均 Rank IC</th><th>年化ICIR</th><th>IC&gt;0 占比</th><th>有效IC月数</th><th>有效收益月数</th>
                <th>同期沪深300（市场环境参考）</th>
              </tr>
            </thead>
            <tbody>
              {a.annual_performance
                .filter((y) => y.return_type === "cagr" || y.valid_long_short_months > 0 || y.valid_ic_months > 0)
                .map((y) => (
                <tr key={y.period}>
                  <td>{y.label}{y.return_type === "cagr" ? "（CAGR）" : ""}</td>
                  <td>{pct(y.return)}</td>
                  <td>{pct(y.annualized_volatility)}</td>
                  <td>{pct(y.max_drawdown)}</td>
                  <td>{num(y.sharpe)}</td>
                  <td>{pct(y.mean_rank_ic)}</td>
                  <td>{num(y.annualized_icir)}</td>
                  <td>{pct(y.ic_positive_ratio, 0)}</td>
                  <td>{y.valid_ic_months}</td>
                  <td>{y.valid_long_short_months}</td>
                  <td>{pct(y.csi300_return)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption">{chartNote(ctx, "annual_performance", a.pool_display_name)}</p>
      </section>

      <section className="card">
        <h2>回测有效覆盖率</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>市场</th><th>全样本平均</th><th>生效期平均</th><th>生效期最低</th><th>最新</th><th>首个有效月份</th></tr>
            </thead>
            <tbody>
              {coveragePools.map((p) => {
                const s = report.coverage_by_pool[p].summary;
                return (
                  <tr key={p}>
                    <td>{report.coverage_by_pool[p].pool_display_name}</td>
                    <td>{pct(s.full_sample_mean, 1)}</td>
                    <td>{pct(s.effective_mean, 1)}</td>
                    <td>{pct(s.effective_min, 1)}</td>
                    <td>{pct(s.latest, 1)}</td>
                    <td>{s.first_effective_month ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card-head">
          <label className="selector">
            <span>覆盖率市场</span>
            <select value={coveragePool} onChange={(e) => setCoveragePool(e.target.value)}>
              {coveragePools.map((p) => (
                <option key={p} value={p}>{report.coverage_by_pool[p].pool_display_name}</option>
              ))}
            </select>
          </label>
        </div>
        <FactorChart title={`回测有效覆盖率——${cov.pool_display_name}`} categories={covChart.dates} series={covChart.series} valueFormat="percent" />
        <p className="caption">{chartNote(ctx, "coverage", cov.pool_display_name)}</p>
      </section>

      <section className="card">
        <FactorChart title={`市值暴露——${a.pool_display_name}`} categories={charts.sizeDates} series={charts.sizeSeries} valueFormat="number" yAxisName="相关系数" />
        <p className="caption">{chartNote(ctx, "size_exposure", a.pool_display_name)}</p>
      </section>

      <section className="card">
        <FactorChart title={`行业暴露：行业均值的加权离散度——${a.pool_display_name}`} categories={charts.dispDates} series={charts.dispSeries} valueFormat="number" yAxisName="离散度" />
        <p className="caption">{chartNote(ctx, "industry_exposure", a.pool_display_name)}</p>
      </section>

      <section className="card">
        <FactorChart
          title={`长期行业偏向（中性化前绝对值最大的${charts.bias.length}个行业）——${a.pool_display_name}`}
          categories={charts.biasCats}
          series={charts.biasSeries}
          valueFormat="number"
          horizontal
          height={Math.max(280, 34 * charts.bias.length + 80)}
        />
        <p className="caption">{chartNote(ctx, "industry_exposure", a.pool_display_name)} 柱长为该行业全样本月度平均暴露（标准化单位）。</p>
      </section>
    </div>
  );
}
