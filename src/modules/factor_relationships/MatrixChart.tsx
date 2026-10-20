import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { CustomChart, HeatmapChart } from "echarts/charts";
import { GridComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { matrixOption, type Cell } from "./matrixOption";

echarts.use([HeatmapChart, CustomChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

interface Props {
  title: string;
  labels: string[];
  values: Cell[][];
  // Extra tooltip lines for cell (row, col); display only.
  detail: (i: number, j: number) => string[];
}

// Correlation matrix: colour and legend fixed to -1..1; missing cells are grey with "—", never 0.
export default function MatrixChart({ title, labels, values, detail }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const size = Math.max(260, 60 + labels.length * 38);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(matrixOption(labels, values, detail));
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [title, labels, values, detail]);

  return (
    <div className="chart-shell" style={{ height: size + 30 }}>
      <div className="chart-title">{title}</div>
      <div className="chart" ref={ref} />
    </div>
  );
}
