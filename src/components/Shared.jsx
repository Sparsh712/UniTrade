/* eslint-disable react-refresh/only-export-components */
import React, { useEffect } from "react";

// ── Toast ──
export function Toast({ message, type, onClose }) {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
    const bg = type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6";
    return (
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999, background: bg, color: "#fff", borderRadius: 12, padding: "14px 22px", fontFamily: "'DM Mono', monospace", fontSize: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", gap: 10, maxWidth: 360, animation: "slideUp .3s ease" }}>
            <span>{type === "success" ? "✓" : type === "error" ? "✗" : "ℹ"}</span>
            <span>{message}</span>
            <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
    );
}

// ── Badge ──
export function Badge({ text, color }) {
    return <span style={{ background: color + "22", color, border: `1px solid ${color}55`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{text}</span>;
}

// ── Truncate ──
export const truncate = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
export const statusColor = {
    pending: "#f59e0b",
    ready_for_delivery: "#3b82f6",
    completed: "#10b981",
    cancelled: "#ef4444",
    Pending: "#f59e0b",
    Negotiated: "#3b82f6",
    Confirmed: "#10b981",
    Failed: "#ef4444"
};
export const conditionColor = { "Like New": "#10b981", "Excellent": "#3b82f6", "Good": "#f59e0b", "Fair": "#ef4444" };

// ── Shared Styles ──
export const labelStyle = { display: "block", color: "#9ca3af", fontSize: 12, fontWeight: 600, marginBottom: 6, fontFamily: "'DM Mono', monospace" };
export const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 12px", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
