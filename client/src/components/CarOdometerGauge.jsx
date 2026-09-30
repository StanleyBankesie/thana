import React from "react";

/**
 * CarOdometerGauge component
 * Renders a visual speedometer/odometer style gauge for task completion percentage.
 * Fully proportioned to ensure the entire dial, ticks, needle, and top ODO display box are 100% visible.
 * 
 * @param {Object} props
 * @param {number} props.value - Completion percentage (0 - 100)
 * @param {string} [props.label="Completion Rate"] - Subtitle label below dial
 * @param {string} [props.size="md"] - Size variant: 'sm', 'md', 'lg'
 */
export default function CarOdometerGauge({ value = 0, label = "Task Completion Gauge", size = "md" }) {
  const clampValue = Math.min(100, Math.max(0, Number(value) || 0));
  
  // Dimensions based on size variant with cy offset for perfect card framing
  const sizeMap = {
    sm: { width: 180, height: 140, strokeWidth: 10, r: 55, cy: 105 },
    md: { width: 240, height: 170, strokeWidth: 12, r: 72, cy: 125 },
    lg: { width: 300, height: 210, strokeWidth: 15, r: 90, cy: 155 },
  };

  const config = sizeMap[size] || sizeMap.md;
  const { width, height, strokeWidth, r, cy } = config;
  const cx = width / 2;

  // Arc angles: 220 degree total arc (-200 deg to 20 deg)
  const startAngle = -200;
  const endAngle = 20;
  const totalAngle = endAngle - startAngle;

  // Calculate position on circumference
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  };

  const currentAngle = startAngle + (totalAngle * (clampValue / 100));
  const backgroundArc = describeArc(cx, cy, r, startAngle, endAngle);
  const activeArc = describeArc(cx, cy, r, startAngle, currentAngle);

  // Ticks calculation
  const tickSteps = [0, 20, 40, 60, 80, 100];
  const ticks = tickSteps.map((val) => {
    const angle = startAngle + (totalAngle * (val / 100));
    const p1 = polarToCartesian(cx, cy, r - strokeWidth / 2 - 2, angle);
    const p2 = polarToCartesian(cx, cy, r - strokeWidth / 2 - 7, angle);
    const pText = polarToCartesian(cx, cy, r - strokeWidth / 2 - 16, angle);
    return { val, p1, p2, pText };
  });

  // Needle coordinates
  const needleTip = polarToCartesian(cx, cy, r - strokeWidth / 2 - 4, currentAngle);
  const needleBaseLeft = polarToCartesian(cx, cy, 5, currentAngle - 90);
  const needleBaseRight = polarToCartesian(cx, cy, 5, currentAngle + 90);

  // Dynamic colors based on completion status
  const getGradientColors = () => {
    if (clampValue >= 100) return { stop1: "#10b981", stop2: "#34d399", glow: "rgba(16, 185, 129, 0.4)", text: "text-emerald-400" };
    if (clampValue >= 50) return { stop1: "#3b82f6", stop2: "#60a5fa", glow: "rgba(59, 130, 246, 0.4)", text: "text-blue-400" };
    if (clampValue > 0) return { stop1: "#f59e0b", stop2: "#fbbf24", glow: "rgba(245, 158, 11, 0.4)", text: "text-amber-400" };
    return { stop1: "#64748b", stop2: "#94a3b8", glow: "rgba(100, 116, 139, 0.2)", text: "text-slate-400" };
  };

  const colors = getGradientColors();
  const roundedPercent = Math.round(clampValue);

  return (
    <div className="flex flex-col items-center select-none">
      <div className="relative inline-flex items-center justify-center p-3 bg-slate-900 rounded-3xl border-2 border-slate-800 shadow-2xl overflow-hidden">
        {/* Digital Odometer Readout Box (Positioned cleanly at the TOP of the gauge) */}
        <div className="absolute top-2.5 flex flex-col items-center z-20">
          <div className="bg-black/95 px-3 py-1 rounded-lg border border-slate-700 shadow-inner flex items-center gap-1.5 tracking-wider font-mono">
            <span className="text-[10px] text-amber-500 font-bold tracking-widest">ODO</span>
            <span className={`text-xl font-black ${colors.text} drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]`}>
              {roundedPercent}
            </span>
            <span className="text-xs font-extrabold text-emerald-400">%</span>
          </div>
        </div>

        {/* Background glow effect */}
        <div 
          className="absolute inset-0 rounded-3xl opacity-30 blur-xl pointer-events-none transition-colors duration-500"
          style={{ background: colors.glow }}
        />

        <svg width={width} height={height} className="relative z-10 overflow-visible">
          <defs>
            <linearGradient id={`gauge-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.stop1} />
              <stop offset="100%" stopColor={colors.stop2} />
            </linearGradient>
            <filter id={`needle-glow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#ef4444" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Dial background arc */}
          <path
            d={backgroundArc}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active progress arc */}
          {clampValue > 0 && (
            <path
              d={activeArc}
              fill="none"
              stroke={`url(#gauge-grad-${size})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Ticks and Labels */}
          {ticks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={t.p1.x}
                y1={t.p1.y}
                x2={t.p2.x}
                y2={t.p2.y}
                stroke="#64748b"
                strokeWidth="1.5"
              />
              <text
                x={t.pText.x}
                y={t.pText.y}
                fill="#94a3b8"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {t.val}
              </text>
            </g>
          ))}

          {/* Red Speedometer Needle */}
          <polygon
            points={`${needleTip.x},${needleTip.y} ${needleBaseLeft.x},${needleBaseLeft.y} ${needleBaseRight.x},${needleBaseRight.y}`}
            fill="#ef4444"
            filter={`url(#needle-glow-${size})`}
            className="transition-all duration-700 ease-out"
          />

          {/* Center Pivot Cap */}
          <circle cx={cx} cy={cy} r="7" fill="#0f172a" stroke="#ef4444" strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" />
        </svg>
      </div>

      {label && (
        <span className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
      )}
    </div>
  );
}
