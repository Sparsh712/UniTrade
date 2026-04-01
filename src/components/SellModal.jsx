import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { labelStyle } from "./Shared";
import { requestListingSuggestion, toAiImagePayload } from "../services/listingAiService";

const CATEGORIES = ["Books", "Electronics", "Clothing", "Furniture", "Misc"];

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

function isUrlLike(value) {
    if (typeof value !== "string") return false;
    const v = value.trim().toLowerCase();
    return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("blob:") || v.startsWith("data:");
}

/** Compresses an image in the browser to ≤800px, JPEG 0.75 — reduces size aggressively for light base64 storage */
async function compressImageFile(file, maxDim = 800, quality = 0.75) {
    return new Promise((resolve) => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            // Skip if already small enough
            if (w <= maxDim && h <= maxDim && file.size < 250_000) {
                URL.revokeObjectURL(url);
                resolve(file);
                return;
            }
            const scale = Math.min(1, maxDim / Math.max(w, h));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(
                (blob) => {
                    if (!blob) { resolve(file); return; }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
                },
                "image/jpeg",
                quality
            );
        };

        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

export default function SellModal({ onClose, onList, accountAddress }) {
    const [form, setForm] = useState({ title: "", category: "Books", price: "", description: "", condition: "Good", image: "" });
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState("");
    const [aiSuggestionAlgo, setAiSuggestionAlgo] = useState("");
    const [aiSuggestionInr, setAiSuggestionInr] = useState("");
    const [aiPriceJudgement, setAiPriceJudgement] = useState("");
    const [aiAlgoInrRate, setAiAlgoInrRate] = useState(0);
    const [analyzingImage, setAnalyzingImage] = useState(false);
    const [aiError, setAiError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        return () => {
            if (imagePreviewUrl) {
                URL.revokeObjectURL(imagePreviewUrl);
            }
        };
    }, [imagePreviewUrl]);

    const handleImageSelection = (event) => {
        const file = event.target.files?.[0] || null;
        setAiError("");
        setAiSuggestionAlgo("");
        setAiSuggestionInr("");
        setAiPriceJudgement("");
        setAiAlgoInrRate(0);

        if (!file) {
            setSelectedImageFile(null);
            if (imagePreviewUrl) {
                URL.revokeObjectURL(imagePreviewUrl);
            }
            setImagePreviewUrl("");
            return;
        }

        const preview = URL.createObjectURL(file);
        setSelectedImageFile(file);
        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
        }
        setImagePreviewUrl(preview);
    };

    const extractSuggestedPrice = (estimatedPriceAlgo) => {
        const matches = estimatedPriceAlgo.match(/\d+(?:\.\d+)?/g);
        if (!matches?.length) return "";
        if (matches.length === 1) return Number(matches[0]).toFixed(2);

        const values = matches.slice(0, 2).map(Number).filter((value) => Number.isFinite(value));
        if (!values.length) return "";

        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        return average.toFixed(2);
    };

    const handleAnalyzeImage = async () => {
        setError("");
        setAiError("");

        if (!selectedImageFile) {
            setAiError("TERMINAL: UPLOAD IMAGE FOR ANALYTICS.");
            return;
        }

        setAnalyzingImage(true);

        try {
            const imagePayload = await toAiImagePayload(selectedImageFile);
            const suggestion = await requestListingSuggestion({
                ...imagePayload,
                listedCondition: form.condition,
            });
            const suggestedTitle = isUrlLike(suggestion.title) ? "" : suggestion.title;
            const fallbackTitle = form.title || suggestedTitle;
            const suggestedPrice = extractSuggestedPrice(suggestion.estimatedPrice);

            setForm((current) => ({
                ...current,
                title: fallbackTitle,
                description: suggestion.description || current.description,
                price: current.price || suggestedPrice,
            }));
            setAiSuggestionAlgo(suggestion.estimatedPrice);
            setAiSuggestionInr(suggestion.estimatedPriceInr);
            setAiPriceJudgement(suggestion.priceJudgement);
            setAiAlgoInrRate(suggestion.algoInrRate);
        } catch (analysisError) {
            setAiError(analysisError?.message || "AI ANALYSIS FAILED. MANUAL ENTRY ENABLED.");
        } finally {
            setAnalyzingImage(false);
        }
    };

    const handleSubmit = async () => {
        if (!form.title || !form.price || !form.description) {
            setError("ALL FIELDS ARE MANDATORY FOR LEDGER ENTRY.");
            return;
        }

        if (!selectedImageFile) {
            setError("UPLOAD ITEM PHOTO BEFORE PUBLISHING.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            // Step 1: compress the image in-browser before uploading
            setSubmitStatus("COMPRESSING IMAGE...");
            let photoFile = selectedImageFile;
            try {
                photoFile = await compressImageFile(selectedImageFile);
            } catch {
                // use original if compression unexpectedly fails
            }

            // Step 2: upload to Firebase Storage + write Firestore doc
            setSubmitStatus("UPLOADING TO LEDGER...");
            await withTimeout(
                onList({ ...form, price: parseFloat(form.price), sellerAddress: accountAddress, photoFile, image: imagePreviewUrl }),
                90000,
                "UPLOAD TIMED OUT. CHECK YOUR NETWORK AND TRY AGAIN."
            );
            onClose();
        } catch (submitError) {
            setError(submitError?.message || "TRANSACTION FAILED. RETRY.");
        } finally {
            setSubmitting(false);
            setSubmitStatus("");
        }
    };

    return (
        <motion.div
          className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
            <motion.div
              className="modal-panel"
              style={{ maxWidth: 520, padding: "40px 32px", maxHeight: "90vh", overflowY: "auto" }}
              initial={{ scale: 0.85, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 22, stiffness: 280 }}
            >
                <h2 className="serif" style={{ margin: "0 0 32px", color: "var(--text)", fontSize: 24, fontWeight: 800 }}>📦 NEW LISTING.</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    
                    {/* Media Upload */}
                    <div style={{ background: "rgba(15, 23, 42, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", padding: 24, borderRadius: 16 }}>
                        <label style={{ ...labelStyle, display: "block", marginBottom: 12 }}>AI IMAGE ANALYSIS</label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelection}
                                className="input-box"
                                style={{ padding: "12px 14px", fontSize: 13 }}
                            />
                            {imagePreviewUrl && (
                                <img
                                    src={imagePreviewUrl}
                                    alt="Preview"
                                    style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 12, border: "1px solid rgba(255, 255, 255, 0.1)" }}
                                />
                            )}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleAnalyzeImage}
                                disabled={!selectedImageFile || analyzingImage}
                                className="btn-outline"
                                style={{ width: "100%", padding: "14px", background: analyzingImage ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)", fontSize: 12, fontWeight: 600 }}
                            >
                                {analyzingImage ? "ANALYZING..." : "GENERATE AI METADATA →"}
                            </motion.button>
                        </div>
                    </div>

                    {/* Fields */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <label style={labelStyle}>ASSET TITLE *</label>
                        <input className="input-box" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. TEXTBOOK, CALCULATOR" />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <label style={labelStyle}>CATEGORY</label>
                            <select className="input-box" style={{ width: "100%", padding: "14px" }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                {CATEGORIES.map(c => <option key={c} style={{ background: "#1e293b" }}>{c.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <label style={labelStyle}>CONDITION</label>
                            <select className="input-box" style={{ width: "100%", padding: "14px" }} value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                                {["Like New", "Excellent", "Good", "Fair"].map(c => <option key={c} style={{ background: "#1e293b" }}>{c.toUpperCase()}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <label style={labelStyle}>LISTING PRICE (ALGO) *</label>
                        <input className="input-box" type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
                        
                        {aiSuggestionAlgo && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12, padding: 12, background: "rgba(212,175,55,0.05)", borderLeft: "2px solid var(--gold)", borderRadius: 8 }}>
                                <div style={{ color: "var(--gold)", fontSize: 10, fontFamily: "'Space Mono', monospace" }}>AI ESTIMATE: {aiSuggestionAlgo} ALGO</div>
                                {aiSuggestionInr && <div style={{ color: "var(--text-dim)", fontSize: 10, fontFamily: "'Space Mono', monospace" }}>REFERENCE: {aiSuggestionInr}{aiAlgoInrRate ? ` (1 ALGO ≈ ₹${aiAlgoInrRate})` : ""}</div>}
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <label style={labelStyle}>DESCRIPTION *</label>
                        <textarea className="input-box" style={{ height: 100, resize: "none" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="SPECIFICATIONS, CONDITION DETAILS..." />
                    </div>

                    {/* AI Judgement / Error */}
                    {aiPriceJudgement && (
                        <div style={{ border: "1px solid var(--emerald)", padding: "12px 16px", fontSize: 10, color: "var(--emerald)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>
                            TERMINAL: {aiPriceJudgement}
                        </div>
                    )}
                    
                    {aiError && (
                        <div style={{ border: "1px solid var(--gold-dim)", padding: "12px 16px", fontSize: 10, color: "var(--text-dim)", fontFamily: "'Space Mono', monospace" }}>
                            {aiError}
                        </div>
                    )}

                    {error && (
                        <div style={{ border: "1px solid var(--red)", padding: "12px 16px", fontSize: 10, color: "var(--red)", fontFamily: "'Space Mono', monospace" }}>
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                        <button onClick={onClose} disabled={submitting} className="btn-text-gold" style={{ flex: 1, fontSize: 11 }}>CANCEL</button>
                        <button onClick={handleSubmit} disabled={submitting} className="btn-gold" style={{ flex: 2, padding: "14px 0", fontSize: 11 }}>
                            {submitting ? (submitStatus || "SYNCING...") : "PUBLISH TO LEDGER →"}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
