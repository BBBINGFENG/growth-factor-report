import { useEffect, useMemo, useState } from "react";
import FactorChart, { type Series } from "../../shared/FactorChart";
import { num, pct } from "../../shared/format";
import { loadCsi300, navPoints, type BenchmarkReport, type FactorReport } from "./data";

const TOP_INDUSTRIES = 10;

type MarketState = { status: "loading" } | { status: "ok"; data: BenchmarkReport } | { status: "error" };

export default function StabilityRisk({ report }: { report: FactorReport }) {
  const { stability: s, risk_exposure: r } = report;
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

  const charts = useMemo(() => {
    const icDates = s.monthly_ic.map((x) => x.date);
    const factorNav = navPoints(s.long_short_nav);
    const navDates = [...factorNav.keys()];
    const navSeries: Series[] = [
      { name: "因子多空组合 G10−G1", data: navDates.map((d) => factorNav.get(d) ?? null), color: "#1f4e79", width: 2 },
    ];
    if (market.status === "ok") {
      const marketNav = navPoints(market.data.series);
      const marketBase = marketNav.get(navDates[0]) ?? null;
      navSeries.push({
        name: `${market.data.benchmark.name_cn}（市场参考）`,
        data: navDates.map((d) => {
          const v = marketNav.get(d);
          return v == null || marketBase == null ? null : v / marketBase;
        }),
        color: "#b0602a",
        width: 1.75,
        dashed: true,
      });
    }
    const covDates = s.coverage.map((x) => x.date);
    const sizeDates = r.size.map((x) => x.date);
    const dispDates = r.industry.monthly_dispersion.map((x) => x.date);
    const bias = [...r.industry.long_run_bias]
      .filter((x) => x.mean_exposure_before_neutralization !== null)
      .sort((a, b) => Math.abs(b.mean_exposure_before_neutralization!) - Math.abs(a.mean_exposure_before_neutralization!))
      .slice(0, TOP_INDUSTRIES);
    return {
      icDates,
      icSeries: [
        { name: "月度 Rank IC", data: s.monthly_ic.map((x) => x.rank_ic), color: "#9fb6cd", width: 1 },
        { name: "12个月滚动均值", data: s.monthly_ic.map((x) => x.rolling_12m_ic), color: "#1f4e79", width: 2 },
      ],
      navDates,
      navSeries,
      covDates,
      covSeries: [{ name: "覆盖率", data: s.coverage.map((x) => x.coverage_rate) }],
      sizeDates,
      sizeSeries: [
        { name: "中性化前", data: r.size.map((x) => x.before_neutralization), color: "#7f7f7f" },
        { name: "中性化后", data: r.size.map((x) => x.after_neutralization), color: "#1f4e79" },
      ],
      dispDates,
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
  }, [report, market]);

  const top3 = charts.bias.slice(0, 3);

  return (
    <div className="tab-body">
      <p className="pool-note">本页图表股票池：{report.provenance.primary_branch.pool_display_name}</p>

      <section className="card">
        <FactorChart title="月度 Rank IC 与 12个月滚动均值" categories={charts.icDates} series={charts.icSeries} valueFormat="percent" />
        <p className="caption">滚动均值要求窗口内12个月全部有效，前11个月不显示；缺失月份不按0处理。</p>
      </section>

      <section className="card">
        <FactorChart title="多空组合累计净值与沪深300市场参考" categories={charts.navDates} series={charts.navSeries} valueFormat="number" yAxisName="净值" />
        {market.status === "loading" && <p className="caption">沪深300价格指数（市场参考）加载中…</p>}
        {market.status === "error" && <p className="market-error">市场参考暂时无法加载</p>}
        <p className="caption">
          两条曲线初始值均为1，并采用相同的月初开盘至下月月初开盘区间。沪深300用于反映同期市场环境；因子多空组合接近市场中性，因此两者不是同风险性质的直接业绩比较。
        </p>
      </section>

      <section className="card">
        <h2>年度表现</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>年份</th><th>多空收益</th><th>平均 Rank IC</th><th>IC&gt;0 占比</th><th>有效IC月数</th><th>有效多空月数</th></tr>
            </thead>
            <tbody>
              {s.annual_performance.map((y) => (
                <tr key={y.year}>
                  <td>{y.year}</td>
                  <td>{pct(y.annual_long_short_return)}</td>
                  <td>{pct(y.mean_rank_ic)}</td>
                  <td>{pct(y.ic_positive_ratio, 0)}</td>
                  <td>{y.valid_ic_months}</td>
                  <td>{y.valid_long_short_months}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption">年份按调仓日（signal date）归属；年度多空收益为当年有效月份的复利结果。</p>
      </section>

      <section className="card">
        <FactorChart title="因子覆盖率" categories={charts.covDates} series={charts.covSeries} valueFormat="percent" />
        <p className="caption">覆盖率 = 当月同时有因子值和下期收益的股票数 ÷ 当月正式股票池股票数。</p>
      </section>

      <section className="card">
        <FactorChart title="市值暴露：因子与 ln(总市值) 的截面相关系数" categories={charts.sizeDates} series={charts.sizeSeries} valueFormat="number" yAxisName="相关系数" />
        <p className="caption">中性化前使用标准化后的因子值，中性化后使用市值与行业中性化后的因子值；两者使用同一批样本。</p>
      </section>

      <section className="card">
        <FactorChart title="行业暴露：行业均值的加权离散度" categories={charts.dispDates} series={charts.dispSeries} valueFormat="number" yAxisName="离散度" />
        <p className="caption">每月先算各行业因子均值，再按行业股票数加权计算其标准差。数值越小，说明行业之间的系统性差异越小。</p>
      </section>

      <section className="card">
        <FactorChart
          title={`长期行业偏向（中性化前绝对值最大的${charts.bias.length}个行业）`}
          categories={charts.biasCats}
          series={charts.biasSeries}
          valueFormat="number"
          horizontal
          height={Math.max(280, 34 * charts.bias.length + 80)}
        />
        {top3.length > 0 && (
          <p className="caption">
            中性化前偏向最明显的行业：
            {top3.map((x) => `${x.industry_name}（${num(x.mean_exposure_before_neutralization)} → ${num(x.mean_exposure_after_neutralization)}）`).join("、")}。
            数值为该行业全样本期月度平均暴露（标准化单位）。
          </p>
        )}
      </section>
    </div>
  );
}
