import { useEffect, useMemo, useState } from "react";
import FactorChart, { type Series } from "../../shared/FactorChart";
import { num, pct, type Num } from "../../shared/format";
import { loadCsi300Daily, type DailyBenchmark } from "../single_factor/data";
import { ymd, type CompositeReport, type DailyRow, type MonthlyRow } from "./data";

const PERIODS = [["all", "整体"], ["since_2021", "2021年至今"]] as const;

function MetricsTable({ monthly, daily, arith, title }: {
  monthly: MonthlyRow[];
  daily: DailyRow[];
  arith: Record<string, Num>;
  title?: string;
}) {
  const m = new Map(monthly.map((r) => [r.period, r]));
  const d = new Map(daily.map((r) => [r.period, r]));
  return (
    <div className="table-wrap">
      <table>
        {title && <caption>{title}</caption>}
        <thead>
          <tr>
            <th rowSpan={2}>区间</th>
            <th colSpan={4}>月频 IC 指标（月度 IC 序列）</th>
            <th colSpan={5}>月频多空收益对照（E1 月度）</th>
            <th colSpan={5}>日频风险（日度估值路径）</th>
          </tr>
          <tr>
            <th>Rank IC</th><th>年化ICIR</th><th>IC&gt;0</th><th>IC月数</th>
            <th>算术年化</th><th>CAGR（有效月）</th><th>年化波动</th><th>Sharpe</th><th>最大回撤</th>
            <th>区间</th><th>CAGR</th><th>年化波动</th><th>Sharpe</th><th>最大回撤</th>
          </tr>
        </thead>
        <tbody>
          {PERIODS.map(([k, label]) => {
            const a = m.get(k);
            const b = d.get(k);
            if (!a || !b) return null;
            return (
              <tr key={k}>
                <td>{label}</td>
                <td>{pct(a.mean_rank_ic)}</td><td>{num(a.annualized_icir)}</td><td>{pct(a.ic_positive_ratio, 1)}</td><td>{a.valid_ic_months}</td>
                <td>{pct(arith[k] ?? null)}</td><td>{pct(a.return)}</td><td>{pct(a.annualized_volatility)}</td><td>{num(a.sharpe)}</td><td>{pct(a.max_drawdown)}</td>
                <td>{b.begin_point.replace(" open", " 开盘").replace(" close", " 收盘")} → {b.end_point.replace(" open", " 开盘")}</td>
                <td>{pct(b.return)}</td><td>{pct(b.annualized_volatility)}</td><td>{num(b.sharpe)}</td><td>{pct(b.max_drawdown)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PerformanceTab({ report: r }: { report: CompositeReport }) {
  const [market, setMarket] = useState<DailyBenchmark | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCsi300Daily().then((m) => !cancelled && setMarket(m)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const daily = r.series.daily;
  const monthly = r.series.monthly;
  const navSeries = useMemo(() => {
    const s: Series[] = [{ name: `${r.id} 多空组合 G10−G1（日度估值）`, data: daily.value, color: "#1f4e79", width: 1.5 }];
    if (market) {
      const idx = new Map(market.dates.map((d, i) => [d, i]));
      const level = (d: string, p: "open" | "close") => {
        const i = idx.get(d);
        return i === undefined ? null : market[p][i];
      };
      const base = level(daily.dates[0], daily.points[0]);
      s.push({
        name: "沪深300价格指数（市场环境参考）",
        data: daily.dates.map((d, i) => {
          const x = level(d, daily.points[i]);
          return x === null || base === null ? null : x / base;
        }),
        color: "#b0602a", width: 1.25, dashed: true,
      });
    }
    return s;
  }, [r, market]);
  const dailyCats = useMemo(() => daily.dates.map((d, i) => (daily.points[i] === "open" && (i === 0 || i === daily.dates.length - 1) ? `${d} 开盘` : d)), [r]);
  const monthCats = useMemo(() => monthly.dates.map((d) => d.slice(0, 7)), [r]);
  const years = r.metrics.monthly_annual.filter((x) => x.period !== "all" && !x.period.startsWith("since"));
  const dailyYears = new Map(r.metrics.daily.map((x) => [x.period, x]));
  const dec = r.metrics.deciles;
  const dx = r.metrics.deciles_excess;
  const comp = Object.values(r.comparisons);

  return (
    <div className="tab-body">
      <section className="card">
        <h2>整体与 2021 年至今</h2>
        <MetricsTable monthly={r.metrics.monthly_annual} daily={r.metrics.daily} arith={r.metrics.long_short_arithmetic_by_period} />
        <p className="caption">
          月频：Rank IC、ICIR（×√12）、IC&gt;0 由月度 IC 序列计算；多空算术年化 = 月均 G10−G1 收益 × 12（与原文比较的口径），CAGR 按有效月数年化。
          日频：由每日收盘估值的净值计算，CAGR 按日历日，Sharpe = 日收益均值 / 标准差（ddof=1）× √252，rf=0。两组指标频率不同，不可互换。
        </p>
        {comp.map((c) => (
          <MetricsTable key={c.from} monthly={c.monthly.annual} daily={c.daily} arith={c.long_short_arithmetic_by_period}
                        title={`共同区间对照：自 ${c.from.slice(0, 4)}-${c.from.slice(4, 6)} 起（六类均有值；补充对照，不替代全区间）`} />
        ))}
      </section>

      <section className="card">
        <FactorChart title="多空净值（月度调仓、日度估值）" categories={dailyCats} series={navSeries} valueFormat="number" height={340} />
        <FactorChart title="日频回撤" categories={dailyCats} series={[{ name: "回撤", data: daily.drawdown, color: "#c0504d", width: 1.25 }]} valueFormat="percent" height={220} />
        <p className="caption">主图：月度调仓、日度估值的理论研究模型。沪深300价格指数在相同估值点上归一化，仅作市场环境参考，不是多空组合的 benchmark。未计交易成本、滑点与融券约束；缺失退出价格按最近有效价格估值（theoretical exit proxy）。与月频 E1 的差异见下方“日月口径对账”。</p>
      </section>

      <section className="card">
        <FactorChart title="月度 Rank IC" categories={monthCats}
                     series={[{ name: "Rank IC", type: "bar", data: monthly.rank_ic.map((v, i) => (monthly.ic_below_min_n[i] ? null : v)), color: "#4f81bd" }]}
                     valueFormat="percent" height={260} />
        <p className="caption">N&lt;30 的月份 IC 不显示。</p>
        <FactorChart title={`十档月均超额收益（G1 最低 → G10 最高；减 ${dx.benchmark.name_cn}）`} categories={dx.groups.map((g) => g.group)}
                     series={[{ name: "月均超额收益", type: "bar", data: dx.groups.map((g) => g.excess_monthly), color: "#1f4e79" }]} valueFormat="percent" height={260}
                     tooltipLines={(i) => [`月均超额：${pct(dx.groups[i].excess_monthly, 3)}`, `原始月均：${pct(dx.groups[i].raw_monthly, 3)}；基准月均：${pct(dx.groups[i].benchmark_monthly, 3)}`, `有效月份：${dx.groups[i].valid_month_count}`]} />
        <p className="caption">
          每月先用该组 E1 收益减去同一信号月、同一 E1 区间（信号月开盘到下一信号月开盘）的{dx.benchmark.name_cn}，再对双方都有值的月份取平均；
          信号月 {ymd(dx.first_month)} 至 {ymd(dx.last_month)}（每月收益区间为该信号月开盘到下一信号月开盘），有效月份 {dx.months}（各组见悬停）。G1 最低、G10 最高；同一月两腿减去相同基准，G10−G1 多空收益不变，不再重复扣减。
          {dx.sample_note ? ` ${dx.sample_note}。` : ""}
        </p>
        <details className="formula-details">
          <summary>原始十档月均收益（未减基准，对照）</summary>
          <FactorChart title="十档月均收益（原始收益，G1 最低 → G10 最高）" categories={dec.mean_group_returns.map((_, i) => `G${i + 1}`)}
                       series={[{ name: "月均收益", type: "bar", data: dec.mean_group_returns, color: "#7f7f7f" }]} valueFormat="percent" height={240} />
          <p className="caption">各月 E1 组内等权收益对 {dec.months_grouped} 个分组月取平均（冻结结果）；组序与月均收益的 Spearman = {num(dec.spearman_group_vs_mean_return)}。</p>
        </details>
      </section>

      <section className="card">
        <details className="formula-details">
          <summary>日月口径对账：月频 E1 累计净值</summary>
          <FactorChart title="月频多空累计净值（E1 月度端点复合，对照）" categories={monthCats}
                       series={[{ name: "月频 G10−G1 累计", data: monthly.long_short_nav, color: "#7f7f7f" }]} valueFormat="number" height={260} />
          <p className="caption">
            月频 E1 是原文复现与月度诊断的口径：每组取当月 E1 收益（信号月开盘到下一信号月开盘）的等权均值，某只股票没有下一信号月开盘价（停牌、退市等）时，该股从当月组均值中剔除。
            日度模型（上方主图）则按建仓时有开盘价的股票持有到下一调仓日，缺收盘价时按最近有效价格结转，下一调仓日仍无开盘价时按最近有效价格视为平仓（theoretical exit proxy），
            之后的复牌损益不由任何持仓承担。在月末端点上，两者对同一批有价股票的等权买入持有收益和逐月复利方式相同，差异来自上述缺价股票的处理，而不是采样频率本身。两者都是理论研究模型，未计交易成本与融券约束。
          </p>
        </details>
      </section>

      <section className="card">
        <h2>年度表现</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>年份</th><th>Rank IC</th><th>年化ICIR</th><th>月频多空（区间）</th><th>日频收益（区间）</th><th>日频 Sharpe</th><th>日频最大回撤</th><th>沪深300（参考）</th></tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const d = dailyYears.get(y.period);
                return (
                  <tr key={y.period}>
                    <td>{y.label}</td><td>{pct(y.mean_rank_ic)}</td><td>{num(y.annualized_icir)}</td><td>{pct(y.return)}</td>
                    <td>{pct(d?.return ?? null)}</td><td>{num(d?.sharpe ?? null)}</td><td>{pct(d?.max_drawdown ?? null)}</td><td>{pct(d?.csi300_return ?? null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {r.paper_comparison && (
        <section className="card">
          <h2>与原文对照</h2>
          <p>{r.paper_comparison.paper_item}；构建可比：{r.paper_comparison.comparable_construction ? "是" : "否（删减版或依赖不同）"}。</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>指标</th><th>本项目</th><th>原文</th><th>相对差</th></tr></thead>
              <tbody>
                {Object.entries(r.paper_comparison.metrics).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k === "rank_ic" ? "Rank IC" : k === "icir" ? "年化ICIR" : "多空年化（算术）"}</td>
                    <td>{k === "icir" ? num(v.replicated) : pct(v.replicated)}</td>
                    <td>{k === "icir" ? num(v.paper) : pct(v.paper)}</td>
                    <td>{pct(v.relative_difference, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="caption">与原文接近或相对差小于 20% 只是参考，不证明计算正确或严格复现。</p>
        </section>
      )}
    </div>
  );
}
