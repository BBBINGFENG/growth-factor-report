import { useEffect, useState } from "react";
import CorePerformance from "./CorePerformance";
import StabilityRisk from "./StabilityRisk";
import { loadFactor, loadIndex, type FactorIndexEntry, type FactorReport } from "./factorData";

type Tab = "core" | "stability";

export default function App() {
  const [index, setIndex] = useState<FactorIndexEntry[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [report, setReport] = useState<FactorReport | null>(null);
  const [tab, setTab] = useState<Tab>("core");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    loadIndex()
      .then((entries) => {
        setIndex(entries);
        if (entries.length) setSelected(entries[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    const entry = index.find((e) => e.id === selected);
    if (!entry) return;
    let cancelled = false;
    setReport(null);
    loadFactor(entry)
      .then((r) => !cancelled && setReport(r))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [index, selected]);

  const ic = report?.stability.monthly_ic ?? [];
  const period = ic.length ? `${ic[0].date.slice(0, 7)} 至 ${ic[ic.length - 1].date.slice(0, 7)}` : "";

  return (
    <div className="page">
      <header className="header">
        <div className="title">
          <h1>成长因子单因子回测</h1>
          <p className="subtitle">复现：招商证券《成长投资全解析——基本面量化系列研究之六》</p>
        </div>
        <label className="selector">
          <span>因子</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {index.map((e) => (
              <option key={e.id} value={e.id}>
                Factor {e.id} · {e.name_cn}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && <p className="error">{error}</p>}

      {report && (
        <>
          <section className="summary">
            <h2>
              {report.factor.name_cn} <span className="en">{report.factor.name_en}</span>
            </h2>
            <p>{report.definition.economic_hypothesis}</p>
            <p className="source">
              结果来源：正式验收回测 run {report.provenance.source_run_id}；股票池：{report.provenance.primary_branch.pool_display_name}；
              样本期：{period}（月度调仓）。网页只展示已冻结的正式结果，不重新计算回测。
            </p>
          </section>

          <nav className="tabs">
            <button className={tab === "core" ? "active" : ""} onClick={() => setTab("core")}>定义与核心表现</button>
            <button className={tab === "stability" ? "active" : ""} onClick={() => setTab("stability")}>稳定性与风险</button>
          </nav>

          {tab === "core" ? <CorePerformance report={report} /> : <StabilityRisk report={report} />}
        </>
      )}

      {!report && !error && <p className="loading">加载中…</p>}
    </div>
  );
}
