import { MathBlock, SymbolList } from "../../shared/MathFormula";
import { pct } from "../../shared/format";
import type { CompositeReport } from "./data";

interface ShareFullSix {
  of_valid_C12_stock_months: number;
  of_valid_C12_stock_months_from_common_start: number;
  of_market_ex_bje_stock_months: number;
  denominators: Record<string, number>;
  common_start: string;
}

export default function MethodTab({ report: r }: { report: CompositeReport }) {
  const s = r.structure;
  const share = (r.method_detail?.share_full_six ?? null) as ShareFullSix | null;
  return (
    <div className="tab-body">
      <section className="card">
        <h2>组成与层级</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>成分</th><th>名称</th></tr></thead>
            <tbody>
              {s.components.map((c) => <tr key={c.id}><td>{c.id}</td><td>{c.name_cn}</td></tr>)}
            </tbody>
          </table>
        </div>
        <dl className="spec">
          {s.hierarchy && (<><dt>层级</dt><dd>{s.hierarchy}</dd></>)}
          <dt>权重</dt><dd>{s.weights}</dd>
          <dt>缺失值处理</dt><dd>{s.missing_rule}</dd>
          <dt>股票池</dt><dd>{s.universe}</dd>
          <dt>方向</dt><dd>全部成分方向统一为“越大越好”后再处理；组合值越大，分组越靠近 G10。</dd>
        </dl>
      </section>

      <section className="card">
        <h2>计算公式</h2>
        {s.formula_tex && <MathBlock tex={s.formula_tex} label={`${r.id} 公式`} />}
        <SymbolList symbols={s.formula_symbols} />
        {r.id !== "C13" && r.id !== "C08" && (
          <>
            <p className="caption">各成分（或 C12 的各类别、D01 的各组件）先经组合预处理路线：</p>
            <MathBlock tex={s.route_tex} label="组合预处理路线" />
            <SymbolList symbols={s.route_symbols} />
          </>
        )}
        <MathBlock tex={s.mean_tex} label="有效子项等权" />
        <p className="caption">公式只说明已冻结结果的计算方式，网页不执行计算。</p>
      </section>

      {r.implementation_choices.length > 0 && (
        <section className="card">
          <h2>已确认的实施选择（implementation choices）</h2>
          <ul className="scope-impacts">
            {r.implementation_choices.map((c) => (
              <li key={c.item}>
                <strong>{c.item}</strong>：{c.choice}。原文情况：{c.paper_basis}
                {c.supporting_context ? `；依据：${c.supporting_context}` : ""}
                {c.user_confirmed === true ? `（已确认${c.confirmed_on ? `，${c.confirmed_on}` : ""}）` : `（${String(c.user_confirmed)}）`}
              </li>
            ))}
          </ul>
          <p className="caption">这些是原文未完整指定的细节，不是原文唯一实现。</p>
        </section>
      )}

      {share && (
        <section className="card">
          <h2>C12 的动态类别权重</h2>
          <p>每个股票月只对有效类别等权（权重 = 1 / 有效类别数）。六类齐全的股票月占比，按不同分母分别为：</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>分母</th><th>股票月数</th><th>六类齐全占比</th></tr></thead>
              <tbody>
                <tr><td>C12 有效股票月（全期）</td><td>{share.denominators.valid_C12_stock_months}</td><td>{pct(share.of_valid_C12_stock_months, 1)}</td></tr>
                <tr><td>C12 有效股票月（{share.common_start.slice(0, 4)}-{share.common_start.slice(4, 6)} 起）</td><td>{share.denominators.valid_C12_stock_months_from_common_start}</td><td>{pct(share.of_valid_C12_stock_months_from_common_start, 1)}</td></tr>
                <tr><td>market_ex_bje 全部股票月</td><td>{share.denominators.market_ex_bje_stock_months}</td><td>{pct(share.of_market_ex_bje_stock_months, 1)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="caption">各月有效类别数的分布见“覆盖与样本”。</p>
        </section>
      )}

      {r.erratum && (
        <section className="card">
          <h2>说明勘误</h2>
          <p>{r.erratum.correct}</p>
          <p className="caption">计算是否受影响：{r.erratum.computation_affected ? "是" : "否（只更正说明）"}。</p>
        </section>
      )}
    </div>
  );
}
