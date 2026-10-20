import { useMemo } from "react";
import FactorChart, { type Series } from "../../shared/FactorChart";
import { pct } from "../../shared/format";
import { ymd, type CompositeReport, type PeriodCoverage } from "./data";

const LABEL: Record<string, string> = { all: "整体", since_2021: "2021年至今" };

function CoverageTable({ rows, ratio, title }: { rows: Record<string, PeriodCoverage>; ratio: boolean; title?: string }) {
  return (
    <div className="table-wrap">
      <table>
        {title && <caption>{title}</caption>}
        <thead>
          <tr><th>区间</th><th>统计月数</th><th>首月</th><th>末月</th><th>平均股票池</th><th>平均有效信号</th><th>平均覆盖率</th></tr>
        </thead>
        <tbody>
          {Object.entries(rows).map(([k, c]) => (
            <tr key={k}>
              <td>{LABEL[k] ?? k}</td><td>{c.months}</td><td>{ymd(c.first_month)}</td><td>{ymd(c.last_month)}</td>
              <td>{c.mean_universe === null ? "—" : Math.round(c.mean_universe)}</td>
              <td>{c.mean_valid === null ? "—" : Math.round(c.mean_valid)}</td>
              <td>{ratio ? pct(c.mean_coverage) : "不报告"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CoverageTab({ report: r }: { report: CompositeReport }) {
  const m = r.series.monthly;
  const cats = useMemo(() => m.dates.map((d) => d.slice(0, 7)), [r]);
  const isD01 = r.id === "D01";
  const ep = r.effective_period;
  const catSeries = useMemo(() => {
    if (!m.n_categories) return null;
    const keys = Object.keys(m.n_categories).filter((k) => k !== "0").sort();
    const colors = ["#d9d9d9", "#bfbfbf", "#a6a6a6", "#7f7f7f", "#4f81bd", "#1f4e79"];
    return keys.map((k, i): Series => ({ name: `${k} 类`, data: m.n_categories![k], color: colors[i % colors.length], width: 1.25 }));
  }, [r]);

  return (
    <div className="tab-body">
      <section className="card">
        <h2>有效区间</h2>
        <dl className="spec">
          <dt>首个持仓月</dt><dd>{ymd(ep.start)}（日度估值终点 {ymd(ep.end)}）</dd>
          <dt>信号日历</dt><dd>{ep.signal_calendar_months} 个月（2010-01 至 2026-07）</dd>
          <dt>不可用月份</dt>
          <dd>{ep.factor_unavailable_months > 0
            ? `${ep.factor_unavailable_months} 个（至 ${ymd(ep.factor_unavailable_last_month)}）：信号尚不可用，不建仓、不计现金收益、不进入覆盖率平均`
            : "无"}</dd>
          <dt>现金月</dt><dd>{ep.cash_months.length ? ep.cash_months.join("、") : "无"}</dd>
        </dl>
      </section>

      <section className="card">
        <h2>覆盖率（按区间）</h2>
        <CoverageTable rows={r.coverage_by_period} ratio={!isD01} />
        {Object.values(r.comparisons).map((c) => (
          <CoverageTable key={c.from} rows={c.coverage_by_period} ratio
                         title={`共同区间对照：自 ${c.from.slice(0, 4)}-${c.from.slice(4, 6)} 起（统计全部有效信号股票，不只保留六类齐全者）`} />
        ))}
        <p className="caption">
          分母：{r.coverage_denominator}。每一行只用该区间内有有效信号的月份；平均股票池、平均有效信号和平均覆盖率使用同一组月份，覆盖率为逐月（有效信号数 ÷ 当月股票池）的平均。
          {isD01 && " D01 只报告数量：股票池为 D01 基础股票池，有效信号为估值股票池内的 D01 分数。"}
        </p>
        {!isD01 && <FactorChart title="逐月覆盖率" categories={cats} series={[{ name: "有效信号 / 股票池", data: m.coverage, color: "#1f4e79" }]} valueFormat="percent" height={240} />}
        <FactorChart title="逐月有效信号数与股票池" categories={cats}
                     series={[{ name: "股票池", data: m.universe, color: "#7f7f7f" }, { name: "有效信号", data: m.valid, color: "#1f4e79" }]}
                     valueFormat="number" height={240} />
      </section>

      {catSeries && (
        <section className="card">
          <h2>C12 每月有效类别数</h2>
          <FactorChart title="各有效类别数的股票数" categories={cats} series={catSeries} valueFormat="number" height={280} />
          <p className="caption">C12 对每个股票月的有效类别等权；六类齐全时各 1/6，缺类时对剩余类别重新等权。C03（F26）2014-11 前不可用、之后约四成股票有值，是类别不全的主要原因。</p>
        </section>
      )}
    </div>
  );
}
