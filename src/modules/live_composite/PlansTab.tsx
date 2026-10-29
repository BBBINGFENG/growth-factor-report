import { useState } from "react";
import { num, pct, type Num } from "../../shared/format";
import { bjTime, money, ymd, type Batch, type ForwardPlan, type LiveIndex, type Positions, type StrategyData } from "./data";

function BatchView({ b, title }: { b: Batch; title: string }) {
  return (
    <>
      <p className="caption">{title} 目标按上一交易日收盘总资产 {money(b.nav_base)} 元与上一交易日收盘价计算，按申报单位向下取整：一手金额高于目标金额的股票目标为 0 股、该份额留现金；不足一个申报单位的增减不下单。目标名单不等于成交名单：订单可能因停牌、涨跌停、流动性上限、现金不足或 T+1 未成交、部分成交或顺延后撤销。</p>
      <details open>
        <summary>目标持仓（{b.targets.length} 只）</summary>
        <div className="table-wrap"><table>
          <thead><tr><th>排名</th><th>代码</th><th>名称</th><th>行业</th><th>组合分数</th><th>目标股数</th><th>目标权重</th></tr></thead>
          <tbody>{b.targets.map((r) => <tr key={r[0]}><td>{r[4]}</td><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{num(r[3], 4)}</td><td>{num(r[5], 0)}</td><td>{pct(r[6])}</td></tr>)}</tbody>
        </table></div>
      </details>
      <details>
        <summary>订单（{b.orders.length} 笔，含撤销与未完成）</summary>
        <div className="table-wrap"><table>
          <thead><tr><th>代码</th><th>名称</th><th>方向</th><th>订单股数</th><th>成交股数</th><th>状态</th><th>原因</th><th>尝试天数</th><th>结束日</th></tr></thead>
          <tbody>{b.orders.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2] === "buy" ? "买入" : "卖出"}</td><td>{num(r[3], 0)}</td><td>{num(r[4], 0)}</td><td>{r[5]}</td><td>{r[6]}</td><td>{r[7]}</td><td>{ymd(r[8])}</td></tr>)}</tbody>
        </table></div>
      </details>
      <details>
        <summary>成交（{b.trades.length} 笔）</summary>
        <div className="table-wrap"><table>
          <thead><tr><th>日期</th><th>代码</th><th>名称</th><th>方向</th><th>股数</th><th>成交价</th><th>成交额</th><th>佣金</th><th>规费</th><th>印花税</th><th>执行成本</th></tr></thead>
          <tbody>{b.trades.map((r, i) => <tr key={i}><td>{ymd(r[0])}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3] === "buy" ? "买入" : "卖出"}</td><td>{num(r[4], 0)}</td><td>{num(r[5] as Num, 3)}</td><td>{money(r[6] as Num)}</td><td>{money(r[7] as Num)}</td><td>{money(r[8] as Num)}</td><td>{money(r[9] as Num)}</td><td>{money(r[10] as Num)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </>
  );
}

function HoldingsView({ dates, positions, label }: { dates: string[]; positions: Positions; label: string }) {
  const [d, setD] = useState(dates[dates.length - 1] ?? "");
  const pos = positions[d];
  const industry = pos ? Object.entries(pos.rows.reduce<Record<string, number>>((acc, r) => {
    acc[r[2]] = (acc[r[2]] ?? 0) + (r[5] ?? 0);
    return acc;
  }, {})).sort((x, y) => y[1] - x[1]) : [];
  return (
    <section className="card">
      <div className="card-head">
        <h2>按日期查看持仓（{label}）</h2>
        <label className="selector"><span>日期</span>
          <select value={d} onChange={(e) => setD(e.target.value)}>{[...dates].reverse().map((x) => <option key={x} value={x}>{ymd(x)}</option>)}</select>
        </label>
      </div>
      {pos ? (
        <>
          <p>总资产 {money(pos.total)} 元；现金 {money(pos.cash)} 元（{pct(pos.cash / pos.total, 1)}）；应收股利 {money(pos.receivable)} 元；持仓 {pos.rows.length} 只。</p>
          <div className="table-wrap"><table>
            <thead><tr><th>代码</th><th>名称</th><th>行业（当日）</th><th>股数</th><th>市值（元）</th><th>权重</th><th>价格状态</th></tr></thead>
            <tbody>{pos.rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{num(r[3], 0)}</td><td>{money(r[4])}</td><td>{pct(r[5])}</td><td>{r[6]}</td></tr>)}</tbody>
          </table></div>
          <h3>行业分布（按收盘市值占总资产）</h3>
          <p>{industry.map(([k, v]) => `${k} ${pct(v, 1)}`).join("；")}</p>
        </>
      ) : <p>该日无持仓（全部现金）。</p>}
    </section>
  );
}

function PlanView({ p }: { p: ForwardPlan }) {
  return (
    <>
      <dl className="spec">
        <dt>执行日 / 截止</dt><dd>{ymd(p.execution_day)} 北京时间 {p.deadline_beijing.slice(11, 16)} 前（信号月 {ymd(p.signal_date)}）</dd>
        <dt>生成时间</dt><dd>{bjTime(p.generated_at_beijing)}（北京时间，计划写完的时刻）</dd>
        <dt>信息截止</dt><dd>信号 {ymd(p.information_cutoff)} 收盘；行情只读到 {ymd(p.market_data_through)}</dd>
        <dt>输入版本</dt><dd>信号 sha256 {p.inputs.signal_sha256?.slice(0, 12)}…；假设 {p.inputs.assumptions_version}；策略 {p.inputs.strategy_version}；计划文件 sha256 {p.sha256.slice(0, 12)}…</dd>
        <dt>计划前账户</dt><dd>现金 {money(p.account_before.cash)} 元；应收股利 {money(p.account_before.receivable)} 元；总资产 {money(p.account_before.total)} 元；持仓 {p.account_before.holdings.length} 只</dd>
      </dl>
      <details><summary>候选名单（分数前 {p.candidates.length} 名，{p.n_scored} 只有有效分数）</summary>
        <div className="table-wrap"><table>
          <thead><tr><th>分数排名</th><th>代码</th><th>名称</th><th>行业</th><th>分数</th><th>入选</th><th>未入选原因</th></tr></thead>
          <tbody>{p.candidates.map((r) => <tr key={r[1]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{num(r[4], 4)}</td><td>{r[5] ? "是" : "否"}</td><td>{r[6]}</td></tr>)}</tbody>
        </table></div>
      </details>
      <details open><summary>目标（{p.targets.length} 只）</summary>
        <div className="table-wrap"><table>
          <thead><tr><th>排名</th><th>代码</th><th>名称</th><th>行业</th><th>分数</th><th>目标权重</th><th>目标金额</th><th>参考价</th><th>目标股数</th><th>说明</th></tr></thead>
          <tbody>{p.targets.map((r) => <tr key={r[1]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{num(r[4], 4)}</td><td>{pct(r[5])}</td><td>{money(r[6])}</td><td>{num(r[7], 3)}</td><td>{num(r[8], 0)}</td><td>{r[9]}</td></tr>)}</tbody>
        </table></div>
      </details>
      <details open><summary>订单（{p.orders.length} 笔）</summary>
        <div className="table-wrap"><table>
          <thead><tr><th>代码</th><th>名称</th><th>方向</th><th>股数</th><th>目标排名</th><th>参考价</th></tr></thead>
          <tbody>{p.orders.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2] === "buy" ? "买入" : "卖出"}</td><td>{num(r[3], 0)}</td><td>{r[4]}</td><td>{num(r[5], 3)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </>
  );
}

export function PlansTab({ index, data, record }: { index: LiveIndex; data: StrategyData; record: "replay" | "forward" }) {
  const [batch, setBatch] = useState(data.batches[data.batches.length - 1]?.signal_date ?? "");
  const fwd = index.records.forward;
  const [plan, setPlan] = useState(data.forward.plans[data.forward.plans.length - 1]?.execution_day ?? "");
  if (record === "forward") {
    const p = data.forward.plans.find((x) => x.execution_day === plan);
    const fb = data.forward.batches ?? [];
    return (
      <div className="tab-body">
        <section className="card">
          <h2>盘前计划（forward 记录）</h2>
          <p className="caption">{fwd.rules.plan_rule}。{fwd.rules.missed_rule}。</p>
          {data.forward.plans.length === 0 ? (
            <p>尚无盘前计划。首个计划对应 {ymd(fwd.start_signal_date)} 调仓，将在其北京时间 {fwd.rules.decision_deadline_beijing} 截止前生成；没有在截止前生成的计划不会事后补写。</p>
          ) : (
            <>
              <label className="selector"><span>执行日</span>
                <select value={plan} onChange={(e) => setPlan(e.target.value)}>{[...data.forward.plans].reverse().map((x) => <option key={x.execution_day} value={x.execution_day}>{ymd(x.execution_day)}</option>)}</select>
              </label>
              {p && <PlanView p={p} />}
            </>
          )}
          {(fwd.missed ?? []).length > 0 && (
            <details open><summary>错过的决策（{(fwd.missed ?? []).length} 条）</summary>
              <ul className="scope-impacts">{(fwd.missed ?? []).map((m, i) => <li key={i}>{m.type === "missed_rebalance" ? "当月未调仓" : "错过截止"}：信号月 {ymd(m.signal_date)}{m.candidate_day ? `，候选执行日 ${ymd(m.candidate_day)}（截止 ${bjTime(m.deadline_beijing)}）` : ""}；发现于 {bjTime(m.detected_at_beijing)}{m.note ? `；${m.note}` : ""}</li>)}</ul>
            </details>
          )}
        </section>
        {fb.length > 0 && (
          <section className="card">
            <h2>计划之后的模拟执行</h2>
            {fb.map((x) => <BatchView key={x.signal_date} b={x} title={`执行日 ${ymd(x.signal_date)}：订单来自上方盘前计划。`} />)}
          </section>
        )}
        {data.forward.dates && data.forward.positions && <HoldingsView dates={data.forward.dates} positions={data.forward.positions} label="forward 记录，费后 10bps" />}
      </div>
    );
  }
  const b = data.batches.find((x) => x.signal_date === batch);
  return (
    <div className="tab-body">
      <section className="card">
        <div className="card-head">
          <h2>调仓批次：计划与执行（历史回放）</h2>
          <label className="selector"><span>批次</span>
            <select value={batch} onChange={(e) => setBatch(e.target.value)}>{[...data.batches].reverse().map((x) => <option key={x.signal_date} value={x.signal_date}>{ymd(x.signal_date)}</option>)}</select>
          </label>
        </div>
        <p className="tags"><span>{data.plan_kind}</span></p>
        {b && <BatchView b={b} title="" />}
      </section>
      <HoldingsView dates={data.dates} positions={data.positions} label="历史回放，费后 10bps" />
      <section className="card">
        <h2>公司行动与特殊事件</h2>
        {data.events.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>日期</th><th>代码</th><th>类型</th><th>持股</th><th>每股</th><th>金额 / 送转股</th><th>派息 / 上市日</th></tr></thead>
            <tbody>{data.events.map((e, i) => (
              <tr key={i}><td>{ymd(String(e.date))}</td><td>{e.ts_code}</td>
                <td>{e.type === "cash_dividend" ? "现金分红" : e.type === "stock_dividend" ? "送转股" : "复权因子变动无法由分红送转解释"}</td>
                <td>{e.shares ?? "—"}</td><td>{e.per_share ?? e.adj_ratio ?? "—"}</td><td>{e.amount ?? e.bonus_shares ?? "—"}</td><td>{ymd(String(e.pay_date ?? e.listing_date ?? ""))}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <p>本策略持仓期内没有分红送转记录。</p>}
      </section>
    </div>
  );
}
