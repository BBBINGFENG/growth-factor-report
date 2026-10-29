import { useMemo, useState } from "react";
import FactorChart, { type Series } from "../../shared/FactorChart";
import { MathBlock, SymbolList } from "../../shared/MathFormula";
import { num, pct, type Num } from "../../shared/format";
import { LAYERS, LAYER_CN, money, ymd, type CashBatch, type Formula, type LiveIndex, type StrategyData } from "./data";

export function Formulas({ items }: { items: Formula[] }) {
  return (
    <>
      {items.map((f) => (
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
    </>
  );
}

const LAYER_COLOR = { ideal: "#7f7f7f", gross: "#4f81bd", base: "#1f4e79" } as const;

export function LayersTab({ index, data }: { index: LiveIndex; data: StrategyData }) {
  const d = data.diagnostics.layers;
  const cats = useMemo(() => data.dates.map(ymd), [data]);
  const series: Series[] = LAYERS.map((k) => ({ name: LAYER_CN[k], data: data.nav[k], color: LAYER_COLOR[k], width: k === "base" ? 1.75 : 1.25, dashed: k === "ideal" }));
  return (
    <div className="tab-body">
      <section className="card">
        <h2>三层组合对照（反事实对照，不是收益归因）</h2>
        <p className="caption">{index.layer_definitions.note}
          {data.diagnostics.same_targets_across_layers ? " 本策略三层在每个批次的目标名单逐只一致（已核对）。" : " 注意：三层目标名单未能核对一致。"}</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>层</th><th>区间收益</th><th>期末资产（元）</th><th>平均现金比例</th><th>双边换手（倍）</th><th>平均持股数</th><th>平均持有目标股数</th><th>目标股票权重合计（均值）</th><th>订单完成比例</th><th>成本合计（元）</th></tr></thead>
            <tbody>{LAYERS.map((k) => {
              const x = d.layers[k];
              return <tr key={k}><td>{LAYER_CN[k]}</td><td>{pct(x.return)}</td><td>{money(x.final)}</td><td>{pct(x.cash_ratio_mean, 1)}</td><td>{num(x.turnover)}</td>
                <td>{num(x.n_holdings_mean, 1)}</td><td>{num(x.n_targets_held_mean, 1)}</td><td>{pct(x.target_weight_held_mean, 1)}</td><td>{pct(x.fill_ratio, 1)}</td><td>{money(x.costs)}</td></tr>;
            })}</tbody>
          </table>
        </div>
        <FactorChart title="三层净值（起始 = 1，每日收盘）" categories={cats} series={series} valueFormat="number" height={300} />
      </section>
      <section className="card">
        <h2>差异主要出现在哪些月份</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>月份</th>{LAYERS.map((k) => <th key={k}>{LAYER_CN[k]}</th>)}<th>费前 − 理想</th><th>费后 − 费前</th></tr></thead>
            <tbody>{d.months.map((m) => (
              <tr key={m.month}><td>{m.month.slice(0, 4)}-{m.month.slice(4)}</td>{LAYERS.map((k) => <td key={k}>{pct(m[k])}</td>)}
                <td>{pct(diff(m.gross, m.ideal))}</td><td>{pct(diff(m.base, m.gross))}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="caption">月收益按各层各自的月末总资产计算；差值为两层月收益之差（百分点），三层的资金与持仓路径不同，差值不能逐月相加成总差异。</p>
      </section>
      <section className="card">
        <h2>差异主要出现在哪些股票</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>代码</th><th>名称</th>{LAYERS.map((k) => <th key={k}>{LAYER_CN[k]}损益（元）</th>)}<th>费前 − 理想</th><th>费后 − 费前</th></tr></thead>
            <tbody>{d.stocks.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td>{[2, 3, 4, 5, 6].map((i) => <td key={i}>{money(r[i] as Num)}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="caption">列出两类差异绝对值各自最大的 10 只股票。损益口径见“风险与损益来源”。费前与费后的个股损益差包含费用，也包含因现金差异导致的股数与后续持仓变化。</p>
      </section>
      <section className="card">
        <h2>三层定义</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>项目</th>{index.layer_definitions.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{index.layer_definitions.rows.map((r) => <tr key={r[0]}>{r.map((x, i) => <td key={i} className="wrap-cell">{x}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <Formulas items={index.formulas.filter((f) => f.section === "layers")} />
      </section>
    </div>
  );
}

function diff(a: Num, b: Num): Num {
  return a === null || b === null ? null : a - b;
}

const PLAN_CN: Record<string, string> = {
  unallocated: "名单不足 30 只的未分配额度", zero_share_targets: "目标为 0 股（一手高于目标金额）", rounding: "按申报单位向下取整的余额",
  unit_rule_residual: "不足一个申报单位未下单的偏差", receivable: "应收股利（非现金）", ex_date_adjustment: "调仓日除权除息估值差",
};
const EXEC_CN: Record<string, string> = {
  unfilled_sells: "未成交卖单（按参考价）", price_gap: "开盘价相对参考价的差额", execution_cost: "执行成本", fees: "费用", dividends_paid: "窗口内到账股利",
};

export function CashTab({ index, data }: { index: LiveIndex; data: StrategyData }) {
  const [layer, setLayer] = useState<"base" | "gross">("base");
  const batches = data.diagnostics.cash[layer];
  const [sel, setSel] = useState(batches[batches.length - 1]?.batch ?? "");
  const b: CashBatch | undefined = batches.find((x) => x.batch === sel) ?? batches[batches.length - 1];
  return (
    <div className="tab-body">
      <section className="card">
        <div className="card-head">
          <h2>每个调仓批次：目标、持股与偏离</h2>
          <label className="selector"><span>账户</span>
            <select value={layer} onChange={(e) => setLayer(e.target.value as "base" | "gross")}>
              <option value="base">可交易费后</option><option value="gross">可交易费前</option>
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>批次</th><th>窗口末日</th><th>目标数</th><th>目标股数 &gt; 0</th><th>实际持股</th><th>其中在目标内</th><th>目标外滞留</th><th>权重偏离 ½Σ|Δw|</th><th>最大单票偏离</th><th>买单完成比例</th><th>首日完成 / 已完成买单</th><th>最长完成天数</th><th>窗口末现金（元）</th><th>目标缺口（元，非现金）</th></tr></thead>
            <tbody>{batches.map((x) => (
              <tr key={x.batch} className={x.batch === b?.batch ? "selected-row" : ""} onClick={() => setSel(x.batch)} style={{ cursor: "pointer" }}>
                <td>{ymd(x.batch)}</td><td>{ymd(x.window_end)}</td><td>{x.n_targets}</td><td>{x.n_nonzero_targets}</td><td>{x.n_held}</td><td>{x.n_targets_held}</td><td>{x.n_held_outside_targets}</td>
                <td>{pct(x.weight_deviation_half_l1, 1)}</td><td>{pct(x.max_weight_deviation, 1)}</td><td>{pct(x.buy_fill_ratio, 1)}</td>
                <td>{x.buy_days_to_fill.first_day} / {x.buy_days_to_fill.n}</td><td>{x.buy_days_to_fill.max}</td><td>{money(x.cash_at_window_end)}</td><td>{money(x.target_shortfall_value)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="caption">窗口为调仓日至下一调仓日前一交易日。权重偏离以名单内每只 1/30 为目标，含取整、未成交、价格漂移与现金的共同影响。“目标缺口”是目标股数中未持有部分按参考价计的金额，与账户现金不是同一概念，不能相加。点击一行查看该批次的现金拆分。</p>
      </section>
      {b && (
        <section className="card">
          <h2>{ymd(b.batch)} 批次的现金拆分（元）</h2>
          <div className="pair-grid">
            <div>
              <h3>计划现金（调仓前、参考价、无成本）</h3>
              <table>
                <tbody>
                  <tr><td>调仓前现金 K₀</td><td>{money(b.cash_before)}</td></tr>
                  {Object.entries(b.plan).map(([k, v]) => <tr key={k}><td>{PLAN_CN[k] ?? k}</td><td>{money(v)}</td></tr>)}
                  <tr className="selected-row"><td>计划现金 K*</td><td>{money(b.planned_cash)}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3>执行窗口内的变化（K_W − K*）</h3>
              <table>
                <tbody>
                  {Object.entries(b.execution.unfilled_buys).map(([k, v]) => <tr key={k}><td>未成交买单：{k}{k.startsWith("现金不足") ? "（费用、价差与未成交卖单的共同结果，无法唯一归因）" : ""}</td><td>{money(v)}</td></tr>)}
                  {Object.entries(EXEC_CN).map(([k, label]) => <tr key={k}><td>{label}</td><td>{money((b.execution as unknown as Record<string, Num>)[k])}</td></tr>)}
                  <tr className="selected-row"><td>窗口末现金 K_W</td><td>{money(b.cash_at_window_end)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <p className="caption">两张表各自是恒等式（逐批核对，残差为 0）。正数增加现金、负数减少现金；现金影响可正可负，不统称为 cash drag。未成交金额按参考价计，用来说明现金来源，本身不是现金。</p>
          {b.zero_share_targets.length > 0 && (
            <p>因申报数量限制目标为 0 股：{b.zero_share_targets.map((r) => `${r[0]} ${r[1]}（一手 ${money(r[4])} 元 > 目标 ${money(r[3])} 元）`).join("；")}</p>
          )}
          {b.unit_rule_not_placed.length > 0 && (
            <details><summary>不足一个申报单位未下单（{b.unit_rule_not_placed.length} 只）</summary>
              <div className="table-wrap"><table>
                <thead><tr><th>代码</th><th>名称</th><th>说明</th><th>调仓前股数</th><th>目标股数</th></tr></thead>
                <tbody>{b.unit_rule_not_placed.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{num(r[3], 0)}</td><td>{num(r[4], 0)}</td></tr>)}</tbody>
              </table></div>
            </details>
          )}
          {b.lingering.length > 0 ? (
            <details><summary>长期未成交的订单（超过 5 个交易日）</summary>
              <div className="table-wrap"><table>
                <thead><tr><th>代码</th><th>名称</th><th>方向</th><th>未成交股数</th><th>尝试天数</th><th>原因</th></tr></thead>
                <tbody>{b.lingering.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2] === "buy" ? "买入" : "卖出"}</td><td>{num(r[3], 0)}</td><td>{r[4]}</td><td>{r[5]}</td></tr>)}</tbody>
              </table></div>
            </details>
          ) : <p className="caption">本批次没有超过 5 个交易日仍未成交的订单。</p>}
        </section>
      )}
      <section className="card">
        <h2>口径</h2>
        <Formulas items={index.formulas.filter((f) => f.section === "cash")} />
      </section>
    </div>
  );
}

export function RiskTab({ index, data }: { index: LiveIndex; data: StrategyData }) {
  const r = data.diagnostics.risk;
  const [layer, setLayer] = useState<"base" | "gross" | "ideal">("base");
  const p = data.diagnostics.pnl[layer];
  const [ind, setInd] = useState(r.industry[r.industry.length - 1]?.date ?? "");
  const ie = r.industry.find((x) => x.date === ind) ?? r.industry[r.industry.length - 1];
  const cats = useMemo(() => data.dates.map(ymd), [data]);
  return (
    <div className="tab-body">
      <section className="card">
        <h2>市场 beta（日收益回归）</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>市场收益</th><th>样本</th><th>交易日数</th><th>beta</th><th>标准误</th><th>日截距</th><th>截距标准误</th><th>R²</th></tr></thead>
            <tbody>{r.beta.map((x) => <tr key={x.market}><td>{x.market}</td><td>{ymd(x.start)} 至 {ymd(x.end)}</td><td>{x.n}</td><td>{num(x.beta ?? null, 3)}</td><td>{num(x.beta_se ?? null, 3)}</td><td>{pct(x.intercept_daily ?? null, 3)}</td><td>{pct(x.intercept_se ?? null, 3)}</td><td>{num(x.r2 ?? null, 3)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="caption">可交易费后账户；样本为前一交易日收盘有持仓的交易日。截距和残差不等于 alpha：样本不足一年，截距的标准误远大于其数值时不能据此下结论。C13 为残差分数选股的多头账户，同样有接近 1 的市场暴露。</p>
      </section>
      <section className="card">
        <div className="card-head">
          <h2>行业权重与主动权重</h2>
          <label className="selector"><span>月末</span>
            <select value={ie?.date} onChange={(e) => setInd(e.target.value)}>{[...r.industry].reverse().map((x) => <option key={x.date} value={x.date}>{ymd(x.date)}</option>)}</select>
          </label>
        </div>
        {ie && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>申万一级行业</th><th>策略权重</th><th>参考组合权重</th><th>主动权重</th></tr></thead>
              <tbody>{ie.rows.map((x) => <tr key={String(x[0])}><td>{x[0] ?? "未分类"}</td><td>{pct(x[1], 1)}</td><td>{pct(x[2], 1)}</td><td>{pct(x[3], 1)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <p className="caption">策略权重以总资产为分母（股票合计 {pct(ie?.stock_weight ?? null, 1)}，其余为现金与应收股利）；参考组合为同一股票池月初开盘等权、随价格漂移。行业按持有当日所处信号月的申万一级分类，不把最新分类倒填历史。按主动权重绝对值排序。</p>
      </section>
      <section className="card">
        <h2>持仓市值分布（相对股票池五分位）</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>批次</th><th>窗口末日</th><th>Q1（最小）</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Q5（最大）</th><th>不在当月股票池</th><th>持仓市值中位数（亿元）</th><th>股票池中位数（亿元）</th></tr></thead>
            <tbody>{r.size.map((x) => <tr key={x.batch}><td>{ymd(x.batch)}</td><td>{ymd(x.date)}</td>{["Q1", "Q2", "Q3", "Q4", "Q5", "outside"].map((k) => <td key={k}>{pct(x.weights[k], 1)}</td>)}<td>{num(x.median_mv_holdings_yi, 1)}</td><td>{num(x.median_mv_pool_yi, 1)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="caption">分位按信息截止日总市值在当月股票池内划分（每档约 20% 的股票数）；持仓比例为窗口末日股票市值内的占比。</p>
      </section>
      <section className="card">
        <h2>集中度</h2>
        <p>最大单票权重峰值 {pct(r.concentration.summary.max_weight_max, 1)}；前五大权重均值 {pct(r.concentration.summary.top5_weight_mean, 1)}；持股数最少 {r.concentration.summary.n_holdings_min} 只，平均 {num(r.concentration.summary.n_holdings_mean, 1)} 只。</p>
        <FactorChart title="最大单票与前五大权重（每日收盘）" categories={cats} valueFormat="percent" height={220}
          series={[{ name: "最大单票", data: r.concentration.max_weight, color: "#c0504d", width: 1.25 }, { name: "前五大", data: r.concentration.top5_weight, color: "#1f4e79", width: 1.25 }]} />
      </section>
      <section className="card">
        <div className="card-head">
          <h2>损益来源（与账户逐日对账）</h2>
          <label className="selector"><span>层</span>
            <select value={layer} onChange={(e) => setLayer(e.target.value as "base" | "gross" | "ideal")}>{LAYERS.slice().reverse().map((k) => <option key={k} value={k}>{LAYER_CN[k]}</option>)}</select>
          </label>
        </div>
        <p>账户损益 {money(p.account_pnl)} 元 = 个股损益合计 {money(p.stock_pnl_sum)} 元（残差 {num(p.residual, 6)}；逐日最大残差 {num(p.max_daily_residual, 6)}）。共 {p.concentration.n_stocks} 只股票，{p.concentration.n_positive} 只为正；
          前五大盈利股合计 {money(p.concentration.top5_stock_pnl)} 元，占全部正损益的 {pct(p.concentration.top5_share_of_positive, 1)}
          {p.concentration.top5_share_of_total !== null ? `、占账户总损益的 ${pct(p.concentration.top5_share_of_total, 1)}` : "（账户总损益为负，不报告占总损益比例）"}。</p>
        <details open><summary>按月份</summary>
          <div className="table-wrap"><table>
            <thead><tr><th>月份</th><th>月初资产</th><th>月末资产</th><th>月收益</th><th>个股损益合计</th><th>残差</th><th>贡献最大</th><th>拖累最大</th></tr></thead>
            <tbody>{p.months.map((m) => <tr key={m.month}><td>{m.month.slice(0, 4)}-{m.month.slice(4)}</td><td>{money(m.start)}</td><td>{money(m.end)}</td><td>{pct(m.return)}</td><td>{money(m.stock_pnl)}</td><td>{num(m.residual, 6)}</td>
              <td className="wrap-cell">{m.top.map((x) => `${x[1] || x[0]} ${pct(x[3], 2)}`).join("；")}</td><td className="wrap-cell">{m.bottom.map((x) => `${x[1] || x[0]} ${pct(x[3], 2)}`).join("；")}</td></tr>)}</tbody>
          </table></div>
        </details>
        <details><summary>按行业（{p.industries.length} 个）</summary>
          <div className="table-wrap"><table>
            <thead><tr><th>申万一级行业</th><th>损益（元）</th><th>其中股利</th><th>其中费用</th><th>贡献（÷初始资金）</th></tr></thead>
            <tbody>{p.industries.map((x) => <tr key={String(x[0])}><td>{x[0] ?? "未分类"}</td><td>{money(x[1])}</td><td>{money(x[2])}</td><td>{money(x[3])}</td><td>{pct(x[4])}</td></tr>)}</tbody>
          </table></div>
          <p className="caption">按持有当日的行业加总；行业损益贡献不等于行业择时能力。</p>
        </details>
        <details><summary>按股票（{p.stocks.length} 只）</summary>
          <div className="table-wrap"><table>
            <thead><tr><th>代码</th><th>名称</th><th>最近行业</th><th>净损益</th><th>价格损益</th><th>股利</th><th>费用</th><th>其中执行成本</th><th>贡献</th><th>持有天数</th></tr></thead>
            <tbody>{p.stocks.map((x) => <tr key={x[0]}><td>{x[0]}</td><td>{x[1]}</td><td>{x[2]}</td><td>{money(x[3])}</td><td>{money(x[4])}</td><td>{money(x[5])}</td><td>{money(x[6])}</td><td>{money(x[7])}</td><td>{pct(x[8])}</td><td>{x[9]}</td></tr>)}</tbody>
          </table></div>
          <p className="caption">价格损益 = 市值变动 + 卖出额 − 买入额（成交额已含执行成本，“其中执行成本”单列供核对）；净损益 = 价格损益 + 股利 − 费用。贡献以初始资金为分母。</p>
        </details>
        <Formulas items={index.formulas.filter((f) => f.section === "risk")} />
      </section>
    </div>
  );
}
