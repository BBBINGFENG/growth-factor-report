import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { Num } from "./factorData";

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

export interface Series {
  name: string;
  data: Num[];
  type?: "line" | "bar";
  color?: string;
  width?: number;
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
      axisLabel: { color: "#444" },
      axisTick: { alignWithLabel: true },
    };
    chart.setOption({
      animation: false,
      title: { text: title, left: 0, textStyle: { fontSize: 14, fontWeight: 600, color: "#1a1a1a" } },
      grid: { left: horizontal ? 96 : 56, right: 16, top: 56, bottom: 36, containLabel: false },
      legend: series.length > 1 ? { top: 24, left: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 12 } } : undefined,
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
        lineStyle: { width: s.width ?? 1.5 },
      })),
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [title, categories, series, valueFormat, yAxisName, horizontal]);

  return <div className="chart" ref={ref} style={{ height }} />;
}
