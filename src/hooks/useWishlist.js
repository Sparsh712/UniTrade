/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import { hasFirebaseConfig } from "../firebase/config";
import { setWishlistItem, subscribeToUserWishlist } from "../services/wishlistService";

export function useWishlist(userId) {
  const [wishlistIds, setWishlistIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      setWishlistIds([]);
      setLoading(false);
      return;
    }

    if (!hasFirebaseConfig) {
      setError("Missing Firebase environment variables. Firestore wishlist is disabled.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserWishlist(
      userId,
      (ids) => {
        setWishlistIds(ids);
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message || "Failed to sync wishlist in real time.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const toggleWishlist = useCallback(
    async (listingId) => {
      const shouldInclude = !wishlistIds.includes(listingId);
      await setWishlistItem(userId, listingId, shouldInclude);
    },
    [wishlistIds, userId]
  );

  const count = useMemo(() => wishlistIds.length, [wishlistIds.length]);

  return {
    wishlistIds,
    loading,
    error,
    count,
    toggleWishlist,
  };
}
