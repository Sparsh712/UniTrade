import { useCallback, useEffect, useMemo, useState } from "react";
import { hasFirebaseConfig } from "../firebase/config";
import {
  createListing,
  markListingAsSold,
  probeListingsReadAccess,
  removeListing,
  seedListingsIfEmpty,
  subscribeToListings,
  updateListing,
} from "../services/listingsService";
import { INITIAL_LISTINGS } from "../data/seedListings";

export function useListings(userId) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let unsubscribe;
    let loadingTimer;
    let hasReceivedSnapshot = false;

    async function connectRealtimeFeed() {
      if (!hasFirebaseConfig) {
        setError("Missing Firebase environment variables. Firestore listings are disabled until config is provided.");
        setLoading(false);
        return;
      }

      loadingTimer = setTimeout(() => {
        if (!hasReceivedSnapshot) {
          setLoading(false);
          setError((prev) => prev || "Realtime listing sync is taking longer than expected. Check if Firestore API is enabled.");
        }
      }, 8000);

      try {
        await probeListingsReadAccess();
        unsubscribe = subscribeToListings(
          (items) => {
            hasReceivedSnapshot = true;
            if (loadingTimer) clearTimeout(loadingTimer);
            setListings(items);
            setLoading(false);
            setError("");

            if (items.length === 0 && userId) {
              seedListingsIfEmpty(INITIAL_LISTINGS).catch(() => {
                // Seed is best-effort and should not block realtime reads.
              });
            }
          },
          (snapshotError) => {
            hasReceivedSnapshot = true;
            if (loadingTimer) clearTimeout(loadingTimer);
            setError(snapshotError.message || "Failed to sync listings in real time.");
            setLoading(false);
          }
        );
      } catch (connectError) {
        if (loadingTimer) clearTimeout(loadingTimer);
        setError(connectError.message || "Could not connect to Firestore.");
        setLoading(false);
      }
    }

    connectRealtimeFeed();

    return () => {
      if (loadingTimer) clearTimeout(loadingTimer);
      if (unsubscribe) unsubscribe();
    };
  }, [userId]);

  const addListing = useCallback(async (listingInput) => {
    if (!userId) throw new Error("You must be signed in to create listings.");
    await createListing({ ...listingInput, ownerId: userId });
  }, [userId]);

  const deleteListing = useCallback(async (listingId) => {
    if (!userId) throw new Error("You must be signed in to delete listings.");
    await removeListing(listingId, userId);
  }, [userId]);

  const editListing = useCallback(async (listingId, updates) => {
    if (!userId) throw new Error("You must be signed in to update listings.");
    await updateListing(listingId, updates, userId);
  }, [userId]);

  const setListingSold = useCallback(async (listingId, buyerId) => {
    await markListingAsSold(listingId, buyerId);
  }, []);

  const hasListings = useMemo(() => listings.length > 0, [listings]);

  return {
    listings,
    loading,
    error,
    hasListings,
    addListing,
    deleteListing,
    editListing,
    setListingSold,
  };
}
