/**
 * @fileoverview FloatingChat component.
 * Displays a floating chat button with unread badge and handles opening the ChatModal.
 */

import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import useSocket from "../../hooks/useSocket";
import ChatModal from "./ChatModal.jsx";
import { useAuth } from "../../auth/AuthContext";

/**
 * FloatingChat component
 * @returns {JSX.Element}
 */
export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const socket = useSocket();
  const { user } = useAuth();
  const [lastSent, setLastSent] = useState({}); // { [conversation_id]: timestamp }
  const SENT_TTL_MS = 12000;
  /**
   * Plays a notification tone for new messages.
   */
  function playChatTone() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext || null;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      o.connect(g).connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.frequency.setValueAtTime(660, ctx.currentTime);
      }, 150);
      setTimeout(() => {
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.01);
        o.stop();
        ctx.close();
      }, 700);
    } catch {}
  }

  /**
   * Loads the total unread message count from the server.
   */
  const loadUnread = async () => {
    try {
      const res = await api.get("/chat/unread-count");
      setUnread(Number(res?.data?.unread || 0));
    } catch {
      setUnread(0);
    }
  };
  useEffect(() => {
    loadUnread();
  }, []);
  useEffect(() => {
    function onOpenFromPush() {
      try {
        setOpen(true);
      } catch {}
    }
    window.addEventListener("omni.chat.open", onOpenFromPush);
    return () => window.removeEventListener("omni.chat.open", onOpenFromPush);
  }, []);
  useEffect(() => {
    function onSent(e) {
      try {
        const cid = Number(e?.detail?.conversation_id || 0);
        if (!Number.isFinite(cid) || cid <= 0) return;
        setLastSent((prev) => ({ ...prev, [cid]: Date.now() }));
      } catch {}
    }
    window.addEventListener("omni.chat.sent", onSent);
    return () => window.removeEventListener("omni.chat.sent", onSent);
  }, []);
  useEffect(() => {
    const t = setInterval(() => {
      setLastSent((prev) => {
        const now = Date.now();
        const next = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          if (now - v < SENT_TTL_MS) {
            next[k] = v;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    function onRefresh() {
      loadUnread();
    }
    window.addEventListener("omni.chat.unread.refresh", onRefresh);
    return () =>
      window.removeEventListener("omni.chat.unread.refresh", onRefresh);
  }, []);
  useEffect(() => {
    if (!socket) return;
    const onReceive = (m) => {
      try {
        const uid = Number(user?.sub || user?.id) || 0;
        const senderId = Number(m?.sender_id || 0);
        // If I am the sender, don't reload unread or play tone
        if (uid && senderId && uid === senderId) return;
        const cid = Number(m?.conversation_id || 0);
        if (Number.isFinite(cid) && cid > 0) {
          const ts = lastSent[cid];
          if (ts && Date.now() - ts < SENT_TTL_MS) {
            return;
          }
        }
      } catch {}
      loadUnread();
      try {
        const hidden =
          typeof document !== "undefined" &&
          document.visibilityState !== "visible";
        if (!open || hidden) playChatTone();
      } catch {}
    };
    socket.on("receive_message", onReceive);
    socket.on("message_delivered", onReceive);
    socket.on("message_read", onReceive);
    return () => {
      socket.off("receive_message", onReceive);
      socket.off("message_delivered", onReceive);
      socket.off("message_read", onReceive);
    };
  }, [socket, user?.sub, user?.id, open, lastSent]);

  const badge = useMemo(() => {
    if (!unread) return null;
    return (
      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5 py-[2px] shadow">
        {unread > 99 ? "99+" : unread}
      </span>
    );
  }, [unread]);

  return (
    <>
      <button
        type="button"
        aria-label="Open chat"
        onClick={() => setOpen(true)}
        data-rbac-exempt="true"
        className="fixed z-[9999] md:right-6 md:bottom-6 w-12 h-12 rounded-full shadow-xl text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        style={{
          backgroundColor: "#12543B",
          right: 16,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10.5" stroke="white" strokeWidth="1.5" />
          <g transform="translate(9, 5) scale(0.4)">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white" />
          </g>
          <g transform="translate(5.5, 8) scale(0.45)">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#12543B" stroke="#12543B" strokeWidth="4" strokeLinejoin="round" />
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white" />
          </g>
        </svg>
        {badge}
      </button>
      {open && <ChatModal onClose={() => setOpen(false)} />}
    </>
  );
}
