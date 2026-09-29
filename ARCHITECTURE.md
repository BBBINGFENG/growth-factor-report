# 量化研究网站架构与数据发布规范

**状态**：当前有效规范  
**更新日期**：2026-09-29  
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

## 2. 网站的六个业务模块

| 模块 | 目录名 | 内容 |
|---|---|---|
| 单因子回测 | `single_factor` | 可独立解释和独立回测的信号定义、IC、分组收益、稳定性和风险 |
| 因子相互解释 | `factor_relationships` | 因子相关性、增量解释力、聚类和冗余分析 |
| Long-only回测 | `long_only_backtest` | 单因子多头组合、基准超额、换手、成本和回撤 |
| 组合因子回测 | `composite_backtest` | 多因子合成、权重、组合表现和归因 |
| 组合因子实盘表现 | `live_composite` | 组合因子的最新信号和样本外表现 |
| Long-only实盘表现 | `live_long_only` | 实际多头组合持仓、净值、交易和归因 |

当前只实现`single_factor`。其他模块在没有真实内容前只在网站导航中显示“待开发”，不创建空数据目录、占位JSON或虚构图表。

## 3. 目标文件结构

```text
website/
├── ARCHITECTURE.md
├── src/
│   ├── App.tsx
│   ├── modules/
│   │   └── single_factor/
│   │       ├── SingleFactorPage.tsx
│   │       ├── DefinitionPerformance.tsx
│   │       ├── StabilityRisk.tsx
│   │       └── data.ts
│   └── shared/
│       ├── FactorChart.tsx
│       ├── format.ts
│       └── types.ts
├── public/data/
│   ├── shared/benchmarks/
│   │   └── csi300_monthly_open_to_open.json
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
- `method_family`：例如`growth_rate`、`displacement_path_ratio`、`upward_count_ratio`、`time_series_quantile`、`analyst_revision`。
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

系列一的`综合估值因子`是C06–C08的外部 composite dependency，记为`Composite Dependency D01`，不占用系列六的Cxx编号。当前只实现`single_factor`，上述C01–C13均推迟到`composite_backtest`模块，不加入单因子网站catalog。

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
| 十档收益 | `decile_returns` |
| 论文benchmark | `benchmark_comparison` |
| Monthly IC | `monthly_ic` |
| 多空累计净值 | 冻结的月度多空收益 |
| 年度表现 | 冻结月度结果的一次性展示汇总 |
| Coverage | 冻结factor panel |
| 市值/行业暴露 | 冻结processed factor panel |
| 沪深300市场参考 | `public/data/shared/benchmarks/csi300_monthly_open_to_open.json` |

`scripts/stage4_single_factor/core/reporting.py`是单因子网站汇总指标的唯一计算位置。发布脚本只调用它并写出JSON；前端只显示JSON。

## 8. 公共基准

沪深300价格指数是所有单因子共用的市场环境参考，不是市场中性多空组合的同风险业绩基准。

- 研究层唯一输出：`data/processed/benchmarks/csi300_monthly_open_to_open.json`。
- 网站部署副本：`website/public/data/shared/benchmarks/csi300_monthly_open_to_open.json`。
- 网站副本必须与研究层文件字节一致。
- 基准不复制进因子JSON，一个页面会话只请求一次。
- 因子与基准均按月初开盘到下月月初开盘对齐，共同起点归一为1。
- 网站必须标注“沪深300价格指数（市场参考）”，不得写成总收益指数。

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
```

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

顶层导航展示六个模块。`single_factor`为当前可用模块；其余五个模块显示模块名称、一句功能说明和“待开发”，不显示虚构数据。

单因子页面使用一套组件展示所有因子，并提供：

- 按`research_theme`筛选；
- 按`method_family`筛选；
- 选择具体因子；
- “定义与核心表现”和“稳定性与风险”两个标签页。

## 12. 当前开发顺序

1. Factor 1–13与单因子网站基础架构已完成，不再因后续factor开发重跑。
2. 下一批只实现Factor 14–19的`growth_acceleration`家族：六个因子共用一份数学实现。
3. 复用现有revenue、n_income_attr_p和total_assets的Stage 3产物，不下载数据，不重做PIT和会计转换。
4. 每个因子只做一次正式运行，只检查新family的数学逻辑、当前factor配置和当前结果数值。
5. 确认后使用既有`publish.py`发布六个JSON并更新catalog；不新增前端页面、图表组件或因子专属发布脚本。

## 13. 禁止事项

- 不为81条benchmark observation创建81个文件。
- 不在网站中保存factor panel、raw data或Parquet全量副本。
- 不为网站修改因子definition、pipeline或已冻结结果。
- 不在前端复制Python中的金融计算公式。
- 不创建空模块目录、空JSON、伪造图表或占位数据。
- 不在每次网站构建时调用Tushare、Python回测或研究汇总程序。
- 不因页面排版改动而重新生成冻结数据。
