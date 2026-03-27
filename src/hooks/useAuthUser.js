import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, hasFirebaseConfig } from "../firebase/config";

function formatAuthErrorMessage(authError) {
  const code = authError?.code || "";

  if (code === "auth/configuration-not-found") {
    return "Firebase Auth is not configured. Enable Authentication -> Anonymous sign-in in Firebase Console.";
  }

  if (code === "auth/operation-not-allowed") {
    return "Anonymous sign-in is disabled for this Firebase project. Enable it in Authentication settings.";
  }

  if (code === "auth/invalid-api-key") {
    return "Firebase API key is invalid. Verify VITE_FIREBASE_API_KEY in your .env file.";
  }

  return authError?.message || "Authentication failed.";
}

export function useAuthUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      setError("Missing Firebase configuration. Authentication is unavailable.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (nextUser) => {
        try {
          if (!nextUser) {
            const authResult = await signInAnonymously(auth);
            if (authResult?.user) {
              setUser(authResult.user);
              setError("");
            }
            return;
          }

          setUser(nextUser);
          setError("");
        } catch (authError) {
          setError(formatAuthErrorMessage(authError));
          setUser(null);
        } finally {
          setLoading(false);
        }
      },
      (listenerError) => {
        setError(formatAuthErrorMessage(listenerError));
        setUser(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { user, loading, error };
}
