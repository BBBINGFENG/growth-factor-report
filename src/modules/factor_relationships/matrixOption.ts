// ECharts option for a correlation matrix; pure, so it can be render-tested outside the browser.
// Present values go through a heatmap whose colour scale is fixed to -1..1. Missing cells (null) are
// drawn by a separate layer as a grey cell with "—"; they never enter the heatmap as a number.

export type Cell = number | null;
export const MISSING_FILL = "#d9d9d9";
export const MISSING_TEXT = "—";

interface TipParams {
  seriesIndex: number;
  data: number[];
}

interface RenderApi {
  value: (dim: number) => number;
  coord: (v: number[]) => number[];
  size: (v: number[]) => number[];
}

export function matrixOption(labels: string[], values: Cell[][], detail: (i: number, j: number) => string[]) {
  const present: number[][] = [];
  const missing: number[][] = [];
  values.forEach((row, i) =>
    row.forEach((v, j) => (v === null || !Number.isFinite(v) ? missing.push([j, i]) : present.push([j, i, v]))),
  );
  const fontSize = labels.length > 9 ? 9 : 11;
  const head = (i: number, j: number) => `${labels[i]} × ${labels[j]}`;
  return {
    animation: false,
    grid: { left: 10, right: 10, top: 10, bottom: 50, containLabel: true },
    tooltip: {
      formatter: (p: TipParams) => {
        const [j, i, v] = p.data;
        const first = p.seriesIndex === 1 ? `${head(i, j)}：缺失（样本不足或无差异，不是 0）` : `${head(i, j)}：${v.toFixed(3)}`;
        return [first, ...detail(i, j)].join("<br/>");
      },
    },
    xAxis: { type: "category", data: labels, axisLabel: { rotate: labels.length > 6 ? 45 : 0, color: "#444" }, splitArea: { show: true } },
    yAxis: { type: "category", data: labels, inverse: true, axisLabel: { color: "#444" }, splitArea: { show: true } },
    visualMap: {
      seriesIndex: 0, min: -1, max: 1, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemHeight: 140,
      inRange: { color: ["#2166ac", "#f7f7f7", "#b2182b"] }, text: ["1", "−1"], formatter: (v: number) => v.toFixed(1),
    },
    series: [
      {
        type: "heatmap", data: present,
        label: { show: true, fontSize, formatter: (p: { data: number[] }) => p.data[2].toFixed(2) },
        itemStyle: { borderColor: "#fff", borderWidth: 1 },
        emphasis: { itemStyle: { borderColor: "#333", borderWidth: 1 } },
      },
      {
        type: "custom", data: missing, encode: { x: 0, y: 1 }, z: 3,
        renderItem: (_: unknown, api: RenderApi) => {
          const [x, y] = api.coord([api.value(0), api.value(1)]);
          const [w, h] = api.size([1, 1]);
          return {
            type: "group",
            children: [
              { type: "rect", shape: { x: x - w / 2, y: y - h / 2, width: w, height: h }, style: { fill: MISSING_FILL, stroke: "#fff", lineWidth: 1 } },
              { type: "text", x, y, style: { text: MISSING_TEXT, align: "center", verticalAlign: "middle", fill: "#444", fontSize } },
            ],
          };
        },
      },
    ],
  };
}
