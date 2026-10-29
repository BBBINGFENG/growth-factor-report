import { useEffect, useState } from "react";
import SingleFactorPage from "./modules/single_factor/SingleFactorPage";
import CompositePage from "./modules/composite_backtest/CompositePage";
import RelationshipsPage from "./modules/factor_relationships/RelationshipsPage";
import LiveCompositePage from "./modules/live_composite/LiveCompositePage";

const MODULES = [
  { id: "single_factor", name: "单因子回测", description: "单因子的定义、IC、分组收益、稳定性和风险。", ready: true },
  { id: "factor_relationships", name: "因子相互解释", description: "因子信号、收益、IC 与选股名单的相关性观察。", ready: true },
  { id: "composite_backtest", name: "组合因子回测", description: "D01 与原文框架下的删减版组合（C01–C13）。", ready: true },
  { id: "live_composite", name: "组合策略模拟表现", description: "12 个组合自 2026-01-01 起的历史模拟账户（非真实成交）。", ready: true },
];

// Each ready module routes to its own page; there is no fallback to another module's page.
const PAGES: Record<string, JSX.Element> = {
  single_factor: <SingleFactorPage />,
  factor_relationships: <RelationshipsPage />,
  composite_backtest: <CompositePage />,
  live_composite: <LiveCompositePage />,
};

// The module is kept in the URL hash; an unknown or retired id (e.g. the removed Long-only entries) opens the first module.
function fromHash(): string {
  const id = window.location.hash.replace(/^#\/?/, "");
  return MODULES.some((m) => m.id === id) ? id : MODULES[0].id;
}

export default function App() {
  const [active, setActive] = useState(fromHash);
  const module = MODULES.find((m) => m.id === active) ?? MODULES[0];
  useEffect(() => {
    const onHash = () => setActive(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (window.location.hash && window.location.hash !== `#${module.id}`) window.history.replaceState(null, "", `#${module.id}`);
  }, [module.id]);
  const open = (id: string) => {
    window.history.replaceState(null, "", `#${id}`);
    setActive(id);
  };

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
          <button key={m.id} className={m.id === module.id ? "active" : ""} onClick={() => open(m.id)}>
            {m.name}
            {!m.ready && <span className="pending">待开发</span>}
          </button>
        ))}
      </nav>

      {module.ready && PAGES[module.id] ? (
        PAGES[module.id]
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
