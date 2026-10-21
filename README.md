# 成长因子量化研究网站

复现招商证券《成长投资全解析——基本面量化系列研究之六》的研究展示网站。架构规范见 [ARCHITECTURE.md](ARCHITECTURE.md)，结构调整先改规范再改代码。

## 网站模块

| 模块 | 状态 |
|---|---|
| 单因子回测 | 已实现，当前研究范围内43个已发布：Factor 1–26、29–33、35–39、41–47（Factor 27、28、34、40 已固定移出当前研究清单） |
| 因子相互解释 | 已实现（数据观察页）：上半部分单因子（41 个，按类别分块的跨类别矩阵 + 类内配对），下半部分组合（12 个，D01 可选作估值参考）；矩阵分 2021年前 / 2021年起，配对诊断为全时段曲线 |
| 组合因子回测 | 已实现：D01（外部依赖，受限研究基线）、10 个主要组合 C01–C04、C08–C13，以及 2 个中间组合 C06、C07；C05 不在范围 |
| 组合因子实盘表现 | 待开发 |

单因子 Long-only 回测与 Long-only 实盘两个入口已移除，不再开发。

组合页面读取当前结果接口（rev5）与冻结组合 run，由 `python3 website/tools/publish.py composite` 生成 `public/data/composite_backtest/`；十档默认显示相对全市场（剔除北交所）等权 E1 收益的月均超额收益，月频 E1 累计净值折叠在“日月口径对账”中；分“构成与方法”“表现与风险”“覆盖与样本”“状态与限制”四个标签，顶部固定披露删减版、实施假设、D01 限制、日频与月频口径、theoretical proxy、未计成本及沪深300仅作参考。一致性检查：`python3 -m scripts.stage6_composite_factors.verify_website`。

因子相互解释页面只展示相关性和名单重合，不筛选因子、不调整组合权重、不做收益归因或聚类结论。数据来自 Stage 7 观察诊断 run，由 `python3 website/tools/publish.py relationships --run artifacts/factor_relationships/<run_id>` 生成 `public/data/factor_relationships/`（`index.json`、每部分的 `matrix.json` 和按类别 / 组合拆分的配对文件，按需加载）；一致性检查：`python3 -m scripts.stage7_factor_relationships.verify_website <run_dir>`。公式文字只在 `scripts/stage7_factor_relationships/website_export.py` 维护，网页不计算。矩阵缺失格的实际绘制测试：在 `website/` 下运行 `node --test tests/matrix_render.test.mjs`（合成矩阵，仅用于测试）。

单因子页面可按研究主题和方法筛选因子，每个因子有“定义与核心表现”“稳定性与风险”和“计算公式与口径”三个标签页。

页面顶部的“复现范围说明”披露2026-10-16用户决定：Factor 27、28、34、40固定移出当前研究清单，Factor 26保留。范围元数据位于`src/modules/single_factor/researchScope.json`，与正式回测catalog分离。保留原文组合类别和层级，在每层剔除这些成分后对剩余组件重新等权，单组件类别仍保留且权重为100%；逐股票、逐月在每层对有限值组件等权，全部缺失则缺失，记录组件数与覆盖率，不补0、不伪造回测数据。路径F05–13、动能F17–25及未明示的预处理已登记；D01综合估值保留并优先实现，未验收前不当作已完成依赖。

“计算公式与口径”展示当前因子定义，以及 MAD、Z-score、Neutralization、Rank IC、ICIR、IC>0 占比、E1 收益、十档分组、算术年化、日度估值与日频风险、月频风险对照、覆盖率与市值/行业暴露等计算规则。公式使用 LaTeX，由 KaTeX 在页面中排版（字体与样式随项目构建打包）；公式按研究层当前实现核对，仅作说明，不在浏览器执行指标计算。

风险指标的主口径是“月度调仓、日度估值”：每月开盘调仓，月内持股数量不变、权重随价格漂移，每个交易日收盘估值；多头与空头名义金额各等于月初权益（100% 多、100% 空），未计交易成本与利息。日度净值、日频回撤、年化波动率与 Sharpe 都由每交易日一条日收益计算，年化交易日数 A = 252。原月频净值与年度表现保留为“月频对照”。核心表现、十档图与论文比较仍是月度 E1 口径（多空收益为算术年化）；Rank IC 仍为月频。PEG 的论文比较保留原始定义，图表、日度估值与年度表现使用方向统一后的信号。

## 数据来源

网页数据全部来自冻结的正式回测结果：每个因子读取其 `ACCEPTANCE_RECORD.json` 登记、且仍保留在 `artifacts/factor_runs/` 下的那一个正式 run。网站不重新回测，不重新做预处理、分组或 Rank IC。

- 展示层汇总指标（滚动 IC、累计净值、年度表现、覆盖率、市值和行业暴露）只在 `scripts/stage4_single_factor/core/reporting.py` 中计算一次。
- 网页中的Economic hypothesis是基于因子定义与因子规格整理的项目摘要，不是论文原文逐字引用。
- 一个因子有多个论文股票池时，核心表现表列出全部股票池；稳定性与风险优先展示全市场，没有全市场 benchmark 时展示中证全指。
- 沪深300价格指数是所有因子共用的市场参考，由 `scripts/stage3_data/market_benchmark.py`（月初开盘）与 `market_benchmark_daily.py`（每日开盘、收盘）各生成一份，网站只复制，不写进因子 JSON。
- 日度净值与日频风险来自独立的日度估值产物 `artifacts/daily_valuation/<run_id>/`（`scripts/stage4_single_factor/daily_valuation/`），它只读取冻结的正式 run 与共享日度价格缓存，不改写正式 run。

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

组合与因子相互解释的数据分别由 `publish.py composite`、`publish.py relationships --run artifacts/factor_relationships/<run_id>` 生成；这两个命令写完数据后会立即运行对应的发布校验，校验失败时以非零状态退出。

## 发布门禁

上线前（推送到 `main` 之前）在回测项目根目录运行统一入口，它是自动发布成功与否的唯一判据：

```bash
python3 website/tools/publish.py check --run artifacts/factor_relationships/<当前观察 run>
```

等价于 `python3 website/tools/release_check.py --relationships-run <run>`。它先核对观察 run 的输出文件与其 manifest 的 sha256，再调用 `scripts.stage7_factor_relationships.verify_website.verify` 与 `scripts.stage6_composite_factors.verify_website.verify`；只有每项都返回 `all_pass: true` 才以 0 退出，`all_pass` 为 false 或缺失、数据缺失、代码或哈希不符、抛出异常都会以 1 退出。两个 `verify_website` 模块自身的命令行只打印 JSON、总是正常退出，只用于查看明细，不能作为发布判据。门禁代码由网站仓库版本控制追踪，不属于任何研究 run 记录的代码。随后运行 `pnpm run build`（含 TypeScript 检查），两者都通过后再推送。

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
