import {
  addDoc,
  collection,
  getDoc,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../firebase/config";

const LISTINGS_COLLECTION = "listings";

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function mapFirestoreWriteError(error) {
  const code = error?.code || "";

  if (code === "permission-denied") {
    return "Write blocked by Firestore rules. Ensure request.auth.uid matches ownerId for listing create.";
  }

  if (code === "unauthenticated") {
    return "You are not authenticated with Firebase. Refresh and sign in again.";
  }

  if (code === "unavailable") {
    return "Firestore is currently unavailable. Check internet connection and try again.";
  }

  return error?.message || "Could not write to Firestore.";
}

function mapFirestoreReadError(error) {
  const code = error?.code || "";
  const message = error?.message || "";

  if (code === "permission-denied" && message.includes("firestore.googleapis.com")) {
    return "Firestore API is disabled for this Firebase project. Enable Firestore API in Google Cloud Console and retry.";
  }

  if (code === "permission-denied") {
    return "Read blocked by Firestore rules. Ensure authenticated users can read listings.";
  }

  if (code === "unauthenticated") {
    return "You are not authenticated with Firebase. Refresh and sign in again.";
  }

  if (code === "unavailable") {
    return "Firestore is unavailable right now. Check internet/API status and retry.";
  }

  return message || "Could not read listings from Firestore.";
}

function assertFirestoreReady() {
  if (!db) {
    throw new Error("Firestore is not initialized. Add Firebase env variables to enable real-time listings.");
  }
}

function assertStorageReady() {
  if (!storage) {
    throw new Error("Firebase Storage is not initialized. Add Firebase env variables to upload listing photos.");
  }
}

function isPhotoLike(value) {
  return typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/") || value.startsWith("blob:"));
}

function isUrlLike(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("blob:") || normalized.startsWith("data:");
}

function sanitizeTitle(value) {
  if (typeof value !== "string") return "CAMPUS ITEM";
  const trimmed = value.trim();
  if (!trimmed || isUrlLike(trimmed)) return "CAMPUS ITEM";
  return trimmed;
}

async function uploadListingPhoto(file, ownerId) {
  assertStorageReady();

  const ext = (file?.name?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const safeType = (file?.type || "image/jpeg").toLowerCase();
  const timestamp = Date.now();
  const fileRef = ref(storage, `listing-photos/${ownerId}/${timestamp}.${ext}`);

  await withTimeout(
    uploadBytes(fileRef, file, { contentType: safeType }),
    20000,
    "Photo upload timed out. Check network and try again."
  );

  return getDownloadURL(fileRef);
}

function normalizeSeller(seller) {
  if (typeof seller === "string") {
    return {
      walletAddress: seller,
      userId: "",
      displayName: "Campus Seller",
      verifiedEmail: "",
      profileType: "wallet",
    };
  }

  return {
    walletAddress: seller?.walletAddress || seller?.address || "",
    userId: seller?.userId || "",
    displayName: seller?.displayName || "Campus Seller",
    verifiedEmail: seller?.verifiedEmail || "",
    profileType: seller?.profileType || "wallet",
  };
}

function mapSnapshotToListing(snapshot) {
  const data = snapshot.data();
  const seller = normalizeSeller(data.seller || data.sellerAddress);

  return {
    id: snapshot.id,
    title: sanitizeTitle(data.title),
    price: Number(data.price || 0),
    description: data.description || "",
    category: data.category || "Misc",
    condition: data.condition || "Good",
    image: data.imageUrl || data.image || "📦",
    imageUrl: data.imageUrl || (isPhotoLike(data.image) ? data.image : ""),
    seller,
    ownerId: data.ownerId || seller.userId || "",
    sellerAddress: seller.walletAddress,
    buyerId: data.buyerId || "",
    isActive: data.isActive !== false,
    rating: Number(data.rating || 0),
    ratingCount: Number(data.ratingCount || 0),
    timestamp: data.timestamp || null,
    date: data.timestamp?.toDate?.()?.toISOString() || data.date || new Date().toISOString(),
  };
}

function listingsRef() {
  assertFirestoreReady();
  return collection(db, LISTINGS_COLLECTION);
}

export function subscribeToListings(onData, onError) {
  const ref = listingsRef();
  const q = query(ref, orderBy("timestamp", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(mapSnapshotToListing);
      onData(items);
    },
    (error) => {
      if (onError) onError(new Error(mapFirestoreReadError(error)));
    }
  );
}

export async function probeListingsReadAccess() {
  try {
    const ref = listingsRef();
    await withTimeout(
      getDocs(query(ref, limit(1))),
      8000,
      "Timed out while checking Firestore listing access."
    );
  } catch (error) {
    throw new Error(mapFirestoreReadError(error));
  }
}

export async function createListing(payload) {
  const ref = listingsRef();
  const seller = normalizeSeller(payload.seller || payload.sellerAddress);

  if (!auth?.currentUser?.uid) {
    throw new Error("Authentication not ready yet. Please wait 2-3 seconds and try listing again.");
  }

  const ownerId = payload.ownerId || seller.userId || "";
  if (!ownerId) {
    throw new Error("Missing ownerId for listing write.");
  }

  if (ownerId !== auth.currentUser.uid) {
    throw new Error("Auth mismatch detected. Refresh the page and retry.");
  }

  let imageUrl = payload.imageUrl || (isPhotoLike(payload.image) ? payload.image : "");
  if (!imageUrl && payload.photoFile) {
    imageUrl = await uploadListingPhoto(payload.photoFile, ownerId);
  }

  const docData = {
    title: sanitizeTitle(payload.title),
    price: Number(payload.price),
    description: payload.description,
    category: payload.category,
    condition: payload.condition || "Good",
    image: imageUrl || payload.image || "📦",
    imageUrl: imageUrl || "",
    seller,
    ownerId,
    sellerAddress: seller.walletAddress,
    buyerId: payload.buyerId || "",
    isActive: payload.isActive !== false,
    rating: Number(payload.rating || 0),
    ratingCount: Number(payload.ratingCount || 0),
    timestamp: serverTimestamp(),
    date: new Date().toISOString(),
  };

  try {
    const result = await withTimeout(
      addDoc(ref, docData),
      12000,
      "Listing request timed out. Check Firestore rules/network and try again."
    );
    return result.id;
  } catch (error) {
    throw new Error(mapFirestoreWriteError(error));
  }
}

export async function removeListing(listingId, requesterUserId) {
  assertFirestoreReady();
  const ref = doc(db, LISTINGS_COLLECTION, listingId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;

  const data = snapshot.data();
  const ownerId = data.ownerId || "";
  const ownerAddress = data.sellerAddress || data.seller?.walletAddress || "";

  if (!requesterUserId || (requesterUserId !== ownerId && requesterUserId !== ownerAddress)) {
    throw new Error("You can only delete your own listings.");
  }

  await deleteDoc(ref);
}

export async function markListingAsSold(listingId, buyerId) {
  assertFirestoreReady();
  await updateDoc(doc(db, LISTINGS_COLLECTION, listingId), {
    isActive: false,
    buyerId,
    soldAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateListing(listingId, updates, requesterUserId) {
  assertFirestoreReady();

  const ref = doc(db, LISTINGS_COLLECTION, listingId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    throw new Error("Listing not found.");
  }

  const ownerId = snapshot.data().ownerId || "";
  if (!requesterUserId || ownerId !== requesterUserId) {
    throw new Error("You can only modify your own listings.");
  }

  const payload = { ...updates, updatedAt: serverTimestamp() };
  await updateDoc(ref, payload);
}

export async function seedListingsIfEmpty(seedListings) {
  const ref = listingsRef();
  const firstItem = await getDocs(query(ref, limit(1)));
  if (!firstItem.empty) return;

  await Promise.all(seedListings.map((listing) => createListing(listing)));
}
