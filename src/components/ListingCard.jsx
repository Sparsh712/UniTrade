import React from "react";
import { Badge, truncate, conditionColor } from "./Shared";

export default function ListingCard({ listing, onBuy, accountAddress, currentUserId, wishlist, onToggleWishlist, onChat, onDelete }) {
    const isWished = wishlist?.includes(listing.id);
    const sellerAddress = listing.sellerAddress || listing.seller?.walletAddress || listing.seller;
    const isOwner = Boolean(currentUserId && listing.ownerId && currentUserId === listing.ownerId);
    return (
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 12, transition: "transform .2s, border-color .2s, box-shadow .2s", cursor: "default", animation: "fadeIn .4s ease" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(99,102,241,.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "#1f2937"; e.currentTarget.style.boxShadow = ""; }}>
            {/* Image + Wishlist */}
            <div style={{ position: "relative", fontSize: 48, textAlign: "center", background: "#1f2937", borderRadius: 12, padding: "16px 0" }}>
                {listing.image}
                <button onClick={(e) => { e.stopPropagation(); onToggleWishlist?.(listing.id); }}
                    style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .2s" }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
                    onMouseLeave={e => e.currentTarget.style.transform = ""}>
                    {isWished ? "❤️" : "🤍"}
                </button>
            </div>
            {/* Info */}
            <div>
                <div style={{ fontSize: 13, color: "#6366f1", fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>{listing.category}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", lineHeight: 1.3, marginBottom: 6 }}>{listing.title}</div>
                <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{listing.description}</div>
            </div>
            {/* Badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Badge text={listing.condition} color={conditionColor[listing.condition] || "#9ca3af"} />
                {listing.rating >= 4.0 && <Badge text="⭐ Trusted" color="#f59e0b" />}
                <span style={{ fontSize: 11, color: "#4b5563", fontFamily: "'DM Mono', monospace" }}>by {truncate(sellerAddress)}</span>
            </div>
            {/* Price + Actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 12, borderTop: "1px solid #1f2937" }}>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#a5b4fc", fontFamily: "'DM Mono', monospace" }}>
                        {listing.price} <span style={{ fontSize: 14, fontWeight: 500, color: "#6366f1" }}>ALGO</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#4b5563" }}>≈ ${(listing.price * 0.18).toFixed(2)} USD</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                    {accountAddress && (
                        <button onClick={() => onChat?.(listing)}
                            style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontSize: 14, transition: "border-color .2s" }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = "#6366f1"}
                            onMouseLeave={e => e.currentTarget.style.borderColor = "#374151"}>
                            💬
                        </button>
                    )}
                    {isOwner ? (
                        <button onClick={() => onDelete?.(listing)}
                            style={{ background: "#7f1d1d33", color: "#fca5a5", border: "1px solid #ef444466", borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
                            Delete
                        </button>
                    ) : (
                        <button onClick={() => onBuy(listing)} disabled={!accountAddress}
                            style={{ background: accountAddress ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#1f2937", color: accountAddress ? "#fff" : "#4b5563", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: accountAddress ? "pointer" : "not-allowed", transition: "opacity .2s", fontFamily: "'DM Mono', monospace" }}
                            onMouseEnter={e => accountAddress && (e.currentTarget.style.opacity = ".85")}
                            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                            {accountAddress ? "Buy Now" : "Connect"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
