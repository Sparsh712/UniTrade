import {
  arrayRemove,
  arrayUnion,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";

const WISHLIST_COLLECTION = "wishlists";

function assertFirestoreReady() {
  if (!db) {
    throw new Error("Firestore is not initialized. Add Firebase env variables to enable real-time wishlist.");
  }
}

function wishlistDocRef(userId) {
  assertFirestoreReady();
  return doc(db, WISHLIST_COLLECTION, userId);
}

export function subscribeToUserWishlist(userId, onData, onError) {
  const ref = wishlistDocRef(userId);

  return onSnapshot(
    ref,
    (snapshot) => {
      const data = snapshot.data();
      onData(Array.isArray(data?.listingIds) ? data.listingIds : []);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function setWishlistItem(userId, listingId, shouldInclude) {
  const ref = wishlistDocRef(userId);
  const operation = shouldInclude ? arrayUnion(listingId) : arrayRemove(listingId);

  await setDoc(
    ref,
    {
      userId,
      listingIds: operation,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
