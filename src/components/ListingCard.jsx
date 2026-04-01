import React, { useState } from "react";
import { motion } from "framer-motion";
import { Badge, truncate, conditionColor } from "./Shared";

const cardVariants = {
    hidden: { opacity: 0, y: 24, scale: 0.97 },
    visible: {
        opacity: 1, y: 0, scale: 1,
        transition: { duration: 0.4, ease: [0.19, 1, 0.22, 1] }
    }
};

const thumbVariants = {
    rest: { scale: 1, filter: "grayscale(80%)" },
    hover: { scale: 1.04, filter: "grayscale(0%)", transition: { duration: 0.4, ease: "easeOut" } }
};

const barVariants = {
    rest: { scaleX: 0 },
    hover: { scaleX: 1, transition: { duration: 0.4, ease: [0.19, 1, 0.22, 1] } }
};

const buttonVariants = {
    rest: { scale: 1 },
    tap: { scale: 0.95 },
    hover: { scale: 1.03, transition: { duration: 0.15 } }
};

function isPhoto(value) {
    return typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/") || value.startsWith("blob:"));
}

export default function ListingCard({ listing, onBuy, accountAddress, currentUserId, wishlist, onToggleWishlist, onChat, onDelete, onView }) {
    const isWished = wishlist?.includes(listing.id);
    const sellerAddress = listing.sellerAddress || listing.seller?.walletAddress || listing.seller;
    const isOwner = Boolean(accountAddress && sellerAddress && accountAddress === sellerAddress);
    const hasPhoto = isPhoto(listing.image);
    const [imgError, setImgError] = useState(false);

    return (
        <motion.div
            className="listing-card"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover="hover"
            style={{ height: "100%", position: "relative", display: "flex", flexDirection: "column" }}
        >
            {/* Sovereign Cyan Left Bar */}
            <motion.div
                variants={barVariants}
                initial="rest"
                style={{
                    position: "absolute",
                    left: 0, top: 0, bottom: 0, width: 5,
                    background: "linear-gradient(to bottom, var(--pulse, #00F2FE), var(--pulse-dim, #00dce6))",
                    boxShadow: "0 0 20px rgba(0,242,254,0.4)",
                    transformOrigin: "left",
                    zIndex: 10,
                }}
            />

            {/* Clickable area: Thumbnail + Body */}
            <div
                onClick={() => onView?.(listing)}
                style={{ cursor: onView ? "pointer" : "default", flex: 1, display: "flex", flexDirection: "column" }}
                role={onView ? "button" : undefined}
                tabIndex={onView ? 0 : undefined}
                onKeyDown={onView ? (e) => e.key === "Enter" && onView(listing) : undefined}
                aria-label={onView ? `View details for ${listing.title}` : undefined}
            >
                {/* Thumbnail */}
                <motion.div className="card-thumb" variants={thumbVariants}>
                    {hasPhoto && !imgError ? (
                        <img
                            src={listing.image}
                            alt={listing.title}
                            onError={() => setImgError(true)}
                            style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1 }}
                        />
                    ) : (
                        <span style={{ position: "relative", zIndex: 1, fontSize: 56 }}>📦</span>
                    )}
                    <motion.button
                        className={`wishlist-btn${isWished ? " active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); onToggleWishlist?.(listing.id); }}
                        title={isWished ? "Remove from saved" : "Save listing"}
                        whileTap={{ scale: 1.4 }}
                        animate={isWished ? { scale: [1, 1.3, 1], transition: { duration: 0.3 } } : { scale: 1 }}
                    >
                        {isWished ? "♥" : "♡"}
                    </motion.button>
                </motion.div>

                {/* Body */}
                <motion.div className="card-body">
                    <motion.div
                        className="card-category"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1, duration: 0.3 }}
                    >{listing.category}</motion.div>
                    <div className="card-title">{listing.title}</div>
                    <div className="card-desc">{listing.description}</div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        <Badge text={listing.condition} color={conditionColor[listing.condition] || "#8A7420"} />
                        {listing.rating >= 4.0 && (
                            <motion.span
                                className="badge badge-gold"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 }}
                            >⭐ TRUSTED</motion.span>
                        )}
                        <span style={{ marginLeft: "auto", fontFamily: "'Space Mono', monospace", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.06em" }}>
                            {truncate(sellerAddress)}
                        </span>
                    </div>
                </motion.div>
            </div>

            {/* Footer */}
            <div className="card-footer">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="card-price">
                        {listing.price}
                        <span style={{ fontSize: 12, fontWeight: 400, color: "var(--gold-muted)", marginLeft: 4 }}>ALGO</span>
                    </div>
                    <div className="card-fiat">≈ ₹{(listing.price * 15).toLocaleString("en-IN")} INR</div>
                </motion.div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {accountAddress && (
                        <motion.button
                            className="btn-text-gold"
                            onClick={() => onChat?.(listing)}
                            title="Message seller"
                            style={{ fontSize: 11, letterSpacing: "0.1em" }}
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                        >
                            CHAT →
                        </motion.button>
                    )}
                    {isOwner ? (
                        <motion.button
                            className="btn-danger"
                            onClick={() => onDelete?.(listing)}
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                        >
                            DELETE
                        </motion.button>
                    ) : (
                        <motion.button
                            className="btn-gold"
                            onClick={() => onBuy(listing)}
                            disabled={!accountAddress}
                            style={{ padding: "8px 18px", fontSize: 11 }}
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                        >
                            {accountAddress ? "BUY" : "CONNECT"}
                        </motion.button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
