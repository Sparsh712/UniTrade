/* eslint-disable react-refresh/only-export-components */
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Toast ──
export function Toast({ message, type, onClose }) {
    useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [onClose]);
    const cls = type === "success" ? "toast toast-success" : type === "error" ? "toast toast-error" : "toast toast-info";
    const icon = type === "success" ? "✓" : type === "error" ? "✗" : "—";
    return (
        <motion.div 
          className={cls}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          style={{
            background: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(12px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            padding: "16px 24px",
            borderRadius: "16px",
            fontSize: "13px",
            fontWeight: 500
          }}
        >
            <span style={{ 
                flexShrink: 0, 
                width: 24, height: 24, 
                borderRadius: "50%", 
                background: type === "success" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                color: type === "success" ? "#10b981" : "#ef4444",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: "bold"
            }}>{icon}</span>
            <span style={{ lineHeight: 1.5, color: "var(--text)" }}>{message}</span>
            <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 20, padding: "0 4px", flexShrink: 0 }}>×</button>
        </motion.div>
    );
}

// ── Badge ──
export function Badge({ text, color }) {
    // Map color to badge class
    const colorMap = {
        "#10b981": "badge-emerald",
        "#00FF94": "badge-emerald",
        "#3b82f6": "badge-gold",
        "#D4AF37": "badge-gold",
        "#f59e0b": "badge-amber",
        "#ef4444": "badge-red",
        "#FF3333": "badge-red",
    };
    const cls = `badge ${colorMap[color] || "badge-muted"}`;
    return <span className={cls}>{text.toUpperCase()}</span>;
}

// ── Truncate ──
export const truncate = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

export const statusColor = {
    pending:              "var(--amber)",
    ready_for_delivery:   "var(--gold)",
    completed:            "var(--emerald)",
    cancelled:            "var(--red)",
    Pending:              "var(--amber)",
    Negotiated:           "var(--gold)",
    Confirmed:            "var(--emerald)",
    Failed:               "var(--red)",
};

export const conditionColor = {
    "Like New":  "var(--emerald)",
    "Excellent": "var(--gold)",
    "Good":      "var(--amber)",
    "Fair":      "var(--red)",
    "Bad":       "var(--red)",
};

// ── Shared Styles (modal forms) ──
export const labelStyle = {
    display: "block",
    color: "var(--text-muted)",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 8,
    fontFamily: "'Inter', sans-serif",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
};

export const inputStyle = {
    width: "100%",
    background: "rgba(0, 0, 0, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    padding: "14px 16px",
    color: "var(--text)",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Inter', sans-serif",
    transition: "all 0.2s cubic-bezier(0.165, 0.84, 0.44, 1)",
};
