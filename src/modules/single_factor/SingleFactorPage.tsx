import { useEffect, useMemo, useState } from "react";
import DefinitionPerformance from "./DefinitionPerformance";
import StabilityRisk from "./StabilityRisk";
import { BASIS_CN, METHOD_CN, THEME_CN, loadCatalog, loadFactor, type CatalogEntry, type FactorReport, type PoolAnalysis } from "./data";

type Tab = "core" | "stability";
const ALL = "";

// First to last month with a valid long-short return in the selected pool;
// valid Rank IC months only when there is no valid return at all.
function effectivePeriod(a: PoolAnalysis): string {
  const nav = a.long_short_nav.filter((r) => r.monthly_long_short_return !== null && r.nav !== null);
  if (nav.length) return `${nav[0].period_start} 至 ${nav[nav.length - 1].period_end ?? "—"}`;
  const ic = a.monthly_ic.filter((r) => r.rank_ic !== null && r.below_min_n === false);
  if (ic.length) return `${ic[0].date.slice(0, 7)} 至 ${ic[ic.length - 1].date.slice(0, 7)}`;
  return "—";
}

function options(values: string[], labels: Record<string, string>) {
  return [...new Set(values)].map((v) => ({ value: v, label: labels[v] ?? v }));
}

export default function SingleFactorPage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [theme, setTheme] = useState(ALL);
  const [method, setMethod] = useState(ALL);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState<FactorReport | null>(null);
  const [tab, setTab] = useState<Tab>("core");
  const [pool, setPool] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadCatalog()
      .then((entries) => setCatalog(entries.filter((e) => e.published)))
      .catch((e: Error) => setError(e.message));
  }, []);

  const visible = useMemo(
    () => catalog.filter((e) => (theme === ALL || e.research_theme === theme) && (method === ALL || e.method_family === method)),
    [catalog, theme, method],
  );

  useEffect(() => {
    if (visible.length && !visible.some((e) => e.id === selected)) setSelected(visible[0].id);
  }, [visible, selected]);

  useEffect(() => {
    const entry = catalog.find((e) => e.id === selected);
    if (!entry) return;
    let cancelled = false;
    setReport(null);
    setError("");
    loadFactor(entry)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setPool(r.provenance.analysis_pools[0]);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [catalog, selected]);

  const entry = catalog.find((e) => e.id === selected);
  const analysis = report && pool ? report.analysis_by_pool[pool] : undefined;
  const period = analysis ? effectivePeriod(analysis) : "—";
  const ctx = report?.display_context;
  const pools = report?.provenance.analysis_pools ?? [];

  return (
    <>
      <div className="filters">
        <label className="selector">
          <span>研究主题</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value={ALL}>全部</option>
            {options(catalog.map((e) => e.research_theme), THEME_CN).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="selector">
          <span>方法</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value={ALL}>全部</option>
            {options(catalog.map((e) => e.method_family), METHOD_CN).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="selector factor-select">
          <span>因子</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {visible.map((e) => (
              <option key={e.id} value={e.id}>
                Factor {e.id} · {e.name_cn}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {catalog.length > 0 && visible.length === 0 && <p className="loading">没有符合筛选条件的因子。</p>}

      {report && entry && visible.length > 0 && (
        <>
          <section className="summary">
            <h2>
              {report.factor.name_cn} <span className="en">{report.factor.name_en}</span>
            </h2>
            <p className="tags">
              <span>{THEME_CN[entry.research_theme] ?? entry.research_theme}</span>
              <span>{METHOD_CN[entry.method_family] ?? entry.method_family}</span>
              <span>{BASIS_CN[entry.accounting_basis] ?? entry.accounting_basis}</span>
            </p>
            <p>{report.definition.economic_hypothesis}</p>
            <p className="source">
              结果来源：正式验收回测 run {report.provenance.source_run_id}；有效回测期：{period}（月度调仓）。网页只展示已冻结的正式结果，不重新计算回测。
            </p>
          </section>

          {analysis && ctx && (
            <div className="analysis-bar">
              {pools.length > 1 ? (
                <label className="selector">
                  <span>分析市场</span>
                  <select value={pool} onChange={(e) => setPool(e.target.value)}>
                    {pools.map((p) => (
                      <option key={p} value={p}>{report.analysis_by_pool[p].pool_display_name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="pool-tag">分析市场：{analysis.pool_display_name}</span>
              )}
              <p className="context-line">
                {[analysis.pool_display_name, ctx.frequency, ctx.preprocessing, ctx.return_basis, ctx.decile_benchmark, ctx.transaction_cost].join("｜")}
              </p>
            </div>
          )}

          <nav className="tabs">
            <button className={tab === "core" ? "active" : ""} onClick={() => setTab("core")}>定义与核心表现</button>
            <button className={tab === "stability" ? "active" : ""} onClick={() => setTab("stability")}>稳定性与风险</button>
          </nav>

          {analysis &&
            (tab === "core" ? (
              <DefinitionPerformance report={report} pool={pool} />
            ) : (
              <StabilityRisk report={report} pool={pool} />
            ))}
        </>
      )}

      {!report && !error && visible.length > 0 && <p className="loading">加载中…</p>}
    </>
  );
}
