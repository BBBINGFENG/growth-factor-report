import { MathBlock, SymbolList } from "../../shared/MathFormula";
import type { Method, Section } from "./data";

// One formula block per analysis section, shared by its two charts. Text comes from index.json;
// section ① shows the block of the selected correlation method.
export default function FormulaPanel({ section, params, method }: { section: Section; params: string[]; method?: Method }) {
  const f = (method && section.methods?.[method]) || section;
  return (
    <>
      <h2>{section.title}</h2>
      <p>{f.description}</p>
      <MathBlock tex={f.tex} label={section.title} />
      <SymbolList symbols={f.symbols} />
      <p className="formula-params">当前参数：{params.join("；")}</p>
    </>
  );
}
