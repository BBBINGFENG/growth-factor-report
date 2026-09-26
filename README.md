# 成长因子单因子回测网站

## 用途

展示《成长投资全解析——基本面量化系列研究之六》复现项目中已正式验收的单因子回测结果。目前包含 Factor 7、8、9。每个因子一页，分为"定义与核心表现"和"稳定性与风险"两个标签。

## 数据来源

网页数据全部来自正式验收的回测 run：`artifacts/factor_acceptance/<factor>/ACCEPTANCE_RECORD.json` 里登记、且仍保留在 `artifacts/factor_runs/<factor>/` 下的那一个 run。

网站只读取已有结果，不重新回测，也不重新做预处理、分组或 Rank IC。

网页中的Economic hypothesis是基于因子定义与因子规格整理的项目摘要，不是论文原文逐字引用。它由 `reporting.py` 中按因子家族编写的文字模板，结合各因子的字段、窗口和会计口径生成。

展示层新增的汇总指标（滚动 IC、累计净值、年度表现、覆盖率、市值和行业暴露）只在 `scripts/stage4_single_factor/core/reporting.py` 中计算一次。前端和发布脚本都不做任何研究计算。

## 发布新因子

新因子验收后，在回测项目根目录运行：

```bash
python3 website/tools/publish_factor.py --factor 07
python3 website/tools/publish_factor.py --all
```

脚本会：
1. 通过 Acceptance Record 找到正式 run；
2. 检查所需文件和字段存在；
3. 调用 `reporting.py` 生成 `public/data/factors/<id>_<name>.json`；
4. 更新 `public/data/factors.json`。

内容没有变化时不会重写文件。要加入 Factor 10 以后的因子，需要在 `publish_factor.py` 的 `NAME_EN` 中登记英文名；如果它属于新的因子家族，还需要在 `reporting.py` 中补充该家族的定义文字模板。

## 本地运行

使用 pnpm（版本见 `package.json` 的 `packageManager` 字段）和 Node.js 24：

```bash
cd website
pnpm install
pnpm run dev
```

正式构建：`pnpm run build`，输出在 `dist/`。本地预览构建结果：`pnpm run preview`。依赖版本锁定在 `pnpm-lock.yaml`；`pnpm-workspace.yaml` 只用于允许 esbuild 运行安装脚本。

## GitHub Pages 发布

1. 把 `website/` 目录作为一个独立仓库的根目录推送到 GitHub，分支为 `main`；
2. 在仓库 Settings → Pages 中，把 Source 设为 "GitHub Actions"；
3. 之后每次推送都会运行 `.github/workflows/deploy.yml`：用 pnpm 按锁定版本安装依赖（`--frozen-lockfile`），构建，再发布到 GitHub Pages。

GitHub 只构建静态网页，使用已提交在 `public/data/` 下的 JSON，不运行 Python，不需要任何 Token。`vite.config.ts` 使用相对路径 `base: "./"`，部署在任意仓库子路径下都能正常访问。

## 禁止事项

网站层（前端代码和 `publish_factor.py`）不得重新计算任何研究指标。需要新指标时，只能加在 `reporting.py` 中，并且只能基于正式 run 已保存的结果。

## JSON 结构

每个因子一个文件，顶层字段：

| 字段 | 内容 |
|---|---|
| `factor` | 编号、key、中英文名、因子家族 |
| `definition` | 经济含义、公式、输入字段、窗口、方向、缺失规则、会计口径 |
| `core_performance` | 有论文 benchmark 的股票池指标、十档收益（含 G10−G1）、与原文对比 |
| `stability` | 月度 IC 与 12 个月滚动均值、多空累计净值、年度表现、覆盖率 |
| `risk_exposure` | 市值暴露（中性化前后）、行业离散度（中性化前后）、长期行业偏向 |
| `notes` | 验收记录中已登记的复现差异 |
| `provenance` | 来源 run、manifest 哈希、Acceptance Record 路径、读取的文件及其登记哈希 |

缺失值统一写为 `null`；日期格式为 `YYYY-MM-DD`；相同输入重复发布得到完全相同的文件。
