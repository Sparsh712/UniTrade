import React, { useEffect, useMemo, useRef, useState } from "react";
import { truncate } from "./Shared";
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

function OfferCard({ message, canAct, onAccept, onReject }) {
  const statusColor =
    message.offerStatus === "accepted"
      ? "#10b981"
      : message.offerStatus === "rejected"
        ? "#ef4444"
        : "#f59e0b";

  const statusLabel =
    message.offerStatus === "accepted"
      ? "Accepted"
      : message.offerStatus === "rejected"
        ? "Rejected"
        : "Pending";

  return (
    <div style={{ background: "#111827", border: `1px solid ${statusColor}66`, borderRadius: 12, padding: 12, minWidth: 220 }}>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>Seller offered</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#a5b4fc", fontFamily: "'DM Mono', monospace" }}>
        {message.offeredPrice} ALGO
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: statusColor, fontFamily: "'DM Mono', monospace" }}>
        Offer {statusLabel}
      </div>
      {canAct && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={onAccept}
            style={{ flex: 1, border: "none", borderRadius: 8, padding: "7px 10px", background: "#10b981", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Accept
          </button>
          <button
            onClick={onReject}
            style={{ flex: 1, border: "1px solid #ef444488", borderRadius: 8, padding: "7px 10px", background: "#7f1d1d22", color: "#fca5a5", fontWeight: 700, cursor: "pointer" }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function getSenderLabel({ isMe, message, sellerId }) {
  if (isMe) return "You";
  return message.senderId === sellerId ? "Seller" : "Buyer";
}

export default function ChatDrawer({ listing, currentUserId, onClose, onBuy, onOfferAccepted, showToast }) {
  const endRef = useRef(null);

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
      setError("Unable to initialize chat.");
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
        setError(chatError.message || "Could not create chat.");
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
          setError(snapshotError.message || "Failed to load listing chats.");
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
        setError(snapshotError.message || "Failed to sync messages.");
      }
    );

    return () => unsubscribe();
  }, [chatId]);

  const currentBuyerId = useMemo(() => {
    if (!isSeller) return currentUserId;
    const activeChat = sellerChats.find((chat) => chat.id === chatId);
    return activeChat?.buyerId || "";
  }, [chatId, currentUserId, isSeller, sellerChats]);

  const canSendOffer = isSeller && Boolean(chatId) && Boolean(currentBuyerId);

  const sendText = async () => {
    const text = input.trim();
    if (!text || !chatId || !currentUserId) return;

    try {
      await sendChatTextMessage(chatId, { text, senderId: currentUserId });
      setInput("");
    } catch (chatError) {
      showToast?.(chatError.message || "Could not send message.", "error");
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
      showToast?.(offerError.message || "Could not send offer.", "error");
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
      showToast?.(actionError.message || "Could not update offer.", "error");
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
          maxWidth: "78%",
          animation: "fadeIn .25s ease",
        }}
      >
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, fontFamily: "'DM Mono', monospace", textAlign: isMe ? "right" : "left" }}>
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
              background: isMe ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#1f2937",
              color: "#f9fafb",
              borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              padding: "10px 14px",
              fontSize: 14,
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {message.text}
          </div>
        )}
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            color: "#4b5563",
            fontFamily: "'DM Mono', monospace",
            textAlign: isMe ? "right" : "left",
          }}
        >
          {formatTimeFromIso(message.date)}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div style={{ width: "100%", maxWidth: 430, background: "#0f172a", borderLeft: "1px solid #1f2937", display: "flex", flexDirection: "column", animation: "slideInRight .3s ease" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 12, background: "#0d1321" }}>
          <span style={{ fontSize: 28 }}>{listing.image}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#f9fafb", fontSize: 15 }}>{listing.title}</div>
            <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "'DM Mono', monospace" }}>
              {isSeller ? "Two-way chat inbox" : `Two-way chat with seller ${truncate(sellerAddress)}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {isSeller && (
          <div style={{ borderBottom: "1px solid #1f2937", padding: "10px 12px", display: "flex", gap: 8, overflowX: "auto" }}>
            {sellerChats.length === 0 ? (
              <div style={{ fontSize: 12, color: "#6b7280" }}>No buyer chats yet for this listing.</div>
            ) : sellerChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setChatId(chat.id)}
                style={{
                  border: `1px solid ${chat.id === chatId ? "#6366f1" : "#374151"}`,
                  background: chat.id === chatId ? "#6366f122" : "#1f2937",
                  color: chat.id === chatId ? "#a5b4fc" : "#9ca3af",
                  borderRadius: 10,
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: "'DM Mono', monospace",
                  whiteSpace: "nowrap",
                }}
                title={chat.lastMessageText}
              >
                buyer {truncate(chat.buyerId)}
              </button>
            ))}
          </div>
        )}

        <div style={{ margin: "12px 16px 0", padding: "12px 16px", background: "#111827", border: "1px solid #1f2937", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 34, background: "#1f2937", borderRadius: 10, padding: "8px 12px" }}>{listing.image}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 2 }}>{listing.title}</div>
            <div style={{ fontSize: 12, color: "#a5b4fc", fontFamily: "'DM Mono', monospace" }}>{listing.price} ALGO listed</div>
          </div>
          {!isSeller && (
            <button
              onClick={handleBuyAtListedPrice}
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, padding: "8px 12px", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "'DM Mono', monospace" }}
            >
              Buy Now
            </button>
          )}
        </div>

        {error && (
          <div style={{ margin: "10px 16px 0", background: "#7f1d1d33", border: "1px solid #ef444466", borderRadius: 8, padding: "8px 10px", color: "#fca5a5", fontSize: 12 }}>
            {error}
          </div>
        )}

        {canSendOffer && (
          <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", flexWrap: "wrap" }}>
            <button
              onClick={() => setShowOfferComposer((prev) => !prev)}
              style={{ background: showOfferComposer ? "#6366f122" : "#1f2937", border: `1px solid ${showOfferComposer ? "#6366f1" : "#374151"}`, borderRadius: 16, padding: "5px 12px", color: showOfferComposer ? "#a5b4fc" : "#9ca3af", cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono', monospace" }}
            >
              🏷️ Send Offer
            </button>
          </div>
        )}

        {showOfferComposer && canSendOffer && (
          <div style={{ margin: "8px 16px 0", padding: "10px 14px", background: "#111827", border: "1px solid #6366f144", borderRadius: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#9ca3af", fontFamily: "'DM Mono', monospace" }}>ALGO</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={offerPrice}
              onChange={(event) => setOfferPrice(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && sendOffer()}
              placeholder="Offer price"
              style={{ flex: 1, background: "#0f172a", border: "1px solid #374151", borderRadius: 8, padding: "8px 10px", color: "#f9fafb", fontSize: 14, outline: "none", fontFamily: "'DM Mono', monospace" }}
            />
            <button
              onClick={sendOffer}
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "'DM Mono', monospace" }}
            >
              Send
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {loadingChat ? (
            <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", paddingTop: 40 }}>Loading chat...</div>
          ) : messages.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", paddingTop: 40 }}>
              Start the conversation.
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          <div ref={endRef} />
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid #1f2937", display: "flex", gap: 8, background: "#0d1321" }}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && sendText()}
            placeholder="Type a message..."
            disabled={!chatId}
            style={{ flex: 1, background: "#111827", border: "1px solid #374151", borderRadius: 10, padding: "10px 14px", color: "#f9fafb", fontSize: 14, outline: "none" }}
          />
          <button
            onClick={sendText}
            disabled={!chatId}
            style={{ background: chatId ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#374151", border: "none", borderRadius: 10, padding: "10px 16px", color: "#fff", cursor: chatId ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 16 }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
