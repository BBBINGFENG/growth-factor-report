import { useState } from "react";
import SingleFactorPage from "./modules/single_factor/SingleFactorPage";

const MODULES = [
  { id: "single_factor", name: "单因子回测", description: "单因子的定义、IC、分组收益、稳定性和风险。", ready: true },
  { id: "factor_relationships", name: "因子相互解释", description: "因子相关性、增量解释力、聚类和冗余分析。", ready: false },
  { id: "long_only_backtest", name: "Long-only回测", description: "单因子多头组合的基准超额、换手、成本和回撤。", ready: false },
  { id: "composite_backtest", name: "组合因子回测", description: "多因子合成、权重、组合表现和归因。", ready: false },
  { id: "live_composite", name: "组合因子实盘表现", description: "组合因子的最新信号和样本外表现。", ready: false },
  { id: "live_long_only", name: "Long-only实盘表现", description: "实际多头组合的持仓、净值、交易和归因。", ready: false },
];

export default function App() {
  const [active, setActive] = useState(MODULES[0].id);
  const module = MODULES.find((m) => m.id === active)!;

  return (
    <div className="page">
      <header className="header">
        <div className="title">
          <h1>成长因子量化研究</h1>
          <p className="subtitle">复现：招商证券《成长投资全解析——基本面量化系列研究之六》</p>
        </div>
      </header>

      <nav className="modules" aria-label="网站模块">
        {MODULES.map((m) => (
          <button key={m.id} className={m.id === active ? "active" : ""} onClick={() => setActive(m.id)}>
            {m.name}
            {!m.ready && <span className="pending">待开发</span>}
          </button>
        ))}
      </nav>

      {module.ready ? (
        <SingleFactorPage />
      ) : (
        <section className="card placeholder">
          <h2>{module.name}</h2>
          <p>{module.description}</p>
          <p className="pending-text">待开发</p>
        </section>
      )}
    </div>
  );
}
