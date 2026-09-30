import React, { useState, useEffect } from "react";
import banksIcon from "../../assets/banks_ai_icon.png";
import BanksAiModal from "./BanksAiModal.jsx";
import { api } from "../../api/client.js";

export default function BanksAiFloating() {
  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => {
    try {
      const v = localStorage.getItem("omnisuite.banks_ai_enabled");
      if (v !== null) return v === "true";
    } catch {}
    return true;
  });

  useEffect(() => {
    let mounted = true;
    api
      .get("/ai/status")
      .then((res) => {
        if (mounted && res.data?.enabled !== undefined) {
          setEnabled(Boolean(res.data.enabled));
          try {
            localStorage.setItem(
              "omnisuite.banks_ai_enabled",
              String(res.data.enabled),
            );
          } catch {}
        }
      })
      .catch(() => {});

    function onVisibility(e) {
      if (e?.detail?.enabled !== undefined) {
        setEnabled(Boolean(e.detail.enabled));
      }
    }
    window.addEventListener("omni.banks_ai.visibility", onVisibility);
    return () => {
      mounted = false;
      window.removeEventListener("omni.banks_ai.visibility", onVisibility);
    };
  }, []);

  // Global hotkey listener (Alt + B)
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  const handleOpen = () => {
    setIsOpen(true);
  };

  return (
    <>
      <div className="fixed bottom-6 right-24 md:right-[88px] z-50 pointer-events-auto print:hidden">
        <button
          onClick={handleOpen}
          title="Ask Banks (Alt + B)"
          className="relative group flex items-center gap-2.5 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 hover:from-brand-800 hover:to-brand-600 text-white pl-3.5 pr-4 py-2.5 rounded-full shadow-erp-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5 border border-brand-500/30 cursor-pointer select-none"
        >
          {/* Glowing Aura */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-30 group-hover:opacity-75 transition duration-300 pointer-events-none" />

          {/* Banks Icon */}
          <div className="relative flex items-center justify-center">
            <img src={banksIcon} alt="Banks" className="w-5 h-5 object-contain" />
          </div>

          <span className="relative text-xs font-black tracking-wider uppercase text-white drop-shadow-sm flex items-center gap-1">
            Ask Banks
          </span>
        </button>
      </div>

      <BanksAiModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
