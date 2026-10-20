import { MathBlock, SymbolList } from "../../shared/MathFormula";
import type { FactorReport } from "./data";

// The factor definition as published by the research layer: LaTeX when the
// report carries it, otherwise the plain-text formula.
export function FactorFormula({ definition: d }: { definition: FactorReport["definition"] }) {
  if (!d.formula_tex) return <pre className="formula">{d.formula}</pre>;
  return (
    <>
      <MathBlock tex={d.formula_tex} label="因子公式" />
      {d.formula_symbols && <SymbolList symbols={d.formula_symbols} />}
    </>
  );
}
