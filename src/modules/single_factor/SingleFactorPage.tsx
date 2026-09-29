import { useEffect, useMemo, useState } from "react";
import DefinitionPerformance from "./DefinitionPerformance";
import StabilityRisk from "./StabilityRisk";
import { BASIS_CN, METHOD_CN, THEME_CN, loadCatalog, loadFactor, type CatalogEntry, type FactorReport } from "./data";

type Tab = "core" | "stability";
const ALL = "";

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
      .then((r) => !cancelled && setReport(r))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [catalog, selected]);

  const entry = catalog.find((e) => e.id === selected);
  const ic = report?.stability.monthly_ic ?? [];
  const period = ic.length ? `${ic[0].date.slice(0, 7)} 至 ${ic[ic.length - 1].date.slice(0, 7)}` : "";
  const pools = report?.core_performance.pool_metrics.map((m) => m.pool) ?? [];
  const chartPool = report?.provenance.primary_branch.pool;
  const poolNote =
    pools.length > 1 && chartPool === "csi_all" && !pools.includes("market_ex_bje")
      ? "该因子没有全市场论文 benchmark，图表使用其论文股票池中最宽的中证全指；这是网站展示选择，不是论文规定或研究结论。"
      : pools.length > 1
        ? "该因子有多个论文股票池，图表使用全市场。"
        : "";

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
              结果来源：正式验收回测 run {report.provenance.source_run_id}；图表展示股票池：
              {report.provenance.primary_branch.pool_display_name}；样本期：{period}（月度调仓）。
              {poolNote}
              网页只展示已冻结的正式结果，不重新计算回测。
            </p>
          </section>

          <nav className="tabs">
            <button className={tab === "core" ? "active" : ""} onClick={() => setTab("core")}>定义与核心表现</button>
            <button className={tab === "stability" ? "active" : ""} onClick={() => setTab("stability")}>稳定性与风险</button>
          </nav>

          {tab === "core" ? <DefinitionPerformance report={report} /> : <StabilityRisk report={report} />}
        </>
      )}

      {!report && !error && visible.length > 0 && <p className="loading">加载中…</p>}
    </>
  );
}
