// Display-only documentation, checked against preprocessing.py, evaluation.py,
// pipeline_core.py, returns.py, reporting.py and daily_valuation/*.py.
// Formulas are LaTeX rendered by KaTeX; no metric is calculated here.
import type { FormulaSymbol } from "../../shared/MathFormula";

const tex = String.raw;

export interface CalculationItem {
  title: string;
  tex: string;
  symbols?: readonly FormulaSymbol[];
  explanation: string;
  note?: string;
}

export const CALCULATION_SECTIONS = [
  {
    id: "preprocessing",
    title: "预处理与 Neutralization",
    introduction: "每个调仓月独立处理横截面：清理缺失 → MAD 去极值 → Z-score → 市值与行业联合中性化 → 统一因子方向。",
    items: [
      {
        title: "MAD 去极值（Winsorization）",
        tex: tex`\begin{aligned}
m &= \operatorname{median}_{i}\left(x_{i}\right), \qquad \mathrm{MAD} = \operatorname{median}_{i}\left|x_{i}-m\right| \\[4pt]
L &= m - 5 \times 1.4826 \times \mathrm{MAD}, \qquad U = m + 5 \times 1.4826 \times \mathrm{MAD} \\[4pt]
x_{i}^{w} &= \min\!\left(\max\left(x_{i},\, L\right),\, U\right)
\end{aligned}`,
        symbols: [{ tex: tex`x_{i}`, meaning: "原始因子值" }, { tex: tex`x_{i}^{w}`, meaning: "去极值后的值" }],
        explanation: "在当月预处理样本内计算中位数和 MAD；超出上下限的值截到边界，不删除股票。",
        note: "NaN 保留为缺失，±∞ 先转为缺失；MAD = 0 时该月不截尾。1.4826 是实际代码采用的缩放系数。",
      },
      {
        title: "Z-score 标准化",
        tex: tex`\begin{aligned}
\bar{x}^{w} &= \frac{1}{N}\sum_{i=1}^{N} x_{i}^{w} \\[4pt]
s_{x} &= \sqrt{\frac{1}{N-1}\sum_{i=1}^{N}\left(x_{i}^{w}-\bar{x}^{w}\right)^{2}} \\[4pt]
z_{i} &= \frac{x_{i}^{w}-\bar{x}^{w}}{s_{x}}
\end{aligned}`,
        symbols: [{ tex: tex`N`, meaning: "当月有效股票数" }],
        explanation: "用去极值后的有效值计算横截面均值和样本标准差（ddof = 1）。",
        note: "标准差为 0 或不可得时，该月标准化结果缺失。标准化在中性化之前进行。",
      },
      {
        title: "市值与行业联合中性化（Neutralization）",
        tex: tex`\begin{aligned}
z_{i} &= \alpha + \beta \ln\left(\mathrm{MV}_{i}\right) + \sum_{k=1}^{K-1}\gamma_{k} D_{i,k} + \varepsilon_{i} \\[6pt]
\mathbf{X} &= \begin{bmatrix}
1 & \ln \mathrm{MV}_{1} & D_{1,1} & \cdots & D_{1,K-1} \\
\vdots & \vdots & \vdots & \ddots & \vdots \\
1 & \ln \mathrm{MV}_{N} & D_{N,1} & \cdots & D_{N,K-1}
\end{bmatrix}, \qquad
\hat{\boldsymbol{\theta}} = \left(\mathbf{X}^{\top}\mathbf{X}\right)^{-1}\mathbf{X}^{\top}\mathbf{z} \\[6pt]
\mathbf{f} &= \mathbf{z} - \mathbf{X}\hat{\boldsymbol{\theta}} = \hat{\boldsymbol{\varepsilon}}
\end{aligned}`,
        symbols: [
          { tex: tex`\mathrm{MV}_{i}`, meaning: "信息截止日（调仓前一交易日）的总市值" },
          { tex: tex`D_{i,k}`, meaning: "申万2021一级行业 Dummy；K 个行业只放 K−1 列，代码排序最小的行业作基准" },
          { tex: tex`f_{i}`, meaning: "中性化后的因子值（回归残差）" },
        ],
        explanation: "每月做一次含截距、无权重的横截面 OLS，最终使用残差 f。",
        note: "总市值缺失或 ≤ 0、行业缺失、标准化值缺失的股票不参加回归；有效股票不足5只的行业也被剔除。样本不足或矩阵不满秩时结果缺失。行业归属按调仓日的供应商有效区间匹配。残差之后没有再次做 Z-score。",
      },
      {
        title: "中性化后为何接近 0？",
        tex: tex`\sum_{i}\hat{\varepsilon}_{i} = 0, \qquad \sum_{i}\hat{\varepsilon}_{i}\ln\left(\mathrm{MV}_{i}\right) = 0, \qquad \sum_{i}\hat{\varepsilon}_{i} D_{i,k} = 0`,
        explanation: "这是 OLS 正规方程在回归样本上的性质（数值误差内成立）：残差均值、残差与市值的线性暴露、各行业残差均值都为 0。个股残差本身仍有差异，可以用于排序。",
        note: "之后只查看某个子样本时，不保证仍严格为 0。接近 0 的暴露不等于因子没有预测能力。",
      },
      {
        title: "统一方向后的选股信号",
        tex: tex`q_{i} = \begin{cases} f_{i}, & \text{正向因子} \\ -f_{i}, & \text{负向因子（如 PEG）} \end{cases}`,
        explanation: "十档分组、月度 Rank IC 图、多空组合和年度表现都使用 q，数值越高代表越看好。",
        note: "PEG 的核心表现及论文比较保留原始定义 f，Rank IC 和多空收益的符号可能与方向统一后的图表相反。",
      },
    ],
  },
  {
    id: "ic",
    title: "Rank IC、ICIR 与 IC>0 占比",
    introduction: "IC 衡量当月股票之间的因子排序与下一期收益排序的关系；ICIR 衡量月度 IC 序列的稳定性。IC 仍是月频指标。",
    items: [
      {
        title: "单月 Rank IC（Spearman correlation）",
        tex: tex`\begin{aligned}
a_{i} &= \operatorname{rank}\left(q_{i,t}\right), \qquad b_{i} = \operatorname{rank}\left(r_{i,\,t\to t+1}\right) \\[4pt]
\mathrm{IC}_{t} &= \frac{\sum_{i}\left(a_{i}-\bar{a}\right)\left(b_{i}-\bar{b}\right)}{\sqrt{\sum_{i}\left(a_{i}-\bar{a}\right)^{2}\,\sum_{i}\left(b_{i}-\bar{b}\right)^{2}}}
\end{aligned}`,
        explanation: "每月在所选股票池内，对因子与下一期 E1 收益均非缺失的股票分别排名；并列值取平均名次，再对两组名次计算 Pearson correlation。",
        note: "有效股票不足30只的月份可以记录单月 IC，但不进入均值、ICIR、正占比和滚动均值。任一组值无横截面差异时，相关系数缺失。论文对比中的 PEG 使用原始定义 f 排名。",
      },
      {
        title: "平均 Rank IC 与年化 ICIR",
        tex: tex`\begin{aligned}
\overline{\mathrm{IC}} &= \frac{1}{T^{\mathrm{IC}}}\sum_{t}\mathrm{IC}_{t} \\[4pt]
s^{\mathrm{IC}} &= \sqrt{\frac{1}{T^{\mathrm{IC}}-1}\sum_{t}\left(\mathrm{IC}_{t}-\overline{\mathrm{IC}}\right)^{2}} \\[4pt]
\mathrm{ICIR}^{\mathrm{ann}} &= \frac{\overline{\mathrm{IC}}}{s^{\mathrm{IC}}}\times\sqrt{12}
\end{aligned}`,
        symbols: [{ tex: tex`T^{\mathrm{IC}}`, meaning: "有效 IC 月数" }],
        explanation: "各月等权，不按每月股票数加权；s 是月度 IC 的样本标准差（ddof = 1）。",
        note: "标准差为 0 或有效 IC 月数不足2时，ICIR 缺失。这里的 √12 对应月频，不是日频。",
      },
      {
        title: "IC>0 占比与12个月滚动均值",
        tex: tex`\begin{aligned}
\text{IC>0 占比} &= \frac{\#\left\{t:\ \mathrm{IC}_{t}>0\right\}}{T^{\mathrm{IC}}} \\[4pt]
\overline{\mathrm{IC}}^{(12)}_{t} &= \frac{1}{12}\sum_{j=0}^{11}\mathrm{IC}_{t-j}
\end{aligned}`,
        explanation: "IC = 0 不计入正值月份，但仍在有效月份分母中。滚动均值取最近12个日历月位置，必须12个月的 IC 都有效。",
        note: "窗口不足12个月或其中任一 IC 缺失时，滚动均值为空；不会跳过缺失月、拼接更早的有效观测。IC>0 占比不是组合盈利月份占比。",
      },
    ],
  },
  {
    id: "returns",
    title: "E1 收益、十档组合与算术年化",
    introduction: "每月在调仓日开盘调仓；月度十档收益从本月调仓日开盘计算到下月调仓日开盘，组内等权，未计交易成本。这些月度结果用于 IC、十档图和论文比较。",
    items: [
      {
        title: "个股 E1 forward return",
        tex: tex`\begin{aligned}
P^{\mathrm{adj}}_{i,t} &= \mathrm{Open}_{i,t}\times\mathrm{AdjFactor}_{i,t} \\[4pt]
r_{i,\,t\to t+1} &= \frac{P^{\mathrm{adj}}_{i,t+1}}{P^{\mathrm{adj}}_{i,t}} - 1
\end{aligned}`,
        explanation: "Open 为调仓日原始开盘价，AdjFactor 为当日复权因子；t 与 t+1 是相邻的月度调仓端点。E1 用额外的下月端点结算最后一个真实信号月。",
        note: "任一端点没有有效复权开盘价时，该股票本期收益缺失；不顺延到下一个有价格的交易日。",
      },
      {
        title: "十档分组与月度多空收益",
        tex: tex`\begin{aligned}
G_{i,t} &= \left\lfloor \frac{\left(p_{i,t}-1\right)\times 10}{N_{t}} \right\rfloor + 1 \\[4pt]
R_{G,t} &= \frac{1}{n_{G,t}}\sum_{i\in G} r_{i,\,t\to t+1} \\[4pt]
R^{\mathrm{LS}}_{t} &= R_{G10,t} - R_{G1,t}
\end{aligned}`,
        symbols: [
          { tex: tex`p_{i,t}`, meaning: "按 q 从小到大的排序位置（从1开始），信号相同时按股票代码稳定排序" },
          { tex: tex`N_{t}`, meaning: "有效信号股票数" },
          { tex: tex`n_{G,t}`, meaning: "该组中 E1 收益非缺失的股票数" },
        ],
        explanation: "G1 为最低组、G10 为最高组。各组收益是该组收益非缺失股票的等权平均。",
        note: "有效信号不足10只时不分组；G1 或 G10 没有有效收益时，多空收益缺失。并列信号可能被拆到相邻组。G10−G1 两组收益直接相减，没有再除以2。",
      },
      {
        title: "股票池等权 benchmark 与十档超额收益",
        tex: tex`\begin{aligned}
B_{t} &= \operatorname{mean}\left\{ r_{i,\,t\to t+1} : i \in \text{当月股票池合格成员，收益有效} \right\} \\[4pt]
\mathrm{Excess}_{G,t} &= R_{G,t} - B_{t}, \qquad \text{年化超额} = 12\times\operatorname{mean}_{t}\left(\mathrm{Excess}_{G,t}\right)
\end{aligned}`,
        explanation: "benchmark 使用当月历史股票池成员，不依赖某个因子是否有值。每个组仅在组收益与 benchmark 都有效的月份上计算均值。",
        note: "十档 benchmark 是同股票池等权组合；沪深300价格指数仅为市场环境参考，不参与十档超额计算。",
      },
      {
        title: "核心表现表的多空算术年化收益",
        tex: tex`R^{\mathrm{LS}}_{\mathrm{arith}} = 12\times\frac{1}{T^{R}}\sum_{t} R^{\mathrm{LS}}_{t}`,
        explanation: "核心表现表、论文对比和十档图的 G10−G1 行使用月均收益乘12。股票池 benchmark 在 G10−G1 中相互抵消。",
        note: "该指标不是 CAGR，也不是日频结果。PEG 论文对比使用原始定义下的 G10−G1，图表使用方向统一后的 G10−G1。",
      },
    ],
  },
  {
    id: "risk",
    title: "月度调仓、日度估值：净值与日频风险",
    introduction: "组合仍按月选股和调仓；月内不调仓，每个交易日收盘估值一次。风险指标主口径为完整策略：有效回测期内每个完整交易日一条日收益，空仓现金日收益为0也计入；年化交易日数 A 见页首口径。不计交易成本、融券成本和利息，是理论因子评价，不代表可实现的交易策略。",
    items: [
      {
        title: "资金尺度与月内估值（100% 多头 + 100% 空头）",
        tex: tex`\begin{aligned}
R_{L}(m\to p) &= \frac{1}{n_{L}}\sum_{i\in G10}\frac{P_{i,p}}{P^{\mathrm{open}}_{i,s_{m}}} - 1, \qquad
R_{S}(m\to p) = \frac{1}{n_{S}}\sum_{i\in G1}\frac{P_{i,p}}{P^{\mathrm{open}}_{i,s_{m}}} - 1 \\[6pt]
V_{m,p} &= V_{m}\left[1 + R_{L}(m\to p) - R_{S}(m\to p)\right], \qquad V_{m+1} = V_{m,\,e_{m}}
\end{aligned}`,
        symbols: [
          { tex: tex`V_{m}`, meaning: "第 m 月调仓日开盘的组合权益；多头与空头名义金额各等于该权益，总暴露 200%" },
          { tex: tex`s_{m},\ e_{m}`, meaning: "本月调仓日与下月调仓日；下月调仓日开盘时结算旧持仓并同时建立新持仓" },
          { tex: tex`p`, meaning: "估值点：月内每个交易日收盘，以及 e_m 开盘" },
          { tex: tex`n_{L},\ n_{S}`, meaning: "调仓日有有效复权开盘价、实际建仓的 G10 / G1 股票数" },
        ],
        explanation: "建仓后股数不变，权重随价格自然漂移；月内不恢复等权，也不恢复相同的多空名义金额。因此不能把每日 G10 收益减 G1 收益直接连乘。",
        note: "下月调仓日开盘的估值与月度 E1 的 G10−G1 端点相同；相同持仓、相同端点时两者在浮点误差内相等，网页单独给出对账结果。",
      },
      {
        title: "日收益与调仓日",
        tex: tex`\begin{aligned}
r_{d} &= \frac{V^{\mathrm{close}}_{d}}{V^{\mathrm{close}}_{d-1}} - 1 \\[4pt]
\frac{V^{\mathrm{close}}_{d}}{V^{\mathrm{close}}_{d-1}} &= \underbrace{\frac{V_{m+1}}{V^{\mathrm{close}}_{d-1}}}_{\text{旧持仓隔夜}}\times\underbrace{\frac{V^{\mathrm{close}}_{d}}{V_{m+1}}}_{\text{新持仓日内}} \qquad (d = e_{m})
\end{aligned}`,
        explanation: "每个交易日只有一条日收益。调仓日的收益由旧持仓的隔夜损益和新持仓的日内损益相乘得到，开盘对账点保留但不作为独立交易日。",
        note: "起始开盘到首日收盘、末日收盘到最终开盘两个非完整区间计入净值和区间收益，但不作为完整交易日进入波动率与 Sharpe。无有效信号的月份不建仓，权益保持不变，这些空仓日收益为0，作为完整交易日进入主口径统计。",
      },
      {
        title: "年化波动率与 Sharpe ratio（日频，完整策略）",
        tex: tex`\begin{aligned}
e_{d} &= r_{d} - r_{f,d}, \qquad r_{f,d} = 0, \qquad d \in \mathcal{D} \\[4pt]
\sigma^{\mathrm{ann}} &= \operatorname{std}\left(r_{d},\ \mathrm{ddof}=1\right)\times\sqrt{A} \\[4pt]
\mathrm{Sharpe}^{\mathrm{ann}} &= \frac{\operatorname{mean}\left(e_{d}\right)}{\operatorname{std}\left(e_{d},\ \mathrm{ddof}=1\right)}\times\sqrt{A}
\end{aligned}`,
        symbols: [
          { tex: tex`\mathcal{D}`, meaning: "有效回测期内全部完整交易日：持仓日，以及无信号空仓的现金日（收益为0）" },
          { tex: tex`A`, meaning: "年化交易日数（数值见页首口径）" },
        ],
        explanation: "主口径评价完整策略。另给出只用持仓日（前一收盘或当日盘中持有组合）计算的持仓期波动率与 Sharpe，作为补充，不作为默认指标。",
        note: "不是把月频 Sharpe 除以 √20，也不是只把 √12 换成 √252；日收益由每日收盘估值重新计算。",
      },
      {
        title: "日频最大回撤",
        tex: tex`\mathrm{MDD} = \min_{p}\left(\frac{V_{p}}{\max_{u\le p} V_{u}} - 1\right)`,
        explanation: "在起始开盘点、每个交易日收盘和最终开盘端点上寻找历史最高净值与之后的最低净值，结果以负数显示；回撤不乘任何年化系数。",
        note: "日度收盘估值仍然看不到盘中最低点（intraday drawdown），真实盘中回撤可能更深。",
      },
      {
        title: "区间收益与 CAGR",
        tex: tex`\begin{aligned}
\text{区间收益} &= \frac{V_{\mathrm{end}}}{V_{\mathrm{begin}}} - 1 \\[4pt]
\mathrm{CAGR} &= \left(\frac{V_{\mathrm{end}}}{V_{\mathrm{begin}}}\right)^{365.25/D} - 1
\end{aligned}`,
        symbols: [
          { tex: tex`V_{\mathrm{begin}}`, meaning: "区间开始前最后一个估值点（整体为起始开盘；年度为上年最后一个收盘）" },
          { tex: tex`D`, meaning: "两个估值点之间的日历天数" },
        ],
        explanation: "年度行按估值日期归属自然年；“整体”自有效回测期起点开盘至最终开盘，“2021年至今”自2020年末收盘至最终开盘，均按实际日历时长年化；有效期内的空仓现金月计入时长，不压缩时间。",
        note: "日度年度边界（上年末收盘到当年末收盘）与月频年度边界（年初调仓开盘到次年初调仓开盘）不同，年度数值不能逐项相等；按 E1 端点的对账见本页对账表。",
      },
      {
        title: "有效回测期与空仓现金月",
        tex: tex`\begin{aligned}
t_{\mathrm{start}} &= \begin{cases} \text{分支第一个信号月}, & \text{事件类因子（JOR、财报超预告快报）} \\ \text{第一个可形成 G10/G1 持仓的月份}, & \text{其他因子} \end{cases} \\[6pt]
t_{\mathrm{end}} &= \text{最后一个信号月的结束开盘（E1 终点）}
\end{aligned}`,
        explanation: "股票池尚无历史覆盖、或因子尚不可用（例如历史窗口或回归训练年数不足）的月份不在有效期内，不补作现金。事件类因子在有效期内事件不足、无法分组的月份持有现金，收益为0，时长计入 CAGR，日收益计入主口径统计。",
        note: "空仓月必须同时满足：未形成分组，且当月非 ok 的原始状态都属于声明的“无事件”状态；否则视为数据异常并报错，不会自动当作空仓。非事件类因子在有效期内出现空仓同样报错。",
      },
      {
        title: "停牌、缺价、退市与退出代理（theoretical proxy）",
        tex: tex`P_{i,p} = \begin{cases} P^{\mathrm{close}}_{i,d}, & \text{当日有有效收盘价} \\ P^{\mathrm{close}}_{i,\tau}, & \text{否则，}\tau = \text{建仓后最近一个有效收盘日（或建仓价）} \end{cases}`,
        explanation: "已持有股票缺价时按建仓后最近一次有效价格估值，只用过去价格，不用未来价格回填，也不把缺失收益填0；缺价原因分为停牌（停复牌记录）、退市（退市日之后）和未知缺口，未知缺口单独计数，不当作停牌。调仓日没有有效开盘价的股票不建仓。",
        note: "下一调仓日没有开盘价的持仓，按最近有效价格估值并假设在该开盘平仓：这是理论代理，不是真实成交。若股票跨调仓日继续停牌、复牌后大幅涨跌，这部分损益不由任何持仓承担。月度 E1 则把这类股票从当月组收益中剔除。退出价格敏感性测算只替换退出价格，没有重建真实跨月持有的日度路径。",
      },
    ],
  },
  {
    id: "monthly_risk",
    title: "月频风险对照（旧口径）",
    introduction: "保留原月频结果供对照：输入是月度 G10−G1 收益，Tᴿ 为当前统计区间的有效收益月数。",
    items: [
      {
        title: "月频净值、区间收益与 CAGR",
        tex: tex`\begin{aligned}
\mathrm{NAV}_{t} &= \prod_{j=1}^{t}\left(1 + R_{j}\right) \\[4pt]
\mathrm{CAGR}^{\mathrm{monthly}} &= \left[\prod_{t}\left(1 + R_{t}\right)\right]^{12/T^{R}} - 1
\end{aligned}`,
        explanation: "缺失收益月被跳过，不补0；CAGR 按有效收益月数年化（12/Tᴿ），不按日历时长。当期间内有无收益月份（如事件类因子的无信号月）时，它会高于按日历时长年化的日度 CAGR。",
      },
      {
        title: "月频波动率、Sharpe 与回撤",
        tex: tex`\begin{aligned}
\sigma^{\mathrm{monthly}} &= \operatorname{std}\left(R_{t}\right)\times\sqrt{12}, \qquad
\mathrm{Sharpe}^{\mathrm{monthly}} = \frac{\bar{R}}{\operatorname{std}\left(R_{t}\right)}\times\sqrt{12} \\[4pt]
\mathrm{MDD}^{\mathrm{monthly}} &= \min_{t}\left(\frac{\mathrm{NAV}_{t}}{\max_{u\le t}\mathrm{NAV}_{u}} - 1\right)
\end{aligned}`,
        explanation: "只在每月结算端点观察净值，月内大跌后恢复的过程不可见；因此月频回撤通常浅于日频回撤。",
        note: "月频 Sharpe 使用月收益的算术均值和样本标准差，不是 CAGR ÷ 波动率。",
      },
    ],
  },
  {
    id: "coverage",
    title: "覆盖率与有效月份",
    introduction: "覆盖率描述可用于回测的数据比例，不等于收益胜率；每个股票池单独计算。",
    items: [
      {
        title: "月度回测有效覆盖率",
        tex: tex`\mathrm{Coverage}_{t} = \frac{V_{t}}{E_{t}}`,
        symbols: [
          { tex: tex`E_{t}`, meaning: "当月历史 PIT 股票池中全部合格成员数" },
          { tex: tex`V_{t}`, meaning: "其中原始因子有限、信息截止日总市值 > 0、调仓日行业有效且下一期 E1 收益有限的股票数" },
        ],
        explanation: "这里的 V 是股票数，不是组合权益。",
        note: "E = 0 时覆盖率缺失。当前覆盖率不额外扣除中性化时行业样本少于5只或回归失败的股票，因而不一定等于最终有效残差占比。",
      },
      {
        title: "全样本平均、生效期平均与最低覆盖率",
        tex: tex`\begin{aligned}
t_{0} &= \min\left\{t:\ V_{t}\ge 30\right\} \\[4pt]
\text{生效期平均} &= \operatorname{mean}_{t\ge t_{0}}\left(\mathrm{Coverage}_{t}\right), \qquad
\text{生效期最低} = \min_{t\ge t_{0}}\left(\mathrm{Coverage}_{t}\right)
\end{aligned}`,
        explanation: "各月覆盖率等权平均，不是 ΣV ÷ ΣE。生效期从首个有效股票数至少30只的月份开始，之后的低覆盖率月份仍保留。",
        note: "“最新”取最后一个非缺失月度覆盖率；没有任何月份达到30只时，首个有效月份、生效期平均和最低覆盖率均为空。",
      },
      {
        title: "有效 IC 月数、有效收益月数与有效交易日数",
        tex: tex`\begin{aligned}
T^{\mathrm{IC}} &= \#\left\{t:\ \mathrm{IC}_{t}\ \text{非缺失且有效股票数}\ge 30\right\}, \qquad
T^{R} = \#\left\{t:\ R^{\mathrm{LS}}_{t}\ \text{非缺失}\right\} \\[4pt]
T^{d} &= \#\mathcal{D} = \#\left\{d:\ \text{有效回测期内的完整交易日（含空仓现金日）}\right\}
\end{aligned}`,
        explanation: "Rank IC、ICIR 和 IC>0 占比使用 T^IC；月频风险使用 T^R；日频波动率与 Sharpe 使用 T^d，持仓期补充指标只用其中的持仓日。",
      },
    ],
  },
  {
    id: "exposure",
    title: "市值暴露与行业暴露",
    introduction: "这些图检查因子与市值、行业的关系；使用标准化值 z 与中性化残差 f，不使用方向翻转后的 q。",
    items: [
      {
        title: "市值暴露（Size exposure）",
        tex: tex`\begin{aligned}
\mathrm{Exposure}^{\mathrm{before}}_{t} &= \operatorname{Corr}\left(z_{i,t},\ \ln \mathrm{MV}_{i,t}\right) \\[4pt]
\mathrm{Exposure}^{\mathrm{after}}_{t} &= \operatorname{Corr}\left(f_{i,t},\ \ln \mathrm{MV}_{i,t}\right)
\end{aligned}`,
        explanation: "中性化前后使用同时具有标准化值、残差和有效市值的相同股票样本。这是 Pearson correlation，不是 Rank IC，也不是组合收益的 Beta。",
        note: "有效股票不足30只或任一变量标准差为0时，相关系数为空。",
      },
      {
        title: "行业均值的加权离散度",
        tex: tex`\begin{aligned}
\mu_{k,t} &= \operatorname{mean}\left\{v_{i,t}:\ i\in k\right\}, \qquad w_{k,t} = \frac{n_{k,t}}{\sum_{k} n_{k,t}}, \qquad \mu_{t} = \sum_{k} w_{k,t}\,\mu_{k,t} \\[4pt]
\mathrm{Dispersion}_{t} &= \sqrt{\sum_{k} w_{k,t}\left(\mu_{k,t}-\mu_{t}\right)^{2}}
\end{aligned}`,
        symbols: [{ tex: tex`v`, meaning: "中性化前取 z，中性化后取 f" }, { tex: tex`n_{k,t}`, meaning: "共同有效样本中的行业股票数" }],
        explanation: "离散度越低，各行业平均因子值越接近。",
        note: "前后使用相同股票样本；总样本不足30只时缺失。按行业股票数加权，不按行业市值加权，也不除以行业数减1。",
      },
      {
        title: "长期行业偏向",
        tex: tex`\mathrm{Bias}_{k} = \frac{1}{T_{k}}\sum_{t}\mu_{k,t}`,
        symbols: [{ tex: tex`T_{k}`, meaning: "该行业有观测的月数" }],
        explanation: "把某行业的月度平均因子值跨月份等权平均。图中仅展示中性化前 |Bias| 最大的10个行业，并同时画出中性化后的值。",
        note: "该图反映因子分数的行业偏向，不是行业持仓权重或行业收益贡献。",
      },
    ],
  },
  {
    id: "comparison",
    title: "论文比较与沪深300市场参考",
    introduction: "论文 benchmark、十档等权 benchmark 和沪深300市场参考分别服务于不同的比较。",
    items: [
      {
        title: "复现值与论文值的差异",
        tex: tex`\text{绝对差} = \text{复现值} - \text{原文值}, \qquad \text{相对差} = \frac{\text{复现值} - \text{原文值}}{\left|\text{原文值}\right|}`,
        explanation: "对 Rank IC、年化 ICIR 和多空算术年化收益逐项比较，仍是月频口径。“绝对差”保留正负；Rank IC 与收益的差值按百分数显示时应读作百分点差。",
        note: "原文值缺失时差异为空；原文值为0时相对差为空。已登记的复现差异读取验收记录，网页不重新做容差分类。",
      },
      {
        title: "沪深300日度市场参考",
        tex: tex`\begin{aligned}
\text{参考净值}_{p} &= \frac{I_{p}}{I_{p_{0}}} \\[4pt]
\text{年度沪深300收益} &= \frac{I_{\mathrm{end}}}{I_{\mathrm{begin}}} - 1
\end{aligned}`,
        symbols: [
          { tex: tex`I_{p}`, meaning: "沪深300价格指数在估值点 p 的点位（起始与最终端点用开盘，其余用收盘）" },
          { tex: tex`p_{0}`, meaning: "因子组合的起始开盘点" },
        ],
        explanation: "与因子日度净值使用相同估值点和相同年度边界。月频对照表中的沪深300仍为月初开盘到下月月初开盘。",
        note: "沪深300只作市场环境参考，不从因子多空收益中扣除，也不是十档超额收益的 benchmark。",
      },
    ],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  introduction: string;
  items: readonly CalculationItem[];
}[];

export type FormulaSectionId = "factor" | (typeof CALCULATION_SECTIONS)[number]["id"];
export type ShowFormula = (section: FormulaSectionId) => void;
