import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { Num } from "./format";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export interface Series {
  name: string;
  data: Num[];
  type?: "line" | "bar";
  color?: string;
  width?: number;
  dashed?: boolean;
}

interface Props {
  title: string;
  categories: string[];
  series: Series[];
  valueFormat: "percent" | "number";
  yAxisName?: string;
  horizontal?: boolean;
  height?: number;
}

const PALETTE = ["#1f4e79", "#c0504d", "#7f7f7f", "#4f81bd"];

function fmt(v: unknown, kind: Props["valueFormat"], digits: number): string {
  if (v === null || v === undefined || typeof v !== "number" || Number.isNaN(v)) return "—";
  return kind === "percent" ? `${(v * 100).toFixed(digits)}%` : v.toFixed(digits);
}

export default function FactorChart({ title, categories, series, valueFormat, yAxisName, horizontal, height = 320 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const valueAxis = {
      type: "value" as const,
      name: yAxisName,
      nameTextStyle: { color: "#555" },
      scale: valueFormat === "number",
      axisLabel: { formatter: (v: number) => fmt(v, valueFormat, valueFormat === "percent" ? 1 : 2) },
      splitLine: { lineStyle: { color: "#e6e6e6" } },
    };
    const categoryAxis = {
      type: "category" as const,
      data: categories,
      boundaryGap: true,
      axisLabel: { color: "#444", hideOverlap: true, margin: 10 },
      axisTick: { alignWithLabel: true },
    };
    chart.setOption({
      animation: false,
      grid: { left: horizontal ? 20 : 20, right: 20, top: 10, bottom: 20, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: unknown) => fmt(v, valueFormat, valueFormat === "percent" ? 2 : 4),
      },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? { ...categoryAxis, inverse: true } : valueAxis,
      series: series.map((s, i) => ({
        name: s.name,
        type: s.type ?? "line",
        data: s.data,
        connectNulls: false,
        showSymbol: false,
        barMaxWidth: 28,
        color: s.color ?? PALETTE[i % PALETTE.length],
        lineStyle: { width: s.width ?? (i === 0 ? 1.5 : 2.25), type: s.dashed ? ("dashed" as const) : ("solid" as const) },
        z: i + 1,
      })),
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [title, categories, series, valueFormat, yAxisName, horizontal]);

  return (
    <div className="chart-shell" style={{ height }}>
      <div className="chart-title">{title}</div>
      {series.length > 1 && (
        <div className="chart-legend" aria-label="图表系列">
          {series.map((s, i) => (
            <span className="chart-legend-item" key={s.name}>
              <span
                className="chart-legend-swatch"
                style={
                  s.dashed
                    ? { height: 0, borderTop: `3px dashed ${s.color ?? PALETTE[i % PALETTE.length]}`, borderRadius: 0 }
                    : { backgroundColor: s.color ?? PALETTE[i % PALETTE.length] }
                }
                aria-hidden="true"
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div className="chart" ref={ref} />
    </div>
  );
}
