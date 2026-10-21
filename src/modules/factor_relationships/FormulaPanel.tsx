import { MathBlock, SymbolList } from "../../shared/MathFormula";
import type { Method, Section } from "./data";

// One formula block per analysis section. Text comes from index.json; section ① shows the block of the
// selected correlation method. Symbols and the detailed parameters fold away so the charts stay together.
export default function FormulaPanel({ section, params, method }: { section: Section; params: string[]; method?: Method }) {
  const f = (method && section.methods?.[method]) || section;
  return (
    <div className="formula-panel">
      <h3>{section.title}</h3>
      <p>{f.description}</p>
      <MathBlock tex={f.tex} label={section.title} />
      <details className="formula-details">
        <summary>符号说明与口径</summary>
        <SymbolList symbols={f.symbols} />
        <p className="formula-params">当前参数：{params.join("；")}</p>
      </details>
    </div>
  );
}
