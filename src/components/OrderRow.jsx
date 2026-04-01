import React, { useMemo, useState } from "react";
import { Badge, truncate, statusColor } from "./Shared";

const STATUS_LABEL = {
    pending: "PENDING",
    ready_for_delivery: "READY",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
};

function formatStatus(status) {
    if (STATUS_LABEL[status]) return STATUS_LABEL[status];
    return (status || "pending").toUpperCase();
}

function formatExpiry(isoValue) {
    const ms = Date.parse(isoValue || "");
    if (Number.isNaN(ms)) return "N/A";
    return new Date(ms).toLocaleString().toUpperCase();
}

function isPhoto(value) {
    return typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/") || value.startsWith("blob:"));
}

export default function OrderRow({ order, currentUserId, onRate, onVerifyOtp, onRegenerateOtp, onReleasePayment, onCancelOrder, actionLoading, onViewReceipt }) {
    const [otpInput, setOtpInput] = useState("");
    const [otpMessage, setOtpMessage] = useState("");
    const [otpError, setOtpError] = useState("");

    const isBuyer = order.buyerId === currentUserId;
    const isSeller = order.sellerId === currentUserId;
    const loading = Boolean(actionLoading);

    const timeline = useMemo(() => {
        const state = order.status;
        return [
            { key: "pending", done: state === "pending" || state === "ready_for_delivery" || state === "completed" },
            { key: "ready_for_delivery", done: state === "ready_for_delivery" || state === "completed" },
            { key: "completed", done: state === "completed" },
        ];
    }, [order.status]);

    const attemptsLeft = Math.max(0, Number(order.otpMaxAttempts || 5) - Number(order.otpAttempts || 0));

    const handleVerify = async () => {
        if (!otpInput.trim()) {
            setOtpError("ENTER OTP BEFORE SUBMITTING.");
            setOtpMessage("");
            return;
        }

        setOtpError("");
        setOtpMessage("");
        try {
            await onVerifyOtp?.(order.id, otpInput);
            setOtpMessage("OTP VERIFIED. PAYMENT RELEASED.");
            setOtpInput("");
        } catch (error) {
            setOtpError(error.message || "OTP VERIFICATION FAILED.");
        }
    };

    return (
        <div style={{ 
            background: "var(--bg)", 
            borderBottom: "1px solid var(--border)", 
            padding: "24px 0", 
            display: "grid", 
            gridTemplateColumns: "auto 1fr auto auto", 
            gap: 24, 
            alignItems: "start", 
            animation: "fadeIn .3s ease" 
        }}>
            <div style={{ background: "var(--s0)", border: "1px solid var(--border)", width: 72, height: 72, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isPhoto(order.image) ? (
                    <img src={order.image} alt={order.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                    <span style={{ fontSize: 40, padding: "12px 16px" }}>{order.image}</span>
                )}
            </div>
            
            <div>
                <div className="serif" style={{ fontWeight: 800, color: "var(--text)", fontSize: 18, letterSpacing: "-0.01em" }}>{order.title.toUpperCase()}</div>
                
                <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "'Space Mono', monospace", marginTop: 8, display: "flex", flexDirection: "column", gap: 4, letterSpacing: "0.02em" }}>
                    <div>RECEIVER: {truncate(order.receiver)} · {new Date(order.date).toLocaleDateString().toUpperCase()}</div>
                    {order.pickupLocation && <div>PICKUP: {order.pickupLocation.toUpperCase()}</div>}
                    {order.negotiatedPrice > 0 && <div style={{ color: "var(--gold)" }}>NEGOTIATED: {order.negotiatedPrice} ALGO</div>}
                    <div>
                        LEDGER STATUS: <span style={{ color: "var(--text-muted)" }}>{order.paymentStatus === "released" ? "PAYMENT RELEASED" : "PAYMENT HELD ON-CHAIN"}</span>
                    </div>
                </div>

                {order.txId && (
                    <a href={`https://testnet.algoexplorer.io/tx/${order.txId}`} target="_blank" rel="noreferrer"
                        className="btn-text-gold"
                        style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", textDecoration: "none", marginTop: 8, display: "inline-block" }}>
                        VIEW TX: {truncate(order.txId)} ↗
                    </a>
                )}

                {/* Timeline */}
                <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {timeline.map((step) => (
                        <div
                            key={step.key}
                            style={{
                                padding: "4px 10px",
                                fontSize: 9,
                                fontWeight: 700,
                                border: `1px solid ${step.done ? "var(--emerald)" : "var(--border-mid)"}`,
                                color: step.done ? "var(--emerald)" : "var(--text-dim)",
                                background: step.done ? "rgba(0,255,148,0.05)" : "transparent",
                                fontFamily: "'Space Mono', monospace",
                                letterSpacing: "0.08em"
                            }}
                        >
                            {formatStatus(step.key)}
                        </div>
                    ))}
                </div>

                {/* OTP Actions for Buyer */}
                {isBuyer && order.status === "ready_for_delivery" && order.paymentStatus === "held" && (
                    <div style={{ marginTop: 24, background: "var(--s0)", border: "1px solid var(--border)", padding: 20 }}>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 8, fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>LEDGER OTP FOR HANDOVER:</div>
                        <div style={{ fontSize: 32, letterSpacing: 4, fontWeight: 800, color: "var(--gold)", fontFamily: "'Space Mono', monospace" }}>
                            {order.buyerOtp || "SYNCING..."}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 8, fontFamily: "'Space Mono', monospace" }}>EXPIRES: {formatExpiry(order.otpExpiresAt)}</div>
                        
                        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                            <button
                                onClick={() => onRegenerateOtp?.(order.id)}
                                disabled={loading || order.otpVerified}
                                className="btn-outline"
                                style={{ padding: "8px 16px", fontSize: 10, opacity: order.otpVerified ? 0.4 : 1 }}
                            >
                                REGENERATE OTP
                            </button>
                            
                            {order.otpVerified && (
                                <button
                                    onClick={() => onReleasePayment?.(order.id)}
                                    disabled={loading}
                                    className="btn-gold"
                                    style={{ padding: "8px 20px", fontSize: 10 }}
                                >
                                    RELEASE ON-CHAIN PAYMENT
                                </button>
                            )}
                        </div>

                        {order.otpVerified && (
                            <div style={{ marginTop: 12, fontSize: 10, color: "var(--emerald)", fontFamily: "'Space Mono', monospace" }}>
                                SELLER VERIFIED OTP. PROCEED TO COMPLETION.
                            </div>
                        )}
                    </div>
                )}

                {/* OTP Verification for Seller */}
                {isSeller && order.status === "ready_for_delivery" && !order.otpVerified && (
                    <div style={{ marginTop: 24, background: "var(--s0)", border: "1px solid var(--border)", padding: 20 }}>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 12, fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>
                            ENTER BUYER OTP TO VALIDATE HANDOVER. ATTEMPTS LEFT: {attemptsLeft}
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                            <input
                                value={otpInput}
                                onChange={(event) => setOtpInput(event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                                placeholder="000 000"
                                className="input-box"
                                style={{
                                    width: 140,
                                    padding: "10px 14px",
                                    fontSize: 14,
                                    textAlign: "center",
                                    letterSpacing: 2
                                }}
                            />
                            <button
                                onClick={handleVerify}
                                disabled={loading}
                                className="btn-gold"
                                style={{ padding: "0 24px", fontSize: 10 }}
                            >
                                VERIFY OTP
                            </button>
                        </div>
                        <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 12, fontFamily: "'Space Mono', monospace" }}>EXPIRES: {formatExpiry(order.otpExpiresAt)}</div>
                        {otpError && <div style={{ marginTop: 12, fontSize: 10, color: "var(--red)", fontFamily: "'Space Mono', monospace" }}>{otpError}</div>}
                        {otpMessage && <div style={{ marginTop: 12, fontSize: 10, color: "var(--emerald)", fontFamily: "'Space Mono', monospace" }}>{otpMessage}</div>}
                    </div>
                )}

                {isSeller && order.status === "ready_for_delivery" && order.otpVerified && order.paymentStatus === "held" && (
                    <div style={{ marginTop: 24, background: "rgba(0,255,148,0.05)", border: "1px solid var(--emerald)", padding: 20 }}>
                        <div style={{ fontSize: 11, color: "var(--emerald)", fontWeight: 700 }}>OTP VERIFIED SUCCESSFULLY.</div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8, fontFamily: "'Space Mono', monospace" }}>
                            WAITING FOR BUYER TO FINALIZE ON-CHAIN RELEASE.
                        </div>
                    </div>
                )}

                {/* Receipt Actions */}
                {(order.status === "completed" || order.paymentStatus === "released") && (
                    <div style={{ marginTop: 20 }}>
                        <button
                            onClick={() => onViewReceipt?.(order)}
                            className="btn-outline"
                            style={{ padding: "8px 16px", fontSize: 10, letterSpacing: "0.1em" }}
                        >
                            🧾 VIEW LEDGER RECEIPT
                        </button>
                    </div>
                )}

                {/* Rating */}
                {order.status === "completed" && !order.rated && (
                    <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <button key={star} onClick={() => onRate?.(order.id, star)}
                                    className="btn-text-gold"
                                    style={{ fontSize: 20, padding: 0 }}
                                >
                                    ☆
                                </button>
                            ))}
                        </div>
                        <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>RATE EXPERIENCE</span>
                    </div>
                )}
                {order.rated && (
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--gold)", fontFamily: "'Space Mono', monospace" }}>
                        {"★".repeat(order.rating)}{"☆".repeat(5 - order.rating)} <span style={{ color: "var(--text-dim)", marginLeft: 8 }}>Voucher Logged</span>
                    </div>
                )}

                {/* Cancel Action */}
                {(order.status === "pending" || (order.status === "ready_for_delivery" && !order.otpVerified)) && (
                    <div style={{ marginTop: 20 }}>
                        <button
                            onClick={() => onCancelOrder?.(order.id)}
                            disabled={loading}
                            className="btn-text-gold"
                            style={{ color: "var(--red)", fontSize: 10, opacity: 0.7 }}
                        >
                            CANCEL ORDER REQUEST
                        </button>
                    </div>
                )}
            </div>

            <div style={{ fontWeight: 800, color: "var(--text)", fontFamily: "'Space Mono', monospace", textAlign: "right", fontSize: 18 }}>
                {Number(order.price || order.finalPrice || order.amount || 0).toFixed(2)} <span style={{ fontSize: 12, color: "var(--gold-muted)" }}>ALGO</span>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, fontWeight: 400 }}>≈ ₹{(Number(order.price || order.finalPrice || order.amount || 0) * 15).toLocaleString("en-IN")} INR</div>
            </div>
            
            <div style={{ textAlign: "right" }}>
                <div style={{ 
                    fontSize: 10, 
                    fontWeight: 800, 
                    color: statusColor[order.status] || "var(--text-dim)", 
                    fontFamily: "'Space Mono', monospace",
                    letterSpacing: "0.1em",
                    border: `1px solid ${statusColor[order.status] || "var(--border)"}`,
                    padding: "4px 12px"
                }}>
                    {formatStatus(order.status)}
                </div>
            </div>
        </div>
    );
}
