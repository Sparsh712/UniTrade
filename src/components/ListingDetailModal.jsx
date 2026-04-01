import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge, conditionColor, truncate } from "./Shared";

function isPhoto(value) {
  return (
    typeof value === "string" &&
    (value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:image/") ||
      value.startsWith("blob:"))
  );
}

export default function ListingDetailModal({
  listing,
  accountAddress,
  currentUserId,
  onClose,
  onBuy,
  onChat,
  onDelete,
  wishlist,
  onToggleWishlist,
}) {
  if (!listing) return null;

  const isWished = wishlist?.includes(listing.id);
  const sellerAddress =
    listing.sellerAddress || listing.seller?.walletAddress || listing.seller;
  const isOwner = Boolean(
    accountAddress && sellerAddress && accountAddress === sellerAddress
  );
  const hasPhoto = isPhoto(listing.image);
  const displayImage = listing.imageUrl || listing.image;
  const hasDisplayPhoto = isPhoto(displayImage);
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{ zIndex: 500 }}
    >
      <motion.div
        className="modal-panel"
        style={{
          maxWidth: 700,
          width: "100%",
          padding: 0,
          overflow: "hidden",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
        initial={{ scale: 0.92, opacity: 0, y: 32 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 32 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
      >
        {/* ── Image hero ── */}
        <div
          style={{
            position: "relative",
            height: 300,
            background: "var(--s0)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {hasDisplayPhoto && !imgError ? (
            <img
              src={displayImage}
              alt={listing.title}
              onError={() => setImgError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: 80 }}>{listing.image && !isPhoto(listing.image) ? listing.image : "\uD83D\uDCE6"}</span>
          )}

          {/* Gradient overlay at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 80,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Category pill on image */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 20,
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "var(--gold)",
              textTransform: "uppercase",
              background: "rgba(0,0,0,0.6)",
              padding: "4px 10px",
              border: "1px solid rgba(212,175,55,0.3)",
              backdropFilter: "blur(8px)",
            }}
          >
            {listing.category}
          </div>

          {/* Wishlist btn */}
          <button
            onClick={() => onToggleWishlist?.(listing.id)}
            style={{
              position: "absolute",
              top: 14,
              right: 56,
              background: "rgba(0,0,0,0.65)",
              border: `1px solid ${isWished ? "var(--gold)" : "var(--border-mid)"}`,
              color: isWished ? "var(--gold)" : "var(--text-muted)",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
            title={isWished ? "Remove from saved" : "Save listing"}
          >
            {isWished ? "♥" : "♡"}
          </button>

          {/* Close btn */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              background: "rgba(0,0,0,0.65)",
              border: "1px solid var(--border-mid)",
              color: "var(--text)",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Content ── */}
        <div
          style={{
            overflowY: "auto",
            padding: "28px 32px 32px",
            flex: 1,
          }}
        >
          {/* Title + condition */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 12,
            }}
          >
            <h2
              className="serif"
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "var(--text)",
                lineHeight: 1.25,
                flex: 1,
              }}
            >
              {listing.title}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
              <Badge
                text={listing.condition}
                color={conditionColor[listing.condition] || "#8A7420"}
              />
              {listing.rating >= 4.0 && (
                <span className="badge badge-gold">⭐ TRUSTED</span>
              )}
            </div>
          </div>

          {/* Price row */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 34,
                fontWeight: 700,
                color: "var(--gold)",
                letterSpacing: "-0.02em",
              }}
            >
              {listing.price}
            </span>
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 14,
                color: "var(--gold-muted)",
              }}
            >
              ALGO
            </span>
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                color: "var(--text-dim)",
                marginLeft: 6,
              }}
            >
              ≈ ₹{(listing.price * 15).toLocaleString("en-IN")} INR
            </span>
          </div>

          <div
            style={{ height: 1, background: "var(--border)", marginBottom: 20 }}
          />

          {/* Full description */}
          <div
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.75,
              marginBottom: 24,
              whiteSpace: "pre-wrap",
            }}
          >
            {listing.description || "No description provided."}
          </div>

          {/* Seller info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 24,
              padding: "12px 16px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                color: "var(--text-dim)",
                letterSpacing: "0.1em",
              }}
            >
              SELLER
            </span>
            <div style={{ flex: 1 }} />
            {listing.seller?.displayName &&
              listing.seller.displayName !== "Campus Seller" && (
                <span
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    color: "var(--text-muted)",
                  }}
                >
                  {listing.seller.displayName}
                </span>
              )}
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                color: "var(--text-dim)",
              }}
            >
              {truncate(sellerAddress)}
            </span>
            {listing.seller?.verifiedEmail && (
              <span className="badge badge-emerald">✓ VERIFIED</span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            {accountAddress && !isOwner && (
              <motion.button
                className="btn-text-gold"
                onClick={() => {
                  onClose();
                  onChat?.(listing);
                }}
                style={{ flex: 1, fontSize: 12, padding: "12px 0", borderBottom: "1px solid var(--border-gold)" }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                CHAT →
              </motion.button>
            )}

            {isOwner ? (
              <motion.button
                className="btn-danger"
                onClick={() => {
                  onClose();
                  onDelete?.(listing);
                }}
                style={{ flex: 1, padding: "14px 0", fontSize: 12 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                DELETE LISTING
              </motion.button>
            ) : (
              <motion.button
                className="btn-gold"
                onClick={() => {
                  onClose();
                  onBuy?.(listing);
                }}
                disabled={!accountAddress}
                style={{ flex: 2, padding: "14px 0", fontSize: 12 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
              >
                {accountAddress ? "BUY NOW →" : "CONNECT WALLET TO BUY"}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
