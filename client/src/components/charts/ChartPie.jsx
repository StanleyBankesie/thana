/**
 * @fileoverview ChartPie component.
 * Renders a pie or doughnut chart using Chart.js.
 */

import React, { useEffect, useRef } from "react";
import { loadChartJs } from "@/lib/loadChartJs.js";

const PALETTE = [
  "#6366f1", "#22c55e", "#ef4444", "#f59e0b",
  "#06b6d4", "#a855f7", "#0ea5e9", "#84cc16",
  "#fb7185", "#f97316",
];

/**
 * ChartPie component
 * @param {Object} props
 * @param {Array} props.data - Array of data objects {label, value}.
 * @param {boolean} [props.donut=false] - Whether to render as a doughnut chart.
 * @param {Array} [props.colors=[]] - Array of color strings for the chart slices.
 * @param {number} [props.height=320] - Height of the chart container.
 * @returns {JSX.Element}
 */
export default function ChartPie({ data, donut = false, colors = [], height = 320 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    loadChartJs()
      .then((Chart) => {
        if (!mounted || !canvasRef.current) return;
        const labels = (data || []).map((d) => String(d.label || ""));
        const values = (data || []).map((d) => Number(d.value || 0));
        const palette = colors.length ? colors : PALETTE;
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
        const ctx = canvasRef.current.getContext("2d");
        chartRef.current = new Chart(ctx, {
          type: donut ? "doughnut" : "pie",
          data: {
            labels,
            datasets: [
              {
                data: values,
                backgroundColor: labels.map((_, i) => palette[i % palette.length]),
                borderColor: "#fff",
                borderWidth: 2,
                hoverOffset: 8,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: donut ? "50%" : "0%",
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: true,
                backgroundColor: "#1e293b",
                titleFont: { size: 13, weight: "600" },
                bodyFont: { size: 12 },
                padding: 10,
                cornerRadius: 8,
                displayColors: true,
                callbacks: {
                  label: function (ctx) {
                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const val = Number(ctx.raw || 0);
                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                    return ` ${ctx.label}: ${val.toLocaleString()} (${pct}%)`;
                  },
                },
              },
            },
          },
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [JSON.stringify(data), donut, colors.join("|")]);

  return (
    <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
