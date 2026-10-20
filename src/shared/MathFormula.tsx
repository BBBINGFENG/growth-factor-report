import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Display-only LaTeX rendering. KaTeX fonts and CSS are bundled by Vite.
function render(tex: string, display: boolean): string {
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", output: "htmlAndMathml" });
}

export function MathBlock({ tex, label }: { tex: string; label?: string }) {
  const html = useMemo(() => render(tex, true), [tex]);
  return <div className="math-block" role="math" aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MathInline({ tex }: { tex: string }) {
  const html = useMemo(() => render(tex, false), [tex]);
  return <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}

export interface FormulaSymbol {
  tex: string;
  meaning: string;
}

export function SymbolList({ symbols }: { symbols: readonly FormulaSymbol[] }) {
  if (!symbols.length) return null;
  return (
    <dl className="symbol-list">
      {symbols.map((s) => (
        <div key={s.tex}>
          <dt><MathInline tex={s.tex} /></dt>
          <dd>{s.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}
