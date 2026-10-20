import { useEffect } from "react";
import { CALCULATION_SECTIONS, type CalculationItem, type FormulaSectionId, type ShowFormula } from "./methodologyDefinitions";
import type { FactorReport } from "./data";
import { FactorFormula } from "./FactorFormula";
import { MathBlock, SymbolList } from "../../shared/MathFormula";

export interface FormulaTarget {
  section: FormulaSectionId;
  request: number;
}

export function FormulaLink({ section, onShow, children }: {
  section: FormulaSectionId;
  onShow: ShowFormula;
  children: string;
}) {
  return <button type="button" className="formula-link" onClick={() => onShow(section)}>{children}</button>;
}

function FormulaItem({ item }: { item: CalculationItem }) {
  return (
    <article className="calculation-item">
      <h3>{item.title}</h3>
      <MathBlock tex={item.tex} label={item.title} />
      {item.symbols && <SymbolList symbols={item.symbols} />}
      <p>{item.explanation}</p>
      {item.note && <p className="method-note">{item.note}</p>}
    </article>
  );
}

export default function CalculationMethods({ report, pool, target, onShow }: {
  report: FactorReport;
  pool: string;
  target: FormulaTarget | null;
  onShow: ShowFormula;
}) {
  const a = report.analysis_by_pool[pool];
  const d = report.definition;
  const negative = d.direction.startsWith("负向");
  const preprocessingUniverse = a.preprocessing_universe === "pool_local"
    ? `所选股票池内独立预处理（${a.pool_display_name}）`
    : "全市场（剔除北交所）内预处理";

  useEffect(() => {
    if (!target) return;
    const section = document.getElementById(`method-${target.section}`);
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [target]);

  return (
    <div className="tab-body calculation-methods">
      <section className="card method-overview">
        <h2>计算公式与口径</h2>
        <p>以下公式按当前回测代码核对。t 表示月度调仓期，i 表示股票，k 表示行业；横截面统计在同一个月内计算，时间序列统计跨月份计算。</p>
        <dl className="spec method-context">
          <dt>当前因子</dt><dd>Factor {report.factor.id} · {report.factor.name_cn}</dd>
          <dt>分析市场</dt><dd>{a.pool_display_name}；{preprocessingUniverse}</dd>
          <dt>频率与收益</dt><dd>月度调仓、日度估值：每月开盘调仓，月内每个交易日收盘估值；日频风险指标为完整策略口径（有效期内每个完整交易日，空仓现金日收益为0），样本标准差 ddof = {a.daily_valuation?.std_ddof ?? "—"}，年化交易日数 A = {a.daily_valuation?.annualization_days ?? "—"}。Rank IC、十档与论文比较仍为月度 E1 开盘到开盘；月频风险保留作对照（年化系数 √12）。</dd>
          <dt>统计约定</dt><dd>标准差使用样本标准差（ddof = 1）；缺失值不补0；百分数按小数存储，展示时乘100%。</dd>
          <dt>因子方向</dt><dd>{negative ? "PEG 为负向：论文比较用原始定义，图表与年度表现用方向翻转后的信号。" : "正向：数值越高越看好，论文比较与图表方向一致。"}</dd>
        </dl>
        <nav className="formula-index" aria-label="公式目录">
          <FormulaLink section="factor" onShow={onShow}>当前因子定义</FormulaLink>
          {CALCULATION_SECTIONS.map((section) => (
            <FormulaLink key={section.id} section={section.id} onShow={onShow}>{section.title}</FormulaLink>
          ))}
        </nav>
      </section>

      <section id="method-factor" className={`card method-section${target?.section === "factor" ? " method-selected" : ""}`} tabIndex={-1} aria-labelledby="method-factor-title">
        <h2 id="method-factor-title">当前因子定义 · Factor {report.factor.id}</h2>
        <FactorFormula definition={d} />
        <dl className="spec">
          <dt>输入字段</dt><dd>{d.input_field}</dd>
          <dt>数据窗口</dt><dd>{d.window}</dd>
          <dt>会计口径</dt><dd>{d.accounting_basis}</dd>
          <dt>因子方向</dt><dd>{d.direction}</dd>
          <dt>缺失处理</dt><dd>{d.missing_rule}</dd>
        </dl>
      </section>

      {CALCULATION_SECTIONS.map((section) => (
        <section id={`method-${section.id}`} key={section.id} className={`card method-section${target?.section === section.id ? " method-selected" : ""}`} tabIndex={-1} aria-labelledby={`method-${section.id}-title`}>
          <h2 id={`method-${section.id}-title`}>{section.title}</h2>
          <p className="method-introduction">{section.introduction}</p>
          {section.items.map((item) => <FormulaItem key={item.title} item={item} />)}
        </section>
      ))}
    </div>
  );
}
