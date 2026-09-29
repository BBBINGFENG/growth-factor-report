# 成长因子量化研究网站

复现招商证券《成长投资全解析——基本面量化系列研究之六》的研究展示网站。架构规范见 [ARCHITECTURE.md](ARCHITECTURE.md)，结构调整先改规范再改代码。

## 网站模块

| 模块 | 状态 |
|---|---|
| 单因子回测 | 已实现，Factor 1–9 已发布 |
| 因子相互解释 | 待开发 |
| Long-only回测 | 待开发 |
| 组合因子回测 | 待开发 |
| 组合因子实盘表现 | 待开发 |
| Long-only实盘表现 | 待开发 |

单因子页面可按研究主题和方法筛选因子，每个因子有"定义与核心表现"和"稳定性与风险"两个标签页。

## 数据来源

网页数据全部来自冻结的正式回测结果：每个因子读取其 `ACCEPTANCE_RECORD.json` 登记、且仍保留在 `artifacts/factor_runs/` 下的那一个正式 run。网站不重新回测，不重新做预处理、分组或 Rank IC。

- 展示层汇总指标（滚动 IC、累计净值、年度表现、覆盖率、市值和行业暴露）只在 `scripts/stage4_single_factor/core/reporting.py` 中计算一次。
- 网页中的Economic hypothesis是基于因子定义与因子规格整理的项目摘要，不是论文原文逐字引用。
- 一个因子有多个论文股票池时，核心表现表列出全部股票池；稳定性与风险优先展示全市场，没有全市场 benchmark 时展示中证全指。
- 沪深300价格指数是所有因子共用的市场参考，由 `scripts/stage3_data/market_benchmark.py` 生成一份，网站只复制，不写进因子 JSON。

## 更新网站数据

在回测项目根目录运行统一发布程序：

```bash
python3 website/tools/publish.py factor --id 01
python3 website/tools/publish.py factor --ids 01 02 03
python3 website/tools/publish.py benchmark --id csi300
python3 website/tools/publish.py all
```

输出位置：

```text
public/data/single_factor/catalog.json
public/data/single_factor/factors/<id>_<name>.json
public/data/shared/benchmarks/csi300_monthly_open_to_open.json
```

内容没有变化时不会重写文件。新因子需要先在 `publish.py` 的 `FACTORS` 中登记英文名和分类；属于新因子家族时，还要在 `reporting.py` 中补充该家族的定义文字模板。只改页面样式或排版时，不重新发布数据。

## 本地运行与构建

使用 pnpm（版本见 `package.json` 的 `packageManager`）和 Node.js 24：

```bash
cd website
pnpm install
pnpm run dev
pnpm run build
pnpm run preview
```

构建输出在 `dist/`。

## GitHub Pages 部署

仓库 Settings → Pages 的 Source 设为 "GitHub Actions"。推送到 `main` 后，`.github/workflows/deploy.yml` 会用 `pnpm install --frozen-lockfile` 安装依赖、构建并发布。GitHub 只构建静态网页，不运行 Python，不需要 Token。`vite.config.ts` 使用相对路径，部署在仓库子路径下也能访问。

## JSON 结构

每个因子一个文件，顶层字段：

| 字段 | 内容 |
|---|---|
| `factor` | 编号、key、中英文名、因子家族 |
| `definition` | 经济含义、公式、输入字段、窗口、方向、缺失规则、会计口径 |
| `core_performance` | 各论文股票池指标、十档收益（含 G10−G1）、与原文对比 |
| `stability` | 月度 IC 与 12 个月滚动均值、多空累计净值（含区间起止日）、年度表现、覆盖率 |
| `risk_exposure` | 市值暴露、行业离散度、长期行业偏向（均含中性化前后） |
| `notes` | 验收记录登记的复现差异和已知限制 |
| `provenance` | 来源 run、manifest 哈希、Acceptance Record、展示股票池、读取的文件 |

缺失值统一写为 `null`；日期格式为 `YYYY-MM-DD`；相同输入重复发布得到完全相同的文件。
