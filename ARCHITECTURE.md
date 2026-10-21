# 量化研究网站架构与数据发布规范

**状态**：当前有效规范  
**更新日期**：2026-10-18
**适用范围**：回测项目的网站数据发布、前端文件结构和后续模块扩展。

本文档是网站架构的唯一规范。后续开发应先读本文档，不得依赖对话记忆自行改变结构。如需改变架构，应先修订本文档，再修改代码。

## 1. 基本原则

1. `scripts/`负责研究计算，`artifacts/`保存冻结的正式结果，`因子规格/`解释因子定义，`website/`只负责数据发布和展示。
2. 网站不是第二套回测系统。浏览器和前端不得计算因子、去极值、中性化、Rank IC、ICIR、分组收益或基准收益。
3. 每个因子只使用一份已确认的正式回测结果。网站不接收candidate run，不为网站再跑一次accepted run。
4. 冻结后的因子只发布一次。网站构建时只读静态JSON，不重新打开数GB的panel，不重新计算，不重复审查已冻结的步骤。
5. 公共数据只计算一次。例如沪深300只保存一份共享序列，不复制进每个因子JSON。
6. 网站不保存审批报告、candidate对比、重复哈希清单和过程性诊断。最少的来源信息直接嵌入因子JSON。
7. 不为每个因子编写网站专属脚本或页面。全部单因子共用一套发布程序、数据格式和前端组件。

## 2. 网站的四个业务模块

| 模块 | 目录名 | 内容 |
|---|---|---|
| 单因子回测 | `single_factor` | 可独立解释和独立回测的信号定义、IC、分组收益、稳定性和风险 |
| 因子相互解释 | `factor_relationships` | 单因子之间、组合之间的信号与收益相关、IC 共同变化和名单重合（数据观察，不做筛选或聚类结论） |
| 组合因子回测 | `composite_backtest` | 多因子合成、权重、组合表现和归因 |
| 组合因子实盘表现 | `live_composite` | 组合因子的最新信号和样本外表现 |

当前实现`single_factor`、`composite_backtest`（D01 与 C01–C13，2026-10-18 接入）与`factor_relationships`（数据观察页，2026-10-19 接入，2026-10-21 改为两部分）。`live_composite`在没有真实内容前只在导航中显示“待开发”，不创建空数据目录、占位JSON或虚构图表。单因子 Long-only 回测与 Long-only 实盘两个入口已于 2026-10-21 移除（不再开发）；旧地址`#long_only_backtest`、`#live_long_only`回到第一个模块。

## 3. 目标文件结构

```text
website/
├── ARCHITECTURE.md
├── src/
│   ├── App.tsx
│   ├── modules/
│   │   ├── factor_relationships/
│   │   │   ├── RelationshipsPage.tsx
│   │   │   ├── MatrixChart.tsx
│   │   │   ├── matrixOption.ts
│   │   │   ├── FormulaPanel.tsx
│   │   │   └── data.ts
│   │   ├── composite_backtest/
│   │   │   ├── CompositePage.tsx
│   │   │   ├── MethodTab.tsx
│   │   │   ├── PerformanceTab.tsx
│   │   │   ├── CoverageTab.tsx
│   │   │   ├── StatusTab.tsx
│   │   │   └── data.ts
│   │   └── single_factor/
│   │       ├── SingleFactorPage.tsx
│   │       ├── ResearchScopeNotice.tsx
│   │       ├── researchScope.json
│   │       ├── DefinitionPerformance.tsx
│   │       ├── StabilityRisk.tsx
│   │       ├── DailyRisk.tsx
│   │       ├── CalculationMethods.tsx
│   │       ├── FactorFormula.tsx
│   │       ├── methodologyDefinitions.ts
│   │       └── data.ts
│   └── shared/
│       ├── FactorChart.tsx
│       ├── MathFormula.tsx
│       ├── format.ts
│       └── types.ts
├── public/data/
│   ├── shared/benchmarks/
│   │   ├── csi300_monthly_open_to_open.json
│   │   └── csi300_daily_open_close.json
│   ├── factor_relationships/
│   │   ├── index.json
│   │   ├── single_factors/{matrix.json,pairs_<category>.json}
│   │   └── composites/{matrix.json,pairs.json}
│   ├── composite_backtest/
│   │   ├── catalog.json
│   │   └── items/<D01|Cxx>.json
│   └── single_factor/
│       ├── catalog.json
│       └── factors/
│           └── <factor_id>_<factor_key>.json
├── tools/
│   └── publish.py
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
└── README.md
```

`node_modules/`是本地依赖，`dist/`是构建输出，两者都不是研究产物，不需要人工阅读或作为数据源。

## 4. 单因子分类方法

因子文件不按“传统成长/成长路径/文献因子”拆成多层目录。一个因子可能同时具有多个属性，因此所有因子JSON平铺保存，分类由`public/data/single_factor/catalog.json`统一管理。

每个因子至少包含以下分类字段：

- `research_theme`：`traditional_growth`、`growth_path`、`growth_momentum`、`forward_growth`、`earnings_surprise`、`growth_valuation`、`multidimensional_growth`、`low_base`。
- `method_family`：例如`growth_rate`、`displacement_path_ratio`、`upward_count_ratio`、`time_series_quantile`、`time_series_regression_coefficient`、`cross_sectional_growth_forecast`、`analyst_revision`、`standardized_unexpected_growth`、`jump_of_report_date`、`report_expectation_surprise`、`analyst_earnings_surprise`、`peg`、`profit_growth`、`cashflow_growth`、`cashflow_to_revenue_change`、`operating_efficiency_change`、`profitability_improvement`。
- `source_type`：`paper_core`、`cross_report`、`external_literature`、`project_extension`。
- `accounting_basis`：`single_quarter`、`TTM`、`balance_sheet_stock`、`event_based`、`not_applicable`。
- `published`：只表示是否已有可在网站展示的冻结结果，不是审批状态。

原文证据表的51个“细分因子名称”不再直接等同于本项目的 standalone factor 数量。其中`PB-NISD`、`成长性价比`和`成长动能性价比`都是对已能独立解释的信号排名再进行加减融合，故移入`Composite Cxx`命名空间。剩余48个 standalone definitions；同一定义的单季度/TTM若需要独立展示，可各占一个实现页，因此网站页数不必等于48。81条benchmark observation仍是因子JSON内部的不同股票池或口径记录，不建立81个页面或文件。

### 4.1 Standalone 与 Composite 的判定

- 使用多个原始会计字段不等于 composite。比率、同比、SUE、PEG和周转率仍可以是一个经济含义明确的 standalone signal。
- 将多个本来就可以独立排序和独立回测的 signals，再通过等权、加权、排名加减或残差化融合，才归入 composite。
- `回归预测净利润增速`保留为 standalone 中的`model_derived_signal`：它是对单一明确目标变量的预测，不是对多个选股因子分数做等权融合。

### 4.2 Composite 独立编号

Composite 不占用 Factor 01、02…的连续单因子编号，改用`Composite Cxx`。当前整理如下：

| Composite | 名称 | 归类依据 |
|---:|---|---|
| C01 | 成长路径综合因子 | 融合成长路径细分信号 |
| C02 | 成长动能综合因子 | Rank加速度、时序分位点、时序回归系数融合 |
| C03 | 未来成长因子 | 回归预测与分析师预期两层融合 |
| C04 | 超预期综合因子 | 五个超预期信号融合 |
| C05 | PB-NISD | 业绩加速度排名减PB排名；本文无数值benchmark |
| C06 | 成长性价比 | 净利润增速排名与综合估值排名融合 |
| C07 | 成长动能性价比 | 净利润加速度排名与综合估值排名融合 |
| C08 | 综合成长性价比因子 | C06与C07等权融合 |
| C09 | 多维度综合成长因子 | 多维成长能力融合 |
| C10 | 综合传统成长因子 | 营收与利润增长的两层等权融合 |
| C11 | 剔除低基数后综合传统成长因子 | C10叠加低基数universe filter |
| C12 | 综合成长补充因子 | 六个综合模块等权融合 |
| C13 | 剔除传统成长后残差因子 | 对C12使用C10做横截面回归取残差 |

系列一的`综合估值因子`是C06–C08的外部 composite dependency，记为`Composite Dependency D01`，不占用系列六的Cxx编号。C01–C13 与 D01 在`composite_backtest`模块展示（见 §7.1），不加入单因子网站catalog；C05 不在当前范围。

### 4.3 当前复现范围（2026-10-16 用户确认）

- Factor 27、28、34、40从当前有效研究清单与组合成分中固定移除，不再等待数据或接口恢复后自动补跑；已有规格和代码仅作历史记录保留，不删除共享数据或历史结果。
- `single_factor/researchScope.json`记录这一范围决定，`ResearchScopeNotice`在单因子页顶部持续展示四个因子的编号、名称，以及对C03、C04、C09、C12/C13的影响。范围元数据与冻结回测结果分开，不添加虚构的catalog条目或绩效，也不重排其他Factor编号。
- 用户确认采用删减版：保留原文组合类别与合成层级，在每层固定剔除上述成分后，对剩余组件重新等权；只剩一个组件时权重为100%，类别仍保留。C03因此保留为仅F26的单组件删减版；C04保留F29/F30/F32/F33；C09保留现金流、效率、盈利能力三个维度，其中现金流仅F39/F41。
- 结构性成分删除不等于逐股票、逐月的缺失值处理。用户进一步确认：每个原有层级对有限值组件等权，全部缺失则本层缺失，记录组件数与覆盖率，不补0或伪造信号。路径采用F05–13，动能采用F17–25并保留F25；原文未明确的输入预处理采用MAD去极值、z-score、仅市值中性化、行业百分位，标记为implementation choice。D01综合估值保留并优先实现，仍须单独验收，不擅自改用PEG替代。研究规格见`因子规格/组合复现_执行口径.md`。
- 后续结果标注为删减版，不冒称完整原文复现。本轮只更新范围与合成政策，不产生组合回测结果。

## 5. Standalone Factor 编号与分类

| Factor | 因子 | `research_theme` | `method_family` | `accounting_basis` |
|---:|---|---|---|---|
| 01 | 营业收入同比·单季度 | `traditional_growth` | `growth_rate` | `single_quarter` |
| 02 | 营业收入同比·TTM | `traditional_growth` | `growth_rate` | `TTM` |
| 03 | 归母净利润同比·单季度 | `traditional_growth` | `growth_rate` | `single_quarter` |
| 04 | 归母净利润同比·TTM | `traditional_growth` | `growth_rate` | `TTM` |
| 05 | 净利润位移路程比 | `growth_path` | `displacement_path_ratio` | `single_quarter` |
| 06 | 营业收入位移路程比 | `growth_path` | `displacement_path_ratio` | 以冻结主口径为准 |
| 07 | 总资产位移路程比 | `growth_path` | `displacement_path_ratio` | `balance_sheet_stock` |
| 08 | 净利润上涨次数占比 | `growth_path` | `upward_count_ratio` | `TTM` |
| 09 | 营业收入上涨次数占比 | `growth_path` | `upward_count_ratio` | `TTM` |
| 10 | 总资产上涨次数占比 | `growth_path` | `upward_count_ratio` | `balance_sheet_stock` |
| 11 | 净利润路径拟合程度 | `growth_path` | `path_fit` | `single_quarter` |
| 12 | 营业收入路径拟合程度 | `growth_path` | `path_fit` | `single_quarter` |
| 13 | 总资产路径拟合程度 | `growth_path` | `path_fit` | `balance_sheet_stock` |
| 14 | 净利润成长加速度 | `growth_momentum` | `growth_acceleration` | `TTM` |
| 15 | 营业收入成长加速度 | `growth_momentum` | `growth_acceleration` | `TTM` |
| 16 | 总资产成长加速度 | `growth_momentum` | `growth_acceleration` | `balance_sheet_stock` |
| 17 | 净利润Rank成长加速度 | `growth_momentum` | `rank_growth_acceleration` | `TTM` |
| 18 | 营业收入Rank成长加速度 | `growth_momentum` | `rank_growth_acceleration` | `TTM` |
| 19 | 总资产Rank成长加速度 | `growth_momentum` | `rank_growth_acceleration` | `balance_sheet_stock` |
| 20 | 净利润同比增速时序分位点 | `growth_momentum` | `time_series_quantile` | `single_quarter` |
| 21 | 营业收入同比增速时序分位点 | `growth_momentum` | `time_series_quantile` | `single_quarter` |
| 22 | 总资产同比增速时序分位点 | `growth_momentum` | `time_series_quantile` | `balance_sheet_stock` |
| 23 | 净利润同比增速时序回归系数 | `growth_momentum` | `time_series_regression_coefficient` | `single_quarter` |
| 24 | 营业收入同比增速时序回归系数 | `growth_momentum` | `time_series_regression_coefficient` | `single_quarter` |
| 25 | 总资产同比增速时序回归系数 | `growth_momentum` | `time_series_regression_coefficient` | `balance_sheet_stock` |
| 26 | 回归预测净利润增速 | `forward_growth` | `cross_sectional_growth_forecast` | `TTM` |
| 27 | 分析师预期净利润上调 | `forward_growth` | `analyst_revision` | `not_applicable` |
| 28 | 分析师预期ROE上调 | `forward_growth` | `analyst_revision` | `not_applicable` |
| 29 | SUE标准化预期外盈利 | `earnings_surprise` | `standardized_unexpected_growth` | `single_quarter` |
| 30 | SUR标准化预期外收入 | `earnings_surprise` | `standardized_unexpected_growth` | `single_quarter` |
| 31 | JOR(MAX) | `earnings_surprise` | `jump_of_report_date` | `event_based` |
| 32 | JOR(LAST) | `earnings_surprise` | `jump_of_report_date` | `event_based` |
| 33 | 正式财报超预告快报预期 | `earnings_surprise` | `report_expectation_surprise` | `event_based` |
| 34 | 单季度业绩超分析师预期 | `earnings_surprise` | `analyst_earnings_surprise` | `single_quarter` |
| 35 | PEG·TTM | `growth_valuation` | `peg` | `TTM` |
| 36 | PEG·单季度 | `growth_valuation` | `peg` | `single_quarter` |
| 37 | 毛利润同比增速·单季度 | `multidimensional_growth` | `profit_growth` | `single_quarter` |
| 38 | 营业利润同比增速·单季度 | `multidimensional_growth` | `profit_growth` | `single_quarter` |
| 39 | CFO同比增速·TTM | `multidimensional_growth` | `cashflow_growth` | `TTM` |
| 40 | 自由现金流同比增速·TTM | `multidimensional_growth` | `cashflow_growth` | `TTM` |
| 41 | CFO/营业收入同比变化·TTM | `multidimensional_growth` | `cashflow_to_revenue_change` | `TTM` |
| 42 | 总资产周转率同比变化·单季度 | `multidimensional_growth` | `operating_efficiency_change` | `single_quarter` |
| 43 | 固定资产周转率同比变化·单季度 | `multidimensional_growth` | `operating_efficiency_change` | `single_quarter` |
| 44 | 存货周转率同比变化·单季度 | `multidimensional_growth` | `operating_efficiency_change` | `single_quarter` |
| 45 | 毛利率同比增速·单季度 | `multidimensional_growth` | `profitability_improvement` | `single_quarter` |
| 46 | 净利率同比增速·单季度 | `multidimensional_growth` | `profitability_improvement` | `single_quarter` |
| 47 | Delta ROE·单季度 | `multidimensional_growth` | `profitability_improvement` | `single_quarter` |

C01不插入Factor 13和Factor 14之间。后续单因子继续使用Factor 20、21…连续编号。

## 6. 回测代码与网站代码的边界

单因子回测代码统一保存在：

```text
scripts/stage4_single_factor/
├── core/
├── families/
│   └── <shared_family>.py
└── factor_<nn>_<factor_key>/
    ├── __init__.py
    ├── definition.py
    └── pipeline.py
```

这些代码不移入`website/`。相同数学定义只在`families/`实现一次；各factor目录只保留自身的字段、口径、benchmark和很薄的调用层。

网站不为单个Factor增加专属发布脚本，只通过一个通用发布程序生成：

```text
public/data/single_factor/factors/
└── <factor_id>_<factor_key>.json
```

## 7. 网站数据来源

| 展示内容 | 唯一数据源 |
|---|---|
| Economic hypothesis | `因子规格/<factor>.md`和因子定义 |
| 公式与窗口 | Factor `definition.py`和因子规格 |
| Rank IC、ICIR、多空收益 | 冻结的正式factor run |
| 十档超额收益 | `decile_returns`减同股票池等权收益（`data/processed/benchmarks/pool_equal_weight/`） |
| 论文benchmark | `benchmark_comparison`的primary分支 |
| Monthly IC | `monthly_ic` |
| 多空日度净值、日频回撤与日频风险指标（主展示） | 日度估值产物`artifacts/daily_valuation/<run_id>/`（月度调仓、日度收盘估值） |
| 日月对账 | 同一日度估值产物的`monthly_reconciliation`与按E1端点的年度汇总 |
| 月频多空净值与月频年度表现（对照） | 冻结的月度多空收益与月度Rank IC |
| 六市场回测有效覆盖率 | `factor_panel_raw`、共享市值/行业输入、E1收益与历史PIT成分 |
| 市值/行业暴露 | 冻结processed factor panel |
| 沪深300市场参考 | 月频：`csi300_monthly_open_to_open.json`；日频：`csi300_daily_open_close.json`（均在`public/data/shared/benchmarks/`） |
| 因子公式的数学排版 | `reporting.py`生成的`definition.formula_tex`与`formula_symbols`（LaTeX，由KaTeX渲染） |

因子JSON为`schema_version = 3`（在v2基础上，`analysis_by_pool.<pool>.daily_valuation`给出日度净值、日频回撤、日频年度表现与日月对账；`definition`增加LaTeX公式）：`definition`与`paper_comparison`为因子级；`analysis_by_pool`只含`benchmark_comparison.csv`中`result_role == "primary"`的市场，按市场给出十档超额、Monthly IC、多空净值、年度表现和暴露；`coverage_by_pool`固定包含六个股票池；`display_context`给出页面口径和每张图表的一句说明。

三个概念分开命名：`paper_benchmark`（论文Rank IC/ICIR/多空，只用于复现比较）、`decile_excess_return_benchmark`（同股票池等权组合，十档超额的基准）、`market_reference`（沪深300，只作市场环境参考）。

`scripts/stage4_single_factor/core/reporting.py`是单因子网站汇总指标的唯一计算位置。发布脚本只调用它并写出JSON；前端只显示JSON。

### 7.1 组合模块（composite_backtest）

| 展示内容 | 唯一数据源 |
|---|---|
| 指标（月频 IC、月频多空、日频风险、年度表）、十档、覆盖率（`coverage_by_period`）、日月对账 | 当前结果接口`汇报结果汇总/当前结果/组合接口.json`（rev5，指向`组合复现审查/20261017T045530Z/composites_interface_rev5.json`） |
| 月度 Rank IC、月度多空收益、逐月覆盖与 C12 类别数、日度净值 | 冻结 run（`artifacts/composite_runs/<run_id>/`、`artifacts/d01_runs/<run_id>/`）的`monthly_ic`、`decile_returns`、`coverage`、`valuation_points` |
| 状态、实施选择、限制、原文对照 | `artifacts/composite_acceptance/<Cxx>/ACCEPTANCE_RECORD.json`；D01 为`RESEARCH_BASELINE_USAGE.json`与`CALCULATION_VERIFICATION_20261018.json` |

研究层唯一转换位置：`scripts/stage6_composite_factors/website_export.py`（由`publish.py composite`调用）。它只重排已冻结的数值；派生的仅有月频多空累计乘积、日频回撤（`core.risk_metrics.drawdown`）、按期间的算术年化（与 Excel 同一函数`report._ls_arith`）和十档月均超额收益（与单因子页同一函数`core.reporting.decile_excess`：逐月减去冻结的全市场剔除北交所等权 E1 基准，再对共同有效月平均；基准的信号月与 E1 区间终点先与共享 E1 文件核对）。一致性由`scripts/stage6_composite_factors/verify_website.py`核对（网站 JSON、接口、Excel、冻结 run 四方）。

页面分四个标签：构成与方法、表现与风险（主图为月度调仓、日度估值的净值与回撤；十档默认显示月均超额收益，原始十档折叠对照；月频 E1 累计净值折叠在“日月口径对账”中，并说明差异来自缺价股票的处理：日度模型按最近有效价格结转与 theoretical exit proxy，E1 把无下一开盘价的股票从当月剔除）、覆盖与样本、状态与限制；顶部固定展示组合结果的性质与限制。C06、C07 标为中间组合（C08 的输入），D01 标为外部依赖与受限研究基线。不显示“完全复现”“可交易”“严格 PIT”等表述。

### 7.2 因子相互解释模块（factor_relationships）

数据观察页，不筛选因子、不调整权重、不做收益归因或聚类结论。研究层唯一来源是 Stage 7 观察诊断 run（`artifacts/factor_relationships/<run_id>/`，入口`scripts.stage7_factor_relationships.observe_run`），它复用并核对冻结的 Stage 7 基线 run，读取冻结的单因子、组合、D01 结果与冻结的全市场等权 E1 基准。网站导出与核对：`scripts/stage7_factor_relationships/website_export.py`、`verify_website.py`，由`publish.py relationships`调用。

- 页面上下两部分，各自独立：第一部分单因子（41 个有全市场主分支的因子，按研究类别分块；F02、F04 只有指数池结果，不进入全市场矩阵）；第二部分组合（12 个组合 / 中间项，D01 作为可选的估值参考，不算第 13 个成长组合，并标注受限状态和依赖它的组合）。
- 每部分先给①信号相关 Matrix（Pearson/Spearman/Kendall tau-b，默认 Spearman；逐月横截面相关的期间等权平均）与②月频 E1 多空收益 Matrix（分期内月度多空收益时间序列的 Pearson，不是 rolling 的平均），均分“2021年前”“2021年起”两期。单因子矩阵保持可读的格子尺寸，在框内滚动，粗线标出类别分界，可按行、列类别查看局部；缺失格的悬停给出有效样本与缺失原因。
- 然后是配对选择（单因子：类别 → Factor A、Factor B，类内不足两个因子时说明，不生成假配对；组合：Composite A、Composite B），依次显示③分组超额收益相关、④IC 共同变化、⑤选股名单重合，每项只有一张全时段曲线，竖线标注 2021 分界。
- ③④的 rolling 在完整、连续的月度时间轴上计算（24/36 个月，默认 36）：窗口为以该信号月结尾的连续 W 个日历月，2021 年不重新起算；至少 24 个共同有效月且两边有变化，否则缺失。样本开头不足 W 个月为 warm-up，保持缺失；较晚才有数据的对象不提前填充。曲线不跨缺失连线，并显示首个有效结果、窗口起止和共同有效月数。
- ③的分组超额收益 = 冻结分组收益 − 同一信号月、同一 E1 区间的全市场（剔除北交所）等权收益（`data/processed/benchmarks/pool_equal_weight/`，按信号月与区间终点核对，所有远期收益文件与共享 E1 文件逐行一致）。对 C11、D01 等样本较窄的对象，这是共同参考而不是其自身股票池的基准；减去参考不等于消除全部市场暴露。原始分组收益相关只作为折叠的全样本数值对照。
- ⑤为逐月 Jaccard（不做滚动）。对象当月参与分组即名单已知（可为空），否则未知；已知时记录真实的双方数量、交集与并集（并集 = 双方数量之和 − 交集），依赖未知名单的计数为`null`；任一侧无名单时为不可比较。
- 每个分析区一份公式（研究层`index.json`，前端只显示），①随所选方法切换；符号说明与详细口径折叠。Matrix 缺失格（`null`）由独立图层画成灰色“—”，不进入 −1..1 色阶，真实 0 显示为 0.00；渲染由`website/tests/matrix_render.test.mjs`（合成矩阵，ECharts SVG 实际绘制）核对，合成数据不进入`public/data`。
- 静态数据：`index.json`、每部分一个`matrix.json`，配对数据按单因子类别（`pairs_<category>.json`）或组合（`pairs.json`）拆分，按需加载；不发布股票级 panel 或逐对、逐月文件。

## 8. 公共基准

沪深300价格指数是所有单因子共用的市场环境参考，不是市场中性多空组合的同风险业绩基准。

- 研究层唯一输出：`data/processed/benchmarks/csi300_monthly_open_to_open.json`（月初开盘到下月月初开盘）与`csi300_daily_open_close.json`（每日开盘、收盘点位）。
- 网站部署副本：`website/public/data/shared/benchmarks/`下的同名文件。
- 网站副本必须与研究层文件字节一致。
- 基准不复制进因子JSON，一个页面会话只请求一次。
- 月频对照中，因子与基准均按月初开盘到下月月初开盘对齐；日度净值中，基准使用与因子相同的估值点（起止为开盘、其余为收盘），共同起点归一为1。
- 网站必须标注“沪深300价格指数（市场参考）”，不得写成总收益指数。
- 沪深300不是十档收益benchmark。十档超额收益的基准是同股票池等权组合：每月该股票池PIT合格成员中E1收益有效股票的等权平均，与因子样本无关，只构建一份（`data/processed/benchmarks/pool_equal_weight/<run_id>/`），不复制进因子JSON。

## 9. 统一发布程序

目标状态只保留：

```text
website/tools/publish.py
```

它提供：

```text
publish.py factor --id 01
publish.py factor --ids 01 02 03 04 05 06
publish.py benchmark --id csi300
publish.py all
publish.py composite
publish.py relationships --run <run>
publish.py check --run <run>
```

`composite`与`relationships`都不属于`all`，分别只在组合结果接口或 Stage 7 观察诊断 run 更新后运行，写完数据后各自运行对应的发布校验，失败即非零退出。`check`调用`website/tools/release_check.py`，是推送上线前的统一门禁：核对观察 run 输出哈希，并要求 Stage 7 与组合两个`verify_website.verify()`都返回`all_pass: true`；否则（包括异常、数据缺失、哈希不符）退出码为 1。两个 verify 模块的直接命令行只打印结果，不作发布判据。

它只负责读取冻结结果、转换网站JSON、更新catalog和复制公共基准。不得下载数据、运行因子、修改回测产物或生成额外审批文件。

## 10. 冻结与发布流程

```text
完成因子回测
→ 只检查新因子特有的代码与数值
→ 确定一份正式结果
→ 写一份最小`ACCEPTANCE_RECORD.json`
→ 运行publish.py一次
→ 生成一个因子JSON
→ 冻结
```

新因子不再生成candidate run与第二份accepted run，不保留重复结果面板。若正式run发现错误，修复后重跑，错误run删除；只把问题与修复结论写入既有修复日志，不另建审计包、兼容性面板或成对比较文件。

冻结后，只有以下情况允许重新发布：

- 因子正式结果确实变更；
- 数据展示schema变更；
- 修正了展示错误。

只改CSS、导航或页面排版时，不重新发布因子JSON。

## 11. 网站导航与当前实现

顶层导航展示四个模块。`single_factor`、`factor_relationships`与`composite_backtest`为当前可用模块，各自路由到独立页面（地址栏 hash 记录当前模块，未知或已移除的 hash 回到第一个模块）；`live_composite`显示模块名称、一句功能说明和“待开发”，不显示虚构数据。

单因子页面使用一套组件展示所有因子，并提供：

- 按`research_theme`筛选；
- 按`method_family`筛选；
- 选择具体因子；
- “定义与核心表现”“稳定性与风险”和“计算公式与口径”三个标签页；
- 公式页展示当前因子已有定义，以及预处理、Rank IC、ICIR、收益、日度估值与日频风险、月频风险对照、覆盖率、暴露和论文比较的公式、输入与缺失规则；相关图表提供直接跳转入口；
- 公式统一用LaTeX书写，由`shared/MathFormula.tsx`调用KaTeX渲染（Display Mode居中，长公式用`aligned`分行，手机端公式区可横向滚动）；KaTeX字体与样式来自项目依赖，随Vite构建打包，不使用外链。中文解释、变量定义与缺失规则放在公式外；
- 公共公式集中在`methodologyDefinitions.ts`，按研究层当前实现核对；因子定义公式由`reporting.py`生成（`formula_tex`）；`CalculationMethods.tsx`与`FactorFormula.tsx`只负责展示。公式说明不执行计算，不改变冻结结果；
- “稳定性与风险”页的主展示为日度净值、日频回撤和由日收益计算的年化波动率与Sharpe（月度调仓、日度估值，年化交易日数A = 252），同时显示有效日数、缺价处理与日月对账；原月频净值与年度表现保留为“月频对照”。日度结果未生成的因子不显示日频区块，不把月频数据改标签为日频；
- 公式页明确区分算术年化与CAGR、月频与日频、PEG原始定义与方向统一后的信号；中性化说明使用实际的申万2021一级行业，残差之后没有再次标准化；
- 有多个primary市场时，页面级分析市场选择器同时控制十档、Monthly IC、日度与月频净值、年度表现、日月对账和暴露；只有一个时显示静态市场标签；
- 覆盖率使用单独的市场选择器，一次只画一个市场。

## 12. 当前开发顺序

1. Factor 1–26、29–33、35–39、41–47已验收并发布，共43个；原47个编号中的Factor 27、28、34、40于2026-10-16经用户确认固定移出当前研究范围。历史原因分别为分析师数据依赖和自由现金流版本冲突；不再作为本轮待补因子。已验收因子不再因后续factor开发重跑。
2. 风险指标采用“月度调仓、日度估值”：分组与调仓沿用冻结run（中性化因子、方向统一、原十档算法），在独立产物`artifacts/daily_valuation/<run_id>/`中按每日收盘估值重建多空净值（100%多/100%空、月内不再平衡），再由日收益计算波动率、Sharpe与日频回撤（A = 252）。共享日度价格缓存位于`data/processed/stage4_daily_prices/`。调仓日无开盘价的股票不建仓；持有期缺价按最近有效价格估值；下一调仓日无开盘价的持仓按结转价格结算（月度E1将其剔除，这是日月差异的唯一来源，网页给出逐年对账）。冻结的因子run、Rank IC与论文比较不变。
3. Factor 37–41历史实现共用一份`stage3_multidimensional_growth_inputs`（单季度毛利润、营业利润，TTM的CFO、自由现金流和营业收入，当期与上年同期两组值）。毛利润在同一财报版本内由营业收入减营业成本得到；Factor 41的“同比变化”是两个比率之差，CFO与营业收入必须是同一报告期。Factor 40曾使用Tushare `cashflow.free_cashflow`（vendor field proxy，原文未给FCF公式），因版本冲突导致覆盖不足；现已移出研究范围，不运行、不发布，共享mart不删除。
4. Factor 42–47共用一份`stage3_operating_efficiency_profitability_inputs`（单季度营业收入、营业成本、归母净利润在t与t−4，总资产、固定资产、存货、归母股东权益在t、t−1、t−4、t−5的报告期末值）。Factor 42–44与47是比率的绝对差值，Factor 45–46是利润率的相对增速；比率不乘4年化。固定资产优先`fix_assets_total`，确实为空时才用`fix_assets`；F44分子用营业收入、F47与表10 ROE Growth同式，均为项目实现选择（strong_inference），不是原文明示。
5. Factor 31–33共用一份`stage3_report_events`（预告、快报、正式财报事件，事件JOR，预告/快报与正式值配对）。JOR采用保守T+1与50个自然日，是approximate replication；Factor 33分母`|expected|`是项目实现选择。Factor 35–36（PEG）为负向因子：论文对比使用原始定义，十档与图表使用−PEG（sign_flipped）。
6. Factor 26–30分属三个family：`cross_sectional_growth_forecast`（26）、`analyst_revision`（27–28）、`standardized_unexpected_growth`（29–30）。Factor 26自2014-11起才有值（2009Q3以前没有总市值，回归需5年样本），2021年以前其他流动负债空值较多，覆盖率较低。
7. Factor 27–28代码已完成，尚未运行和发布；此前受`report_rc`请求限额阻塞，现与Factor 34一起主动排除于本阶段范围。不因额度或数据源变化自动恢复，重新纳入需用户另行确认。已有一致预期实现由`report_rc`自行重建，不等同于Wind一致预期。
8. Factor 20–25：时序分位点与时序回归系数共用同一组8期同比增速，代码上共用一份`growth_rate_history`实现；网站上分为两个`method_family`（`time_series_quantile`、`time_series_regression_coefficient`）。Factor 25原文只有定性结论，没有数值benchmark，网页原文列显示“—”，不做容差判断。
9. 后续因子优先复用已有Stage 3产物，不重复下载数据，不重做PIT和会计转换。
10. 每个因子只做一次正式运行，只检查新family的数学逻辑、当前factor配置和当前结果数值。
11. 验收后使用既有`publish.py`按`--ids`发布对应JSON并更新catalog；不新增前端页面、图表组件或因子专属发布脚本。

## 13. 禁止事项

- 不为81条benchmark observation创建81个文件。
- 不在网站中保存factor panel、raw data或Parquet全量副本。
- 不为网站修改因子definition、pipeline或已冻结结果。
- 不在前端实现Python中的金融指标计算；允许展示经研究代码核对的静态公式和口径说明。
- 不创建空模块目录、空JSON、伪造图表或占位数据。
- 不在每次网站构建时调用Tushare、Python回测或研究汇总程序。
- 不因页面排版改动而重新生成冻结数据。
