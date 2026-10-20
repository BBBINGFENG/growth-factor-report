import { Fragment } from "react";
import { STATUS_CN, type CompositeReport } from "./data";

const COMPONENT_CN: Record<string, string> = {
  numerics_and_method_verification: "实现者分公式复核",
  user_confirmation_of_implementation_choices: "实施选择确认",
  external_independent_review: "外部独立审查",
  post_fix_regression_tests: "修复后回归测试",
  data_limitations: "数据限制",
  exact_paper_replication: "完全一致的原文复现",
  run_status: "冻结 run 状态",
  usage: "用途",
  implementer_calculation_verification: "原实现者计算核验",
  independent_review: "独立审查（Codex，限定范围）",
  not_claimed: "不代表"
};

function show(v: unknown): string {
  if (v === true) return "是";
  if (v === false) return "否";
  if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}：${show(x)}`).join("；");
  return String(v);
}

export default function StatusTab({ report: r }: { report: CompositeReport }) {
  return (
    <div className="tab-body">
      <section className="card">
        <h2>本项的限制</h2>
        <ul className="scope-impacts">
          {r.limitations.specific.map((x) => <li key={x}>{x}</li>)}
        </ul>
        <details>
          <summary>验收记录中登记的数据与方法限制</summary>
          <ul className="scope-impacts">
            {r.limitations.recorded.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </details>
      </section>

      <section className="card">
        <h2>状态</h2>
        <p>{STATUS_CN[r.status.acceptance_status] ?? r.status.acceptance_status}</p>
        <dl className="spec">
          {Object.entries(r.status.components).map(([k, v]) => (
            <Fragment key={k}><dt>{COMPONENT_CN[k] ?? k}</dt><dd>{show(v)}</dd></Fragment>
          ))}
          {r.status.external_review && (<><dt>外部审查</dt><dd>{r.status.external_review.reviewer}</dd></>)}
        </dl>
        <p className="caption">记录：{r.status.record}{r.status.review_record ? `；独立审查：${r.status.review_record}` : ""}{r.status.verification_record ? `；实现者核验（非独立审查）：${r.status.verification_record}` : ""}</p>
      </section>

      <section className="card">
        <h2>来源</h2>
        <dl className="spec">
          <dt>冻结 run</dt><dd>{r.provenance.run}</dd>
          <dt>结果接口</dt><dd>{r.provenance.interface}（{r.provenance.interface_revision}）</dd>
          <dt>日月对账</dt>
          <dd>无结转可比月 {String(r.checks.comparable_months)} 个，最大差 {String(r.checks.max_abs_difference_comparable_months)}；退出时结转持仓 {String(r.checks.exit_carried_positions)} 个（停牌 {String(r.checks.exit_suspended_positions)}，退市 {String(r.checks.exit_delisted_positions)}，未知 {String(r.checks.exit_unknown_positions)}）</dd>
        </dl>
      </section>
    </div>
  );
}
