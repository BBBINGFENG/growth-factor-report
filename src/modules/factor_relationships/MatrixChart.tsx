import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { CustomChart, HeatmapChart } from "echarts/charts";
import { GridComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { matrixOption, type Cell } from "./matrixOption";

echarts.use([HeatmapChart, CustomChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

interface Props {
  title: string;
  rowLabels: string[];
  colLabels: string[];
  values: Cell[][];
  // Extra tooltip lines for cell (row, col); display only.
  detail: (i: number, j: number) => string[];
  rowBreaks?: number[];
  colBreaks?: number[];
}

const CELL = 32;

// Correlation matrix: colour and legend fixed to -1..1; missing cells are grey with "—", never 0.
// Large matrices keep a readable cell size and scroll inside their frame instead of shrinking.
export default function MatrixChart({ title, rowLabels, colLabels, values, detail, rowBreaks, colBreaks }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const height = rowLabels.length * CELL + (colLabels.length > 6 ? 110 : 80);
  const minWidth = colLabels.length * CELL + 70;

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(matrixOption(rowLabels, colLabels, values, detail, { rowBreaks, colBreaks }));
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [title, rowLabels, colLabels, values, detail, rowBreaks, colBreaks]);

  return (
    <div className="matrix-shell">
      <div className="chart-title">{title}</div>
      <div className="matrix-scroll">
        <div className="chart" ref={ref} style={{ height, minWidth }} />
      </div>
    </div>
  );
}
