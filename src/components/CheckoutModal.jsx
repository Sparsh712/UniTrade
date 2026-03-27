import React, { useState } from "react";

const CAMPUS_LOCATIONS = [
    "IEC Main Gate",
    "Admin Block Entrance",
    "Library Entrance",
    "Campus Cafeteria",
    "Parking Zone A",
    "Hostel Gate"
];

export default function CheckoutModal({ listing, onClose, onConfirm, accountAddress, balance }) {
    const [loading, setLoading] = useState(false);
    const [pickupLocation, setPickupLocation] = useState(CAMPUS_LOCATIONS[0]);
    const sellerAddress = listing.sellerAddress || listing.seller?.walletAddress || listing.seller;
    const fee = 0.001;
    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
            <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 20, padding: 32, width: "100%", maxWidth: 420, animation: "scaleIn .25s ease" }}>
                <div style={{ fontSize: 52, textAlign: "center", marginBottom: 16 }}>{listing.image}</div>
                <h2 style={{ margin: "0 0 8px", color: "#f9fafb", textAlign: "center", fontSize: 20 }}>{listing.title}</h2>
                <p style={{ margin: "0 0 24px", color: "#6b7280", textAlign: "center", fontSize: 14 }}>{listing.description}</p>

                {/* Pickup Location */}
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 13, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>Select Pickup Location</label>
                    <select
                        value={pickupLocation}
                        onChange={e => setPickupLocation(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "#111827", color: "#f9fafb", outline: "none", fontSize: 14 }}
                    >
                        {CAMPUS_LOCATIONS.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>

                {/* Price breakdown */}
                <div style={{ background: "#111827", borderRadius: 12, padding: 16, marginBottom: 24 }}>
                    {[["Item Price", `${listing.price} ALGO`], ["Network Fee", `~${fee} ALGO`], ["Total", `${(listing.price + fee).toFixed(3)} ALGO`]].map(([k, v], i) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 2 ? "1px solid #1f2937" : "none" }}>
                            <span style={{ color: "#9ca3af", fontSize: 14 }}>{k}</span>
                            <span style={{ color: i === 2 ? "#a5b4fc" : "#f9fafb", fontWeight: i === 2 ? 800 : 500, fontFamily: "'DM Mono', monospace", fontSize: i === 2 ? 16 : 14 }}>{v}</span>
                        </div>
                    ))}
                    {balance !== null && balance !== undefined && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", borderTop: "1px solid #1f2937", marginTop: 4 }}>
                            <span style={{ color: "#9ca3af", fontSize: 14 }}>Your Balance</span>
                            <span style={{ color: balance >= (listing.price + fee) ? "#10b981" : "#ef4444", fontWeight: 700, fontFamily: "'DM Mono', monospace", fontSize: 14 }}>
                                {balance.toFixed(3)} ALGO
                            </span>
                        </div>
                    )}
                    {balance !== null && balance !== undefined && balance < (listing.price + fee) && (
                        <div style={{ background: "#7f1d1d33", border: "1px solid #ef444466", borderRadius: 8, padding: "8px 12px", marginTop: 12, fontSize: 12, color: "#fca5a5", textAlign: "center" }}>
                            ⚠️ Insufficient balance. You need at least {(listing.price + fee).toFixed(3)} ALGO.
                        </div>
                    )}
                </div>

                {/* Algorand badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16, padding: "8px 16px", background: "#064e3b22", border: "1px solid #06543588", borderRadius: 8 }}>
                    <span style={{ fontSize: 14 }}>🌿</span>
                    <span style={{ fontSize: 11, color: "#10b981", fontFamily: "'DM Mono', monospace" }}>Payment releases on Algorand only after OTP verification</span>
                </div>

                <div style={{ fontSize: 12, color: "#4b5563", fontFamily: "'DM Mono', monospace", marginBottom: 20, wordBreak: "break-all" }}>
                    Buyer: {accountAddress}<br />Seller: {sellerAddress}
                </div>

                <div style={{ background: "#1e293b66", border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", marginBottom: 16, fontSize: 11, color: "#cbd5e1" }}>
                    This creates a held order and OTP. Seller verifies OTP at meetup, then buyer releases payment.
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #1f2937", background: "none", color: "#9ca3af", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                    <button onClick={async () => { setLoading(true); await onConfirm(pickupLocation); setLoading(false); }}
                        disabled={loading}
                        style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: loading ? "#374151" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15, transition: "background .2s" }}>
                        {loading ? (
                            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                <span style={{ animation: "pulse 1s infinite" }}>⬡</span> Creating...
                            </span>
                        ) : "Create Held Order"}
                    </button>
                </div>
            </div>
        </div>
    );
}
