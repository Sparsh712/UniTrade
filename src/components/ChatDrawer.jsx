import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { truncate, labelStyle } from "./Shared";
import {
  getOrCreateChat,
  sendChatTextMessage,
  sendOfferMessage,
  subscribeToChatMessages,
  subscribeToListingChatsForSeller,
  updateOfferStatus,
} from "../services/chatService";

function formatTimeFromIso(isoDate) {
  const date = isoDate ? new Date(isoDate) : new Date();
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isPhoto(value) {
  return typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/") || value.startsWith("blob:"));
}

function OfferCard({ message, canAct, onAccept, onReject }) {
  const statusColor =
    message.offerStatus === "accepted"
      ? "var(--emerald)"
      : message.offerStatus === "rejected"
        ? "var(--red)"
        : "var(--amber)";

  const statusLabel =
    message.offerStatus === "accepted"
      ? "ACCEPTED"
      : message.offerStatus === "rejected"
        ? "REJECTED"
        : "PENDING";

  return (
    <div style={{ background: "var(--s0)", border: `1px solid ${statusColor}`, padding: 16, minWidth: 240 }}>
      <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 8, fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em" }}>SELLER OFFER</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--gold)", fontFamily: "'Space Mono', monospace" }}>
        {message.offeredPrice} ALGO
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: statusColor, fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>
        OFFER {statusLabel}
      </div>
      {canAct && (
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            onClick={onAccept}
            className="btn-gold"
            style={{ flex: 1, padding: "8px 0", fontSize: 11 }}
          >
            ACCEPT
          </button>
          <button
            onClick={onReject}
            className="btn-outline"
            style={{ flex: 1, padding: "8px 0", fontSize: 11, border: "1px solid var(--red-muted)", color: "var(--red)" }}
          >
            REJECT
          </button>
        </div>
      )}
    </div>
  );
}

function getSenderLabel({ isMe, message, sellerId }) {
  if (isMe) return "YOU";
  return message.senderId === sellerId ? "SELLER" : "BUYER";
}

export default function ChatDrawer({ listing, currentUserId, onClose, onBuy, onOfferAccepted, showToast }) {
  const endRef = useRef(null);
  const listingImage = listing.imageUrl || listing.image;
  const hasListingPhoto = isPhoto(listingImage);

  const sellerAddress = listing.sellerAddress || listing.seller?.walletAddress || listing.seller;
  const sellerId = listing.ownerId || listing.seller?.userId || "";
  const isSeller = currentUserId === sellerId;

  const [chatId, setChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [showOfferComposer, setShowOfferComposer] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const [error, setError] = useState("");
  const [sellerChats, setSellerChats] = useState([]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!currentUserId || !listing?.id || !sellerId) {
      setError("UNABLE TO INITIALIZE CHAT.");
      setLoadingChat(false);
      return;
    }

    let unsubscribe = () => {};

    async function initializeBuyerChat() {
      try {
        const resolvedChatId = await getOrCreateChat({
          listingId: listing.id,
          buyerId: currentUserId,
          sellerId,
        });

        setChatId(resolvedChatId);
        setError("");
      } catch (chatError) {
        setError(chatError.message || "COULD NOT CREATE CHAT.");
      } finally {
        setLoadingChat(false);
      }
    }

    if (isSeller) {
      unsubscribe = subscribeToListingChatsForSeller(
        listing.id,
        sellerId,
        (chats) => {
          setSellerChats(chats);
          setLoadingChat(false);
          setError("");
          if (!chatId && chats.length) {
            setChatId(chats[0].id);
          }
        },
        (snapshotError) => {
          setError(snapshotError.message || "FAILED TO LOAD LISTING CHATS.");
          setLoadingChat(false);
        }
      );
    } else {
      initializeBuyerChat();
    }

    return () => unsubscribe();
  }, [chatId, currentUserId, isSeller, listing.id, sellerId]);

  useEffect(() => {
    if (!chatId) return undefined;

    const unsubscribe = subscribeToChatMessages(
      chatId,
      (items) => {
        setMessages(items);
        setError("");
      },
      (snapshotError) => {
        setError(snapshotError.message || "FAILED TO SYNC MESSAGES.");
      }
    );

    return () => unsubscribe();
  }, [chatId]);

  const uniqueSellerChats = useMemo(() => {
    const map = new Map();
    // Sort by recent activity first to keep the most relevant one if duplicates exist
    const sorted = [...sellerChats].sort((a, b) => {
      const aT = a.updatedAt?.seconds || 0;
      const bT = b.updatedAt?.seconds || 0;
      return bT - aT;
    });
    for (const c of sorted) {
      if (!map.has(c.buyerId)) {
        map.set(c.buyerId, c);
      }
    }
    return Array.from(map.values());
  }, [sellerChats]);

  const currentBuyerId = useMemo(() => {
    if (!isSeller) return currentUserId;
    const activeChat = uniqueSellerChats.find((chat) => chat.id === chatId);
    return activeChat?.buyerId || "";
  }, [chatId, currentUserId, isSeller, uniqueSellerChats]);

  const canSendOffer = isSeller && Boolean(chatId) && Boolean(currentBuyerId);

  const sendText = async () => {
    const text = input.trim();
    if (!text || !chatId || !currentUserId) return;

    try {
      await sendChatTextMessage(chatId, { text, senderId: currentUserId });
      setInput("");
    } catch (chatError) {
      showToast?.(chatError.message || "COULD NOT SEND MESSAGE.", "error");
    }
  };

  const sendOffer = async () => {
    const parsed = parseFloat(offerPrice);
    if (Number.isNaN(parsed) || parsed <= 0 || !canSendOffer) return;

    try {
      await sendOfferMessage(chatId, {
        senderId: currentUserId,
        offeredPrice: parsed,
        listingId: listing.id,
        buyerId: currentBuyerId,
      });
      setOfferPrice("");
      setShowOfferComposer(false);
    } catch (offerError) {
      showToast?.(offerError.message || "COULD NOT SEND OFFER.", "error");
    }
  };

  const handleOfferAction = async (message, nextStatus) => {
    try {
      await updateOfferStatus(chatId, message.id, nextStatus, currentUserId);

      if (nextStatus === "accepted") {
        await onOfferAccepted?.({
          chatId,
          offerMessageId: message.id,
          offeredPrice: Number(message.offeredPrice),
          listingId: listing.id,
          buyerId: message.buyerId,
          sellerId,
        });
      }
    } catch (actionError) {
      showToast?.(actionError.message || "COULD NOT UPDATE OFFER.", "error");
    }
  };

  const handleBuyAtListedPrice = () => {
    onClose();
    onBuy?.(listing);
  };

  const renderMessage = (message) => {
    const isMe = message.senderId === currentUserId;
    const isOffer = message.type === "offer";
    const isOfferTarget = !isSeller && message.buyerId === currentUserId;
    const canActOnOffer =
      isOffer &&
      isOfferTarget &&
      message.offerStatus === "pending";

    return (
      <div
        key={message.id}
        style={{
          alignSelf: isMe ? "flex-end" : "flex-start",
          maxWidth: "85%",
          animation: "fadeIn .25s ease",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 6, fontFamily: "'Space Mono', monospace", textAlign: isMe ? "right" : "left", letterSpacing: "0.1em" }}>
          {getSenderLabel({ isMe, message, sellerId })}
        </div>
        {isOffer ? (
          <OfferCard
            message={message}
            canAct={canActOnOffer}
            onAccept={() => handleOfferAction(message, "accepted")}
            onReject={() => handleOfferAction(message, "rejected")}
          />
        ) : (
          <div
            style={{
              background: isMe ? "var(--s2)" : "var(--s1)",
              border: `1px solid ${isMe ? "var(--gold-dim)" : "var(--border)"}`,
              color: isMe ? "var(--gold)" : "var(--text)",
              padding: "12px 16px",
              fontSize: 14,
              lineHeight: 1.55,
              wordBreak: "break-word",
            }}
          >
            {message.text}
          </div>
        )}
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: "var(--text-dim)",
            fontFamily: "'Space Mono', monospace",
            textAlign: isMe ? "right" : "left",
          }}
        >
          {formatTimeFromIso(message.date)}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(100vw, 460px)", zIndex: 1000, pointerEvents: "none" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="chat-drawer-panel"
        style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", pointerEvents: "auto" }}
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, background: "rgba(255,255,255,0.02)" }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", background: "var(--s2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {hasListingPhoto ? (
              <img src={listingImage} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 24 }}>{listing.image}</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontWeight: 800, color: "var(--text)", fontSize: 18 }}>UNITRADE INBOX.</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>
              {isSeller ? "MANAGING BUYER CHATS" : `CHATTING WITH ${truncate(sellerAddress)}`}
            </div>
          </div>
          <button onClick={onClose} className="btn-text-gold" style={{ fontSize: 24 }}>✕</button>
        </div>

        {/* Seller tabs if multiple chats */}
        {isSeller && (
          <div style={{ borderBottom: "1px solid var(--border)", padding: "12px 16px", display: "flex", gap: 12, overflowX: "auto", background: "rgba(255,255,255,0.03)" }}>
            {sellerChats.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "'Space Mono', monospace" }}>NO BUYER CHATS YET.</div>
            ) : uniqueSellerChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setChatId(chat.id)}
                className={`cat-link${chat.id === chatId ? " active" : ""}`}
                style={{
                  padding: "8px 14px",
                  fontSize: 10,
                  whiteSpace: "nowrap",
                }}
                title={chat.lastMessageText}
              >
                BUYER {truncate(chat.buyerId)}
              </button>
            ))}
          </div>
        )}

        {/* Listing preview slab */}
        <div style={{ margin: "16px 20px 0", padding: "12px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", background: "var(--s2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {hasListingPhoto ? (
              <img src={listingImage} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 26 }}>{listing.image}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.title}</div>
            <div style={{ fontSize: 11, color: "var(--gold)", fontFamily: "'Space Mono', monospace" }}>{listing.price} ALGO</div>
          </div>
          {!isSeller && (
            <button
              onClick={handleBuyAtListedPrice}
              style={{
                flexShrink: 0,
                background: "var(--gold)",
                color: "#000",
                border: "none",
                padding: "8px 14px",
                fontSize: 11,
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                letterSpacing: "0.08em",
                cursor: "pointer",
                whiteSpace: "nowrap",
                borderRadius: 6,
              }}
            >
              BUY NOW
            </button>
          )}
        </div>

        {error && (
          <div style={{ margin: "16px 20px 0", border: "1px solid var(--red)", padding: "12px 16px", color: "var(--red)", fontSize: 11, fontFamily: "'Space Mono', monospace" }}>
            {error}
          </div>
        )}

        {/* Seller tools */}
        {canSendOffer && (
          <div style={{ display: "flex", gap: 12, padding: "12px 20px 0" }}>
            <button
              onClick={() => setShowOfferComposer((prev) => !prev)}
              style={{
                fontSize: 10,
                padding: "6px 14px",
                background: showOfferComposer ? "rgba(255,255,255,0.07)" : "transparent",
                border: "1px solid var(--border-gold)",
                color: "var(--gold)",
                fontFamily: "'Space Mono', monospace",
                letterSpacing: "0.08em",
                cursor: "pointer",
                borderRadius: 6,
              }}
            >
              🏷️ SEND CUSTOM OFFER
            </button>
          </div>
        )}

        {showOfferComposer && canSendOffer && (
          <div style={{ margin: "10px 20px 0", padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--gold-dim)", display: "flex", gap: 10, alignItems: "center", borderRadius: "10px", overflow: "hidden" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>ALGO</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={offerPrice}
              onChange={(event) => setOfferPrice(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && sendOffer()}
              placeholder="OFFER PRICE"
              className="input-box"
              style={{ flex: 1, padding: "9px 12px", fontSize: 13, fontFamily: "'Space Mono', monospace" }}
            />
            <button
              onClick={sendOffer}
              style={{
                flexShrink: 0,
                background: "var(--gold)",
                color: "#000",
                border: "none",
                padding: "9px 16px",
                fontSize: 11,
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                cursor: "pointer",
                borderRadius: 6,
                letterSpacing: "0.08em",
              }}
            >
              SEND
            </button>
          </div>
        )}

        {/* Chat window */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 16px", display: "flex", flexDirection: "column" }}>
          {loadingChat ? (
            <div style={{ color: "var(--text-dim)", fontSize: 11, textAlign: "center", paddingTop: 40, fontFamily: "'Space Mono', monospace" }}>SYNCING SECURE CHAT...</div>
          ) : messages.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontSize: 12, textAlign: "center", paddingTop: 40 }}>
              START THE CONVERSATION.
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          <div ref={endRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, background: "rgba(13, 13, 28, 0.85)", alignItems: "center", flexShrink: 0 }}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && sendText()}
            placeholder="TYPE A MESSAGE..."
            disabled={!chatId}
            className="input-box"
            style={{ flex: 1, padding: "11px 14px", fontSize: 13 }}
          />
          <button
            onClick={sendText}
            disabled={!chatId}
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              background: chatId ? "var(--gold)" : "var(--s3)",
              color: chatId ? "#000" : "var(--text-dim)",
              border: "none",
              borderRadius: 8,
              cursor: chatId ? "pointer" : "not-allowed",
              transition: "background 0.2s",
            }}
          >
            ➤
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
