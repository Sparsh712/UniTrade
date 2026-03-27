import React, { useState } from "react";
import { labelStyle, inputStyle } from "./Shared";

const CATEGORIES = ["Books", "Electronics", "Clothing", "Furniture", "Misc"];
const emojis = ["📦", "📘", "📗", "📙", "🖩", "⌨️", "🖥️", "📱", "🔌", "🪑", "👕", "👟", "🎮", "🎸", "🎒"];

function withTimeout(promise, timeoutMs, timeoutMessage) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        promise
            .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

export default function SellModal({ onClose, onList, accountAddress }) {
    const [form, setForm] = useState({ title: "", category: "Books", price: "", description: "", condition: "Good", image: "📦" });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        if (!form.title || !form.price || !form.description) {
            setError("Please complete all required fields.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await withTimeout(
                onList({ ...form, price: parseFloat(form.price), sellerAddress: accountAddress }),
                15000,
                "Listing is taking too long. Check Firebase Auth/Firestore rules and retry."
            );
            onClose();
        } catch (submitError) {
            setError(submitError?.message || "Could not publish your listing. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", animation: "scaleIn .25s ease" }}>
                <h2 style={{ margin: "0 0 24px", color: "#f9fafb", fontSize: 20, fontWeight: 800 }}>📦 List an Item</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                        <label style={labelStyle}>Pick an Icon</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {emojis.map(e => (
                                <button key={e} onClick={() => setForm(f => ({ ...f, image: e }))}
                                    style={{ fontSize: 22, padding: "6px 10px", borderRadius: 8, border: `2px solid ${form.image === e ? "#6366f1" : "#1f2937"}`, background: form.image === e ? "#6366f122" : "#111827", cursor: "pointer", transition: "all .15s" }}>{e}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Title *</label>
                        <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Calculus Textbook" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                            <label style={labelStyle}>Category</label>
                            <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Condition</label>
                            <select style={inputStyle} value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                                {["Like New", "Excellent", "Good", "Fair"].map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Price (ALGO) *</label>
                        <input style={inputStyle} type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div>
                        <label style={labelStyle}>Description *</label>
                        <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe condition, edition, accessories..." />
                    </div>
                    {error && (
                        <div style={{ background: "#7f1d1d33", border: "1px solid #ef444466", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#fca5a5" }}>
                            {error}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 12 }}>
                        <button onClick={onClose} disabled={submitting} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #1f2937", background: "none", color: "#9ca3af", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                        <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: submitting ? "#374151" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: submitting ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15 }}>
                            {submitting ? "Listing..." : "List Item"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
