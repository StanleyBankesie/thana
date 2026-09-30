import React, { memo } from "react";
import { Handle, Position } from "reactflow";

const NATURE_CONFIG = {
  ASSET: { color: "#10b981" },
  LIABILITY: { color: "#f43f5e" },
  EQUITY: { color: "#6366f1" },
  INCOME: { color: "#3b82f6" },
  EXPENSE: { color: "#f59e0b" },
  DEFAULT: { color: "#94a3b8" },
};

const ChartNode = ({ data, selected, targetPosition, sourcePosition }) => {
  const { label, code, nature, isNature, isAccount, isGroup, highlighted, balance } =
    data;
  const config = NATURE_CONFIG[nature?.toUpperCase()] || NATURE_CONFIG.DEFAULT;

  return (
    <div
      className={`
      relative w-[420px] bg-white rounded-xl shadow-sm border-2 transition-all duration-300
      ${selected || highlighted ? "border-indigo-500 scale-[1.05] shadow-xl z-10" : "border-slate-100"}
      ${highlighted === false ? "opacity-40 grayscale-[0.5]" : "opacity-100"}
    `}
    >
      <Handle
        type="target"
        position={targetPosition || Position.Top}
        className="!w-2 !h-2 !bg-slate-300 !border-none"
      />

      {/* Nature Indicator Bar */}
      <div
        className="h-1.5 w-full rounded-t-lg"
        style={{ backgroundColor: config.color }}
      />

      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[18px] font-bold text-slate-400 uppercase tracking-widest">
            {nature || "General"}
          </div>
          {!isNature && code ? (
            <div className="text-[24px] font-mono font-bold text-slate-700">
              {code}
            </div>
          ) : null}
        </div>

        <h4
          className={`text-[34px] font-extrabold leading-tight mb-2 ${selected || highlighted ? "text-indigo-600" : "text-slate-800"}`}
        >
          {label}
        </h4>

        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
          <div>
            <p className="text-[18px] text-slate-400 uppercase font-bold tracking-tighter m-0">
              {isNature ? "CATEGORY" : isGroup ? "GROUP" : "ACCOUNT"}
            </p>
            {balance !== undefined && (
              <p className={`text-[26px] font-black m-0 ${balance < 0 ? "text-red-500" : "text-emerald-500"}`}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance)}
              </p>
            )}
          </div>
        </div>
      </div>

      {!isAccount && (
        <Handle
          type="source"
          position={sourcePosition || Position.Bottom}
          className="!w-2 !h-2 !bg-slate-300 !border-none"
        />
      )}
    </div>
  );
};

export default memo(ChartNode);
