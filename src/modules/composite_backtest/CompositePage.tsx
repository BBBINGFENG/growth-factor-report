import { useEffect, useState } from "react";
import { loadComposite, loadCompositeCatalog, STATUS_CN, ymd, type CatalogItem, type CompositeCatalog, type CompositeReport } from "./data";
import MethodTab from "./MethodTab";
import PerformanceTab from "./PerformanceTab";
import CoverageTab from "./CoverageTab";
import StatusTab from "./StatusTab";

type Tab = "method" | "performance" | "coverage" | "status";
const GROUPS: { role: CatalogItem["role"]; label: string }[] = [
  { role: "main", label: "主要组合" },
  { role: "intermediate", label: "中间组合（C08 的输入）" },
  { role: "dependency", label: "外部依赖" },
];

export default function CompositePage() {
  const [catalog, setCatalog] = useState<CompositeCatalog | null>(null);
  const [selected, setSelected] = useState("C01");
  const [report, setReport] = useState<CompositeReport | null>(null);
  const [tab, setTab] = useState<Tab>("method");
  const [error, setError] = useState("");

  useEffect(() => {
    loadCompositeCatalog().then(setCatalog).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    const item = catalog?.items.find((i) => i.id === selected);
    if (!item) return;
    let cancelled = false;
    setReport(null);
    loadComposite(item)
      .then((r) => !cancelled && setReport(r))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [catalog, selected]);

  const item = catalog?.items.find((i) => i.id === selected);

  return (
    <>
      <div className="filters">
        <label className="selector factor-select">
          <span>组合</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {GROUPS.map((g) => (
              <optgroup key={g.role} label={g.label}>
                {catalog?.items.filter((i) => i.role === g.role).map((i) => (
                  <option key={i.id} value={i.id}>{i.id} · {i.name_cn}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {catalog && (
        <section className="card research-scope" aria-labelledby="composite-notice">
          <h2 id="composite-notice">{catalog.notice.title}</h2>
          <ul className="scope-impacts">
            {catalog.notice.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <details>
            <summary>审查状态说明</summary>
            <ul className="scope-impacts">
              <li>组合：12 个组合的计算链经实现者分公式复核与 Codex 外部独立审查；rev3 覆盖统计修复经 Codex 复审。</li>
              <li>D01：受限研究基线（冻结 run 状态仍为 candidate）；原实现者计算核验之外，Codex 限定范围独立计算审查已通过（财务 as-of 累计抽查 8 个日期，非逐一验证全部历史日期）。</li>
              <li>以上都不代表严格 PIT、原始数据历史版本完整或整个系统通过。数据来自结果接口 {catalog.interface_revision}。</li>
            </ul>
          </details>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {report && item && (
        <>
          <section className="summary">
            <h2>{report.id} · {report.name_cn}</h2>
            <p className="tags">
              <span>{report.role_cn}</span>
              {report.limitations.inherits_d01 && <span>继承 D01 限制</span>}
              {report.id === "C03" && <span>单成分（F26，100%）</span>}
              {report.id === "C12" && <span>按有效类别动态等权</span>}
              {report.id === "C13" && <span>对 C10 的回归残差</span>}
            </p>
            <p>{report.purpose}</p>
            <p className="source">
              状态：{STATUS_CN[report.status.acceptance_status] ?? report.status.acceptance_status}。有效区间：{ymd(report.effective_period.start)} 至 {ymd(report.effective_period.end)}
              {report.effective_period.factor_unavailable_months > 0 &&
                `（此前 ${report.effective_period.factor_unavailable_months} 个信号月不可用，未补现金或零收益）`}
              ；月度调仓，日度估值。结果来源：冻结 run {report.provenance.run.split("/").pop()}，网页不重新计算。
            </p>
          </section>

          <nav className="tabs" aria-label="组合分析视图">
            <button className={tab === "method" ? "active" : ""} onClick={() => setTab("method")}>构成与方法</button>
            <button className={tab === "performance" ? "active" : ""} onClick={() => setTab("performance")}>表现与风险</button>
            <button className={tab === "coverage" ? "active" : ""} onClick={() => setTab("coverage")}>覆盖与样本</button>
            <button className={tab === "status" ? "active" : ""} onClick={() => setTab("status")}>状态与限制</button>
          </nav>

          {tab === "method" && <MethodTab report={report} />}
          {tab === "performance" && <PerformanceTab report={report} />}
          {tab === "coverage" && <CoverageTab report={report} />}
          {tab === "status" && <StatusTab report={report} />}
        </>
      )}

      {!report && !error && <p className="loading">加载中…</p>}
    </>
  );
}
