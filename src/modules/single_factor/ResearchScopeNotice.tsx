import scope from "./researchScope.json";

export default function ResearchScopeNotice() {
  return (
    <section className="card research-scope" aria-labelledby="research-scope-title">
      <h2 id="research-scope-title">复现范围说明</h2>
      <p>当前研究清单固定排除以下 {scope.excluded_factors.length} 个因子，不参与单因子或组合回测，也不等待数据恢复后自动补入。这是研究范围决定，不代表因子无效。</p>
      <ul className="scope-factors">
        {scope.excluded_factors.map((factor) => (
          <li key={factor.id}>F{factor.id} · {factor.name_cn}<span className="scope-status">已移出研究范围</span></li>
        ))}
      </ul>
      {scope.retained_factors.map((factor) => (
        <p className="caption" key={factor.id}>F{factor.id}：{factor.note}</p>
      ))}
      <p>{scope.composition_policy.summary}</p>
      <details>
        <summary>对原文组合复现的影响</summary>
        <ul className="scope-impacts">
          {scope.affected_composites.map((composite) => (
            <li key={composite.ids.join("/")}>
              <strong>{composite.name_cn}</strong>：{composite.impact}
            </li>
          ))}
        </ul>
        <p className="caption">{scope.composition_policy.note}</p>
      </details>
      <p className="caption">范围决定：{scope.decision_date}；现有已验收因子的结果不变。</p>
    </section>
  );
}
