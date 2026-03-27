import React, { useMemo, useState } from "react";
import { Badge, truncate, statusColor } from "./Shared";

const STATUS_LABEL = {
    pending: "Pending",
    ready_for_delivery: "Ready",
    completed: "Completed",
    cancelled: "Cancelled",
};

function formatStatus(status) {
    if (STATUS_LABEL[status]) return STATUS_LABEL[status];
    return status || "pending";
}

function formatExpiry(isoValue) {
    const ms = Date.parse(isoValue || "");
    if (Number.isNaN(ms)) return "N/A";
    return new Date(ms).toLocaleString();
}

export default function OrderRow({ order, currentUserId, onRate, onVerifyOtp, onRegenerateOtp, onReleasePayment, onCancelOrder, actionLoading }) {
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
            setOtpError("Enter OTP before submitting.");
            setOtpMessage("");
            return;
        }

        setOtpError("");
        setOtpMessage("");
        try {
            await onVerifyOtp?.(order.id, otpInput);
            setOtpMessage("OTP verified. Payment released.");
            setOtpInput("");
        } catch (error) {
            setOtpError(error.message || "OTP verification failed.");
        }
    };

    return (
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: "14px 18px", display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 16, alignItems: "center", animation: "fadeIn .3s ease" }}>
            <div style={{ fontSize: 28 }}>{order.image}</div>
            <div>
                <div style={{ fontWeight: 700, color: "#f9fafb", fontSize: 15 }}>{order.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                    To: {truncate(order.receiver)} · {new Date(order.date).toLocaleDateString()}
                    {order.pickupLocation && <div>Pickup: {order.pickupLocation}</div>}
                    {order.negotiatedPrice > 0 && <div>Negotiated: {order.negotiatedPrice} ALGO</div>}
                    <div>Payment: {order.paymentStatus === "released" ? "Released" : "Held"}</div>
                </div>
                {order.txId && (
                    <a href={`https://testnet.algoexplorer.io/tx/${order.txId}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: "#6366f1", fontFamily: "'DM Mono', monospace", textDecoration: "none" }}>
                        {truncate(order.txId)} ↗
                    </a>
                )}

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {timeline.map((step) => (
                        <span
                            key={step.key}
                            style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                fontSize: 10,
                                fontWeight: 700,
                                border: `1px solid ${step.done ? "#10b98166" : "#374151"}`,
                                color: step.done ? "#10b981" : "#6b7280",
                                background: step.done ? "#10b9811a" : "transparent",
                                fontFamily: "'DM Mono', monospace",
                            }}
                        >
                            {formatStatus(step.key)}
                        </span>
                    ))}
                </div>

                {isBuyer && order.status === "ready_for_delivery" && order.paymentStatus === "held" && (
                    <div style={{ marginTop: 10, background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Share this OTP with seller at handover:</div>
                        <div style={{ fontSize: 24, letterSpacing: 2, fontWeight: 800, color: "#f9fafb", fontFamily: "'DM Mono', monospace" }}>
                            {order.buyerOtp || "Generating..."}
                        </div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Expires: {formatExpiry(order.otpExpiresAt)}</div>
                        <div style={{ marginTop: 8 }}>
                            <button
                                onClick={() => onRegenerateOtp?.(order.id)}
                                disabled={loading || order.otpVerified}
                                style={{
                                    background: "#1d4ed8",
                                    border: "none",
                                    color: "#fff",
                                    borderRadius: 6,
                                    padding: "6px 10px",
                                    fontSize: 12,
                                    cursor: loading || order.otpVerified ? "not-allowed" : "pointer",
                                    opacity: order.otpVerified ? 0.6 : 1,
                                }}
                            >
                                Regenerate OTP
                            </button>
                        </div>

                        {order.otpVerified && (
                            <div style={{ marginTop: 8, fontSize: 11, color: "#34d399" }}>
                                Seller verified OTP. Release payment to complete this order.
                            </div>
                        )}

                        {order.otpVerified && (
                            <div style={{ marginTop: 8 }}>
                                <button
                                    onClick={() => onReleasePayment?.(order.id)}
                                    disabled={loading}
                                    style={{
                                        background: "#10b981",
                                        border: "none",
                                        color: "#052e16",
                                        borderRadius: 6,
                                        padding: "7px 12px",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: loading ? "not-allowed" : "pointer",
                                    }}
                                >
                                    Release Payment
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {isSeller && order.status === "ready_for_delivery" && !order.otpVerified && (
                    <div style={{ marginTop: 10, background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
                            Enter buyer OTP to release held payment. Attempts left: {attemptsLeft}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <input
                                value={otpInput}
                                onChange={(event) => setOtpInput(event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                                placeholder="4-6 digit OTP"
                                style={{
                                    flex: "1 1 130px",
                                    background: "#111827",
                                    border: "1px solid #374151",
                                    borderRadius: 6,
                                    padding: "7px 10px",
                                    color: "#fff",
                                    fontFamily: "'DM Mono', monospace",
                                }}
                            />
                            <button
                                onClick={handleVerify}
                                disabled={loading}
                                style={{
                                    background: "#10b981",
                                    border: "none",
                                    color: "#052e16",
                                    borderRadius: 6,
                                    padding: "7px 12px",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: loading ? "not-allowed" : "pointer",
                                }}
                            >
                                Verify OTP
                            </button>
                        </div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Expires: {formatExpiry(order.otpExpiresAt)}</div>
                        {otpError && <div style={{ marginTop: 6, fontSize: 11, color: "#f87171" }}>{otpError}</div>}
                        {otpMessage && <div style={{ marginTop: 6, fontSize: 11, color: "#34d399" }}>{otpMessage}</div>}
                    </div>
                )}

                {isSeller && order.status === "ready_for_delivery" && order.otpVerified && order.paymentStatus === "held" && (
                    <div style={{ marginTop: 10, background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11, color: "#34d399" }}>OTP verified successfully.</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Waiting for buyer to release payment.</div>
                    </div>
                )}

                {/* Rating */}
                {order.status === "completed" && !order.rated && (
                    <div style={{ marginTop: 6, display: "flex", gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(star => (
                            <button key={star} onClick={() => onRate?.(order.id, star)}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, transition: "transform .15s" }}
                                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.3)"}
                                onMouseLeave={e => e.currentTarget.style.transform = ""}>
                                ☆
                            </button>
                        ))}
                        <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 6, lineHeight: "20px" }}>Rate this</span>
                    </div>
                )}
                {order.rated && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "#f59e0b" }}>
                        {"★".repeat(order.rating)}{"☆".repeat(5 - order.rating)} <span style={{ color: "#6b7280" }}>Rated</span>
                    </div>
                )}

                {(order.status === "pending" || (order.status === "ready_for_delivery" && !order.otpVerified)) && (
                    <div style={{ marginTop: 8 }}>
                        <button
                            onClick={() => onCancelOrder?.(order.id)}
                            disabled={loading}
                            style={{
                                background: "transparent",
                                border: "1px solid #7f1d1d",
                                color: "#fca5a5",
                                borderRadius: 6,
                                padding: "6px 10px",
                                fontSize: 11,
                                cursor: loading ? "not-allowed" : "pointer",
                            }}
                        >
                            Cancel Order
                        </button>
                    </div>
                )}
            </div>
            <div style={{ fontWeight: 700, color: "#a5b4fc", fontFamily: "'DM Mono', monospace", textAlign: "right" }}>
                {Number(order.price || order.finalPrice || order.amount || 0).toFixed(3)} ALGO
            </div>
            <div>
                <Badge text={formatStatus(order.status)} color={statusColor[order.status] || "#9ca3af"} />
            </div>
        </div>
    );
}
