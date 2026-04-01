import React, { useState } from "react";
import { motion } from "framer-motion";
import { labelStyle, truncate } from "./Shared";

const CAMPUS_LOCATIONS = [
    "IEC Main Gate",
    "Admin Block Entrance",
    "Library Entrance",
    "Campus Cafeteria",
    "Parking Zone A",
    "Hostel Gate"
];

function isPhoto(value) {
    return typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/") || value.startsWith("blob:"));
}

export default function CheckoutModal({ listing, onClose, onConfirm, accountAddress, balance }) {
    const [loading, setLoading] = useState(false);
    const [pickupLocation, setPickupLocation] = useState(CAMPUS_LOCATIONS[0]);
    const sellerAddress = listing.sellerAddress || listing.seller?.walletAddress || listing.seller;
    const fee = 0.001;
    return (
        <motion.div
          className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && !loading && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
            <motion.div
              className="modal-panel"
              style={{ maxWidth: 440, padding: 40 }}
              initial={{ scale: 0.85, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 22, stiffness: 280 }}
            >
                {isPhoto(listing.image) ? (
                    <div style={{ width: "100%", height: 180, marginBottom: 24, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                        <img src={listing.image} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                ) : (
                    <div style={{ fontSize: 64, textAlign: "center", marginBottom: 24, animation: "float 4s ease-in-out infinite" }}>{listing.image}</div>
                )}
                <h2 className="serif" style={{ margin: "0 0 12px", color: "var(--text)", textAlign: "center", fontSize: "clamp(20px, 4vw, 24px)", fontWeight: 800 }}>{listing.title.toUpperCase()}</h2>
                <p style={{ margin: "0 0 32px", color: "var(--text-muted)", textAlign: "center", fontSize: 13, lineHeight: 1.6 }}>{listing.description}</p>

                {/* Pickup Location */}
                <div style={{ marginBottom: 24 }}>
                    <label style={labelStyle}>PICKUP LOCATION</label>
                    <select
                        value={pickupLocation}
                        onChange={e => setPickupLocation(e.target.value)}
                        className="input-box"
                        style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--border-mid)", background: "var(--s1)", color: "var(--text)", outline: "none", fontSize: 13, fontFamily: "'Space Mono', monospace" }}
                    >
                        {CAMPUS_LOCATIONS.map(loc => (
                            <option key={loc} value={loc}>{loc.toUpperCase()}</option>
                        ))}
                    </select>
                </div>

                {/* Price breakdown */}
                <div style={{ background: "var(--s0)", border: "1px solid var(--border)", padding: 20, marginBottom: 24 }}>
                    {[["ITEM PRICE", `${listing.price} ALGO`], ["NETWORK FEE", `~${fee} ALGO`], ["TOTAL", `${(listing.price + fee).toFixed(3)} ALGO`]].map(([k, v], i) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                            <span style={{ color: "var(--text-dim)", fontSize: 11, fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em" }}>{k}</span>
                            <span style={{ color: i === 2 ? "var(--gold)" : "var(--text)", fontWeight: i === 2 ? 800 : 500, fontFamily: "'Space Mono', monospace", fontSize: i === 2 ? 18 : 14 }}>{v}</span>
                        </div>
                    ))}
                    {balance !== null && balance !== undefined && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", borderTop: "1px solid var(--border)", marginTop: 8 }}>
                            <span style={{ color: "var(--text-dim)", fontSize: 11, fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em" }}>BALANCE</span>
                            <span style={{ color: balance >= (listing.price + fee) ? "var(--emerald)" : "var(--red)", fontWeight: 700, fontFamily: "'Space Mono', monospace", fontSize: 14 }}>
                                {balance.toFixed(3)} ALGO
                            </span>
                        </div>
                    )}
                    {balance !== null && balance !== undefined && balance < (listing.price + fee) && (
                        <div style={{ border: "1px solid var(--red)", padding: "10px 14px", marginTop: 16, fontSize: 11, color: "var(--red)", textAlign: "center", fontFamily: "'Space Mono', monospace" }}>
                            ⚠️ INSUFFICIENT BALANCE. MIN NEEDED: {(listing.price + fee).toFixed(3)} ALGO.
                        </div>
                    )}
                </div>

                {/* Algorand badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24, padding: "10px 16px", border: "1px solid rgba(0,255,148,0.15)", background: "rgba(0,255,148,0.05)" }}>
                    <span style={{ fontSize: 14 }}>🌿</span>
                    <span style={{ fontSize: 10, color: "var(--emerald)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.04em" }}>PAYMENT RELEASES AFTER MEETUP OTP VERIFICATION.</span>
                </div>

                <div style={{ marginBottom: 32 }}>
                   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div className="stat-box" style={{ padding: "12px 14px" }}>
                        <span className="stat-lbl" style={{ fontSize: 8 }}>BUYER ADDRESS</span>
                        <span className="stat-num" style={{ fontSize: 13, color: "var(--text-muted)" }}>{truncate(accountAddress)}</span>
                      </div>
                      <div className="stat-box" style={{ padding: "12px 14px" }}>
                        <span className="stat-lbl" style={{ fontSize: 8 }}>SELLER ADDRESS</span>
                        <span className="stat-num" style={{ fontSize: 13, color: "var(--text-muted)" }}>{truncate(sellerAddress)}</span>
                      </div>
                   </div>
                </div>

                <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
                    <button
                        onClick={async () => {
                            setLoading(true);
                            await onConfirm(pickupLocation);
                            setLoading(false);
                        }}
                        disabled={loading}
                        className="btn-gold"
                        style={{ width: "100%", padding: "14px 0", fontSize: 11 }}>
                        {loading ? (
                            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                <span style={{ animation: "spin 1s linear infinite" }}>◌</span> PROCESSING...
                            </span>
                        ) : "PURCHASE WITH ALGO"}
                    </button>
                    <button onClick={onClose} disabled={loading} className="btn-text-gold" style={{ fontSize: 11 }}>CANCEL TRANSACTION</button>
                </div>
            </motion.div>
        </motion.div>
    );
}
