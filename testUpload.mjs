import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";

// .env values
const firebaseConfig = {
  apiKey: "AIzaSyA54RHx2eqejNeI8NA7XaUvX4FqvhyLyZI",
  authDomain: "campusbaazar-794b2.firebaseapp.com",
  projectId: "campusbaazar-794b2",
  storageBucket: "campusbaazar-794b2.firebasestorage.app",
  messagingSenderId: "283347240773",
  appId: "1:283347240773:web:7631d78bde04b8d0d7602c",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

async function test() {
  try {
    console.log("Signing in anonymously...");
    await signInAnonymously(auth);
    console.log("Logged in UID:", auth.currentUser.uid);

    const txt = Buffer.from("hello world");
    const fileRef = ref(storage, `listing-photos/${auth.currentUser.uid}/test.txt`);
    
    console.log("Uploading test file...");
    await uploadBytes(fileRef, txt);
    console.log("Upload SUCCESS!");

  } catch (error) {
    console.error("Upload FAILED:", error);
  }
  process.exit();
}

test();
