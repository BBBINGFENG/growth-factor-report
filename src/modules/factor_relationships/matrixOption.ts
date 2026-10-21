// ECharts option for a correlation matrix; pure, so it can be render-tested outside the browser.
// Present values go through a heatmap whose colour scale is fixed to -1..1. Missing cells (null) are
// drawn by a separate layer as a grey cell with "—"; they never enter the heatmap as a number.
// Rows and columns may differ (a slice of a larger matrix); `rowBreaks` / `colBreaks` are indices where
// a new category starts and get a dark separator line.

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

interface RenderParams {
  coordSys: { x: number; y: number; width: number; height: number };
}

export interface MatrixOptions {
  rowBreaks?: number[];
  colBreaks?: number[];
  showValues?: boolean;
}

export function matrixOption(rowLabels: string[], colLabels: string[], values: Cell[][], detail: (i: number, j: number) => string[], opts: MatrixOptions = {}) {
  const present: number[][] = [];
  const missing: number[][] = [];
  values.forEach((row, i) =>
    row.forEach((v, j) => (v === null || !Number.isFinite(v) ? missing.push([j, i]) : present.push([j, i, v]))),
  );
  const many = Math.max(rowLabels.length, colLabels.length) > 9;
  const fontSize = many ? 9 : 11;
  const showValues = opts.showValues ?? true;
  const breaks = [...(opts.colBreaks ?? []).map((k) => [k, 0, 0]), ...(opts.rowBreaks ?? []).map((k) => [0, k, 1])];
  const head = (i: number, j: number) => `${rowLabels[i]} × ${colLabels[j]}`;
  return {
    animation: false,
    grid: { left: 10, right: 10, top: 10, bottom: 50, containLabel: true },
    tooltip: {
      formatter: (p: TipParams) => {
        if (p.seriesIndex === 2) return "";
        const [j, i, v] = p.data;
        const first = p.seriesIndex === 1 ? `${head(i, j)}：缺失（样本不足或无差异，不是 0）` : `${head(i, j)}：${v.toFixed(3)}`;
        return [first, ...detail(i, j)].join("<br/>");
      },
    },
    xAxis: { type: "category", data: colLabels, axisLabel: { rotate: colLabels.length > 6 ? 90 : 0, color: "#333", fontSize: 11, interval: 0 }, splitArea: { show: true } },
    yAxis: { type: "category", data: rowLabels, inverse: true, axisLabel: { color: "#333", fontSize: 11, interval: 0 }, splitArea: { show: true } },
    visualMap: {
      seriesIndex: 0, min: -1, max: 1, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemHeight: 140,
      inRange: { color: ["#2166ac", "#f7f7f7", "#b2182b"] }, text: ["1", "−1"], formatter: (v: number) => v.toFixed(1),
    },
    series: [
      {
        type: "heatmap", data: present,
        label: { show: showValues, fontSize, formatter: (p: { data: number[] }) => p.data[2].toFixed(2) },
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
      {
        type: "custom", data: breaks, encode: { x: 0, y: 1 }, z: 4, silent: true, tooltip: { show: false },
        renderItem: (params: RenderParams, api: RenderApi) => {
          const cs = params.coordSys;
          const [x, y] = api.coord([api.value(0), api.value(1)]);
          const [w, h] = api.size([1, 1]);
          const shape = api.value(2) === 0
            ? { x1: x - w / 2, y1: cs.y, x2: x - w / 2, y2: cs.y + cs.height }
            : { x1: cs.x, y1: y - h / 2, x2: cs.x + cs.width, y2: y - h / 2 };
          return { type: "line", shape, style: { stroke: "#222", lineWidth: 1.5 } };
        },
      },
    ],
  };
}
