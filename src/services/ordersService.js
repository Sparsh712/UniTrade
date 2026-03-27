import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";

const ORDERS_COLLECTION = "orders";
const ORDER_SECRETS_COLLECTION = "orderSecrets";
const OTP_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_OTP_ATTEMPTS = 5;

const ORDER_STATUS = {
  PENDING: "pending",
  READY_FOR_DELIVERY: "ready_for_delivery",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const PAYMENT_STATUS = {
  HELD: "held",
  RELEASED: "released",
};

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return ORDER_STATUS.PENDING;

  if (value === "confirmed") return ORDER_STATUS.READY_FOR_DELIVERY;
  if (value === "failed") return ORDER_STATUS.CANCELLED;
  if (value === "negotiated") return ORDER_STATUS.PENDING;

  if (Object.values(ORDER_STATUS).includes(value)) return value;
  return ORDER_STATUS.PENDING;
}

function normalizePaymentStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === PAYMENT_STATUS.RELEASED) return PAYMENT_STATUS.RELEASED;
  return PAYMENT_STATUS.HELD;
}

function toIsoDate(input) {
  if (!input) return null;
  if (typeof input === "string") return input;
  if (typeof input?.toDate === "function") return input.toDate().toISOString();
  if (input instanceof Date) return input.toISOString();
  return null;
}

function readMs(input) {
  const iso = toIsoDate(input);
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function generateNumericOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  const random = Math.floor(Math.random() * (max - min)) + min;
  return String(random);
}

async function sha256Hex(value) {
  const source = String(value || "");
  if (!source) return "";

  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(source);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }
  return String(hash >>> 0);
}

function assertActorOnOrder(orderData, actorId) {
  if (!actorId || (orderData.buyerId !== actorId && orderData.sellerId !== actorId)) {
    throw new Error("You are not allowed to update this order.");
  }
}

function assertFirestoreReady() {
  if (!db) {
    throw new Error("Firestore is not initialized. Add Firebase env variables to enable real-time orders.");
  }
}

function ordersRef() {
  assertFirestoreReady();
  return collection(db, ORDERS_COLLECTION);
}

function orderSecretsRef() {
  assertFirestoreReady();
  return collection(db, ORDER_SECRETS_COLLECTION);
}

function mapOrderSnapshot(snapshot) {
  const data = snapshot.data();
  const status = normalizeStatus(data.status);
  const paymentStatus = normalizePaymentStatus(data.paymentStatus);
  const otpCreatedAt = toIsoDate(data.otpCreatedAt);
  const otpExpiresAt = toIsoDate(data.otpExpiresAt) || (otpCreatedAt ? new Date(readMs(otpCreatedAt) + OTP_TTL_MS).toISOString() : null);

  return {
    id: snapshot.id,
    listingId: data.listingId || "",
    chatId: data.chatId || "",
    offerMessageId: data.offerMessageId || "",
    buyerId: data.buyerId || "",
    sellerId: data.sellerId || "",
    buyerAddress: data.buyerAddress || "",
    sellerAddress: data.sellerAddress || "",
    title: data.title || "",
    image: data.image || "📦",
    amount: Number(data.amount || 0),
    price: Number(data.price || data.finalPrice || data.negotiatedPrice || data.amount || 0),
    negotiatedPrice: Number(data.negotiatedPrice || 0),
    finalPrice: Number(data.finalPrice || data.negotiatedPrice || data.amount || 0),
    receiver: data.sellerAddress || "",
    txId: data.txId || null,
    status,
    paymentStatus,
    pickupLocation: data.pickupLocation || "",
    rated: Boolean(data.rated),
    rating: Number(data.rating || 0),
    otpHash: data.otpHash || "",
    buyerOtp: "",
    otpCreatedAt,
    otpExpiresAt,
    otpVerified: Boolean(data.otpVerified),
    otpAttempts: Number(data.otpAttempts || 0),
    otpMaxAttempts: Number(data.otpMaxAttempts || DEFAULT_MAX_OTP_ATTEMPTS),
    timestamp: data.timestamp || null,
    date: data.timestamp?.toDate?.()?.toISOString() || data.date || new Date().toISOString(),
  };
}

export function subscribeToUserOrders(userId, onData, onError) {
  const mergedOrders = new Map();

  const emitSorted = () => {
    const orders = Array.from(mergedOrders.values()).sort((a, b) => {
      const aTime = Date.parse(a.date || "") || 0;
      const bTime = Date.parse(b.date || "") || 0;
      return bTime - aTime;
    });
    onData(orders);
  };

  const upsertFromSnapshot = (snapshot) => {
    snapshot.docs.forEach((orderDoc) => {
      const mapped = mapOrderSnapshot(orderDoc);
      mergedOrders.set(mapped.id, mapped);
    });
    emitSorted();
  };

  const removeFromSnapshot = (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "removed") {
        mergedOrders.delete(change.doc.id);
      }
    });
    emitSorted();
  };

  const buyerUnsubscribe = onSnapshot(
    query(ordersRef(), where("buyerId", "==", userId)),
    (snapshot) => {
      upsertFromSnapshot(snapshot);
      removeFromSnapshot(snapshot);
    },
    (error) => {
      if (onError) onError(error);
    }
  );

  const sellerUnsubscribe = onSnapshot(
    query(ordersRef(), where("sellerId", "==", userId)),
    (snapshot) => {
      upsertFromSnapshot(snapshot);
      removeFromSnapshot(snapshot);
    },
    (error) => {
      if (onError) onError(error);
    }
  );

  return () => {
    buyerUnsubscribe();
    sellerUnsubscribe();
  };
}

export function subscribeToBuyerOrderOtps(userId, onData, onError) {
  const unsubscribe = onSnapshot(
    query(orderSecretsRef(), where("buyerId", "==", userId)),
    (snapshot) => {
      const otpMap = new Map();
      snapshot.docs.forEach((item) => {
        const data = item.data();
        otpMap.set(data.orderId, {
          buyerOtp: data.otp || "",
          otpCreatedAt: data.otpCreatedAt || null,
          otpExpiresAt: data.otpExpiresAt || null,
        });
      });
      onData(otpMap);
    },
    (error) => {
      if (onError) onError(error);
    }
  );

  return () => unsubscribe();
}

export async function createOrder(orderInput) {
  const normalizedStatus = normalizeStatus(orderInput.status || ORDER_STATUS.PENDING);
  const payload = {
    listingId: orderInput.listingId,
    chatId: orderInput.chatId || "",
    offerMessageId: orderInput.offerMessageId || "",
    buyerId: orderInput.buyerId,
    sellerId: orderInput.sellerId,
    buyerAddress: orderInput.buyerAddress || "",
    sellerAddress: orderInput.sellerAddress || "",
    title: orderInput.title,
    image: orderInput.image || "📦",
    price: Number(orderInput.price || orderInput.finalPrice || orderInput.negotiatedPrice || orderInput.amount || 0),
    amount: Number(orderInput.amount || 0),
    negotiatedPrice: Number(orderInput.negotiatedPrice || 0),
    finalPrice: Number(orderInput.finalPrice || orderInput.negotiatedPrice || orderInput.amount || 0),
    txId: orderInput.txId || null,
    status: normalizedStatus,
    paymentStatus: normalizePaymentStatus(orderInput.paymentStatus || PAYMENT_STATUS.HELD),
    otpHash: orderInput.otpHash || "",
    otpCreatedAt: orderInput.otpCreatedAt || null,
    otpExpiresAt: orderInput.otpExpiresAt || null,
    otpVerified: Boolean(orderInput.otpVerified),
    otpAttempts: Number(orderInput.otpAttempts || 0),
    otpMaxAttempts: Number(orderInput.otpMaxAttempts || DEFAULT_MAX_OTP_ATTEMPTS),
    pickupLocation: orderInput.pickupLocation || "",
    rated: Boolean(orderInput.rated),
    rating: Number(orderInput.rating || 0),
    date: new Date().toISOString(),
    timestamp: serverTimestamp(),
  };

  const result = await addDoc(ordersRef(), payload);
  return result.id;
}

export async function updateOrderStatus(orderId, status, txId) {
  assertFirestoreReady();
  const normalizedStatus = normalizeStatus(status);

  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    status: normalizedStatus,
    ...(normalizedStatus === ORDER_STATUS.COMPLETED ? { paymentStatus: PAYMENT_STATUS.RELEASED } : {}),
    ...(normalizedStatus === ORDER_STATUS.CANCELLED ? { paymentStatus: PAYMENT_STATUS.HELD } : {}),
    ...(txId ? { txId } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function updateOrderById(orderId, updates) {
  assertFirestoreReady();
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function upsertNegotiatedOrder(orderInput) {
  assertFirestoreReady();
  const { chatId, buyerId, sellerId, listingId } = orderInput;

  if (!chatId || !buyerId || !sellerId || !listingId) {
    throw new Error("Missing required negotiated order fields.");
  }

  const existing = await getDocs(
    query(
      ordersRef(),
      where("chatId", "==", chatId),
      where("buyerId", "==", buyerId),
      where("sellerId", "==", sellerId),
      where("listingId", "==", listingId),
      limit(1)
    )
  );

  const negotiatedPrice = Number(orderInput.negotiatedPrice || orderInput.amount || 0);

  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    const normalizedStatus = normalizeStatus(orderInput.status || ORDER_STATUS.PENDING);
    await updateDoc(existingDoc.ref, {
      offerMessageId: orderInput.offerMessageId || "",
      negotiatedPrice,
      finalPrice: negotiatedPrice,
      price: negotiatedPrice,
      amount: negotiatedPrice,
      status: normalizedStatus,
      paymentStatus: normalizePaymentStatus(orderInput.paymentStatus || PAYMENT_STATUS.HELD),
      pickupLocation: orderInput.pickupLocation || "",
      updatedAt: serverTimestamp(),
    });
    return existingDoc.id;
  }

  return createOrder({
    ...orderInput,
    amount: negotiatedPrice,
    negotiatedPrice,
    finalPrice: negotiatedPrice,
    price: negotiatedPrice,
    status: orderInput.status || ORDER_STATUS.PENDING,
    paymentStatus: orderInput.paymentStatus || PAYMENT_STATUS.HELD,
  });
}

export async function rateOrder(orderId, rating) {
  assertFirestoreReady();
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    rated: true,
    rating: Number(rating),
    ratedAt: serverTimestamp(),
  });
}

export async function generateDeliveryOtp(orderId, buyerId, otpLength = 6) {
  assertFirestoreReady();

  const orderRef = doc(db, ORDERS_COLLECTION, orderId);
  const snapshot = await getDoc(orderRef);
  if (!snapshot.exists()) {
    throw new Error("Order not found.");
  }

  const orderData = snapshot.data();
  assertActorOnOrder(orderData, buyerId);
  if (orderData.buyerId !== buyerId) {
    throw new Error("Only the buyer can generate delivery OTP.");
  }

  const status = normalizeStatus(orderData.status);
  if (status === ORDER_STATUS.COMPLETED) {
    throw new Error("Order already completed.");
  }
  if (status === ORDER_STATUS.CANCELLED) {
    throw new Error("Cannot generate OTP for a cancelled order.");
  }

  const otp = generateNumericOtp(Math.min(6, Math.max(4, Number(otpLength) || 6)));
  const otpHash = await sha256Hex(otp);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await updateDoc(orderRef, {
    status: ORDER_STATUS.READY_FOR_DELIVERY,
    paymentStatus: PAYMENT_STATUS.HELD,
    otpHash,
    otpCreatedAt: now.toISOString(),
    otpExpiresAt: expiresAt.toISOString(),
    otpVerified: false,
    otpAttempts: 0,
    otpMaxAttempts: Number(orderData.otpMaxAttempts || DEFAULT_MAX_OTP_ATTEMPTS),
    otpVerifiedAt: null,
    completedAt: null,
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, ORDER_SECRETS_COLLECTION, orderId), {
    orderId,
    buyerId,
    otp,
    otpCreatedAt: now.toISOString(),
    otpExpiresAt: expiresAt.toISOString(),
    updatedAt: serverTimestamp(),
  });

  return {
    otp,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifyDeliveryOtp(orderId, sellerId, otpInput) {
  assertFirestoreReady();

  const value = String(otpInput || "").trim();
  if (!/^\d{4,6}$/.test(value)) {
    throw new Error("Enter a valid 4-6 digit OTP.");
  }

  const orderRef = doc(db, ORDERS_COLLECTION, orderId);
  const snapshot = await getDoc(orderRef);
  if (!snapshot.exists()) {
    throw new Error("Order not found.");
  }

  const orderData = snapshot.data();
  assertActorOnOrder(orderData, sellerId);
  if (orderData.sellerId !== sellerId) {
    throw new Error("Only the seller can verify delivery OTP.");
  }

  const status = normalizeStatus(orderData.status);
  if (status === ORDER_STATUS.CANCELLED) {
    throw new Error("Order is cancelled.");
  }
  if (status === ORDER_STATUS.COMPLETED || normalizePaymentStatus(orderData.paymentStatus) === PAYMENT_STATUS.RELEASED) {
    throw new Error("Payment is already released for this order.");
  }
  if (orderData.otpVerified) {
    throw new Error("OTP already verified. Waiting for buyer to release payment.");
  }

  const createdAtMs = readMs(orderData.otpCreatedAt);
  if (!createdAtMs) {
    throw new Error("Delivery OTP is not generated yet.");
  }

  const expiresAtMs = readMs(orderData.otpExpiresAt) || createdAtMs + OTP_TTL_MS;
  if (Date.now() > expiresAtMs) {
    await updateDoc(orderRef, {
      status: ORDER_STATUS.CANCELLED,
      paymentStatus: PAYMENT_STATUS.HELD,
      otpExpired: true,
      updatedAt: serverTimestamp(),
    });
    throw new Error("OTP has expired. Ask buyer to regenerate OTP.");
  }

  const maxAttempts = Number(orderData.otpMaxAttempts || DEFAULT_MAX_OTP_ATTEMPTS);
  const attempts = Number(orderData.otpAttempts || 0);
  if (attempts >= maxAttempts) {
    throw new Error("Maximum OTP attempts reached. Order is locked.");
  }

  const inputHash = await sha256Hex(value);
  const expectedHash = String(orderData.otpHash || "");

  if (!expectedHash || inputHash !== expectedHash) {
    const nextAttempts = attempts + 1;
    const updates = {
      otpAttempts: nextAttempts,
      lastOtpAttemptAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (nextAttempts >= maxAttempts) {
      updates.status = ORDER_STATUS.CANCELLED;
      updates.paymentStatus = PAYMENT_STATUS.HELD;
      updates.otpLocked = true;
    }

    await updateDoc(orderRef, updates);
    throw new Error(
      nextAttempts >= maxAttempts
        ? "Incorrect OTP. Maximum attempts reached, order cancelled."
        : `Incorrect OTP. ${maxAttempts - nextAttempts} attempts left.`
    );
  }

  const verifiedAt = new Date().toISOString();
  await updateDoc(orderRef, {
    status: ORDER_STATUS.READY_FOR_DELIVERY,
    paymentStatus: PAYMENT_STATUS.HELD,
    otpVerified: true,
    otpVerifiedAt: verifiedAt,
    updatedAt: serverTimestamp(),
  });

  return { success: true };
}

export async function releaseHeldPayment(orderId, buyerId, txId) {
  assertFirestoreReady();

  const orderRef = doc(db, ORDERS_COLLECTION, orderId);
  const snapshot = await getDoc(orderRef);
  if (!snapshot.exists()) {
    throw new Error("Order not found.");
  }

  const orderData = snapshot.data();
  assertActorOnOrder(orderData, buyerId);
  if (orderData.buyerId !== buyerId) {
    throw new Error("Only the buyer can release payment.");
  }

  const status = normalizeStatus(orderData.status);
  if (status === ORDER_STATUS.CANCELLED) {
    throw new Error("Order is cancelled.");
  }

  if (normalizePaymentStatus(orderData.paymentStatus) === PAYMENT_STATUS.RELEASED) {
    throw new Error("Payment already released.");
  }

  if (!orderData.otpVerified) {
    throw new Error("Seller must verify OTP before releasing payment.");
  }

  const completedAt = new Date().toISOString();
  await updateDoc(orderRef, {
    status: ORDER_STATUS.COMPLETED,
    paymentStatus: PAYMENT_STATUS.RELEASED,
    txId: txId || null,
    completedAt,
    paymentReleasedAt: completedAt,
    updatedAt: serverTimestamp(),
  });

  await deleteDoc(doc(db, ORDER_SECRETS_COLLECTION, orderId));

  return { success: true };
}

export async function cancelOrder(orderId, actorId) {
  assertFirestoreReady();

  const orderRef = doc(db, ORDERS_COLLECTION, orderId);
  const snapshot = await getDoc(orderRef);
  if (!snapshot.exists()) {
    throw new Error("Order not found.");
  }

  const orderData = snapshot.data();
  assertActorOnOrder(orderData, actorId);
  const status = normalizeStatus(orderData.status);

  if (status === ORDER_STATUS.COMPLETED) {
    throw new Error("Completed order cannot be cancelled.");
  }
  if (status === ORDER_STATUS.CANCELLED) {
    return;
  }

  await updateDoc(orderRef, {
    status: ORDER_STATUS.CANCELLED,
    paymentStatus: PAYMENT_STATUS.HELD,
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await deleteDoc(doc(db, ORDER_SECRETS_COLLECTION, orderId));
}

export const orderStatus = ORDER_STATUS;
export const paymentStatus = PAYMENT_STATUS;
