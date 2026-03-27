import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";

const CHATS_COLLECTION = "chats";

function assertFirestoreReady() {
  if (!db) {
    throw new Error("Firestore is not initialized. Add Firebase env variables to enable real-time chat.");
  }
}

function chatsRef() {
  assertFirestoreReady();
  return collection(db, CHATS_COLLECTION);
}

function messagesRef(chatId) {
  assertFirestoreReady();
  return collection(db, CHATS_COLLECTION, chatId, "messages");
}

function chatParticipantsKey(buyerId, sellerId) {
  return [buyerId, sellerId].sort().join("__");
}

function mapMessageSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    type: data.type || "text",
    text: data.text || "",
    senderId: data.senderId || "",
    listingId: data.listingId || "",
    buyerId: data.buyerId || "",
    offeredPrice: Number(data.offeredPrice || 0),
    offerStatus: data.offerStatus || "",
    timestamp: data.timestamp || null,
    date: data.timestamp?.toDate?.()?.toISOString() || data.date || new Date().toISOString(),
    meta: data.meta || {},
  };
}

export async function getOrCreateChat({ listingId, buyerId, sellerId }) {
  if (!listingId || !buyerId || !sellerId) {
    throw new Error("Missing listingId/buyerId/sellerId for chat creation.");
  }

  const participantsKey = chatParticipantsKey(buyerId, sellerId);
  const existing = await getDocs(
    query(
      chatsRef(),
      where("listingId", "==", listingId),
      where("participantsKey", "==", participantsKey),
      limit(1)
    )
  );

  if (!existing.empty) {
    return existing.docs[0].id;
  }

  const ref = doc(chatsRef());
  await setDoc(ref, {
    listingId,
    buyerId,
    sellerId,
    participants: [buyerId, sellerId],
    participantsKey,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessageText: "Chat started",
  });

  return ref.id;
}

export function subscribeToChatMessages(chatId, onData, onError) {
  const q = query(messagesRef(chatId), orderBy("timestamp", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map(mapMessageSnapshot));
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export function subscribeToListingChatsForSeller(listingId, sellerId, onData, onError) {
  const q = query(chatsRef(), where("listingId", "==", listingId), where("sellerId", "==", sellerId));

  return onSnapshot(
    q,
    (snapshot) => {
      const chats = snapshot.docs.map((chatDoc) => {
        const data = chatDoc.data();
        return {
          id: chatDoc.id,
          listingId: data.listingId || "",
          buyerId: data.buyerId || "",
          sellerId: data.sellerId || "",
          lastMessageText: data.lastMessageText || "",
          lastMessageAt: data.lastMessageAt || null,
          updatedAt: data.updatedAt || null,
        };
      }).sort((a, b) => {
        const aTime = a.updatedAt?.toDate?.()?.getTime?.() || 0;
        const bTime = b.updatedAt?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      });

      onData(chats);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

async function updateChatSummary(chatId, messageText) {
  await updateDoc(doc(db, CHATS_COLLECTION, chatId), {
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessageText: messageText,
  });
}

export async function sendChatTextMessage(chatId, { text, senderId }) {
  if (!text || !senderId) {
    throw new Error("Missing text or senderId.");
  }

  await addDoc(messagesRef(chatId), {
    type: "text",
    text,
    senderId,
    timestamp: serverTimestamp(),
    date: new Date().toISOString(),
  });

  await updateChatSummary(chatId, text);
}

export async function sendOfferMessage(chatId, { senderId, offeredPrice, listingId, buyerId }) {
  if (!senderId || !offeredPrice || !listingId || !buyerId) {
    throw new Error("Missing offer fields.");
  }

  const offerRef = await addDoc(messagesRef(chatId), {
    type: "offer",
    senderId,
    offeredPrice: Number(offeredPrice),
    listingId,
    buyerId,
    offerStatus: "pending",
    text: "",
    timestamp: serverTimestamp(),
    date: new Date().toISOString(),
  });

  await updateChatSummary(chatId, `Offer ${Number(offeredPrice)} ALGO`);
  return offerRef.id;
}

export async function updateOfferStatus(chatId, messageId, offerStatus, actorId) {
  if (!["accepted", "rejected"].includes(offerStatus)) {
    throw new Error("Invalid offer status.");
  }

  await updateDoc(doc(db, CHATS_COLLECTION, chatId, "messages", messageId), {
    offerStatus,
    actedBy: actorId,
    actedAt: serverTimestamp(),
  });

  await updateChatSummary(chatId, `Offer ${offerStatus}`);
}
