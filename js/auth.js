// ------------------------ auth.js ---------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// ------------------ Firebase Configuration ------------------ 

const firebaseConfig = {
  apiKey: "AIzaSyAhpo0Qg4GTgomPPxra6B-1MXOY3mmhHgY",
  authDomain: "viscaraiassist-5e2c5.firebaseapp.com",
  projectId: "viscaraiassist-5e2c5",
  storageBucket: "viscaraiassist-5e2c5.appspot.com",
  messagingSenderId: "19772791247",
  appId: "1:19772791247:web:0362505efcf02269785aba"
};

// ------------------ Init Firebase ------------------ 
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// ------------------ Authentication Helpers ------------------ 
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const ud = await getUserDoc(user.uid);
      callback(user, ud);
    } else {
      callback(null, null);
    }
  });
}

// --------- This create user doc if not exists ---------
export async function createUserDocIfNotExists(user) {
  if (!user) return;
  const uRef = doc(db, "users", user.uid);
  const snap = await getDoc(uRef);

  if (!snap.exists()) {
    const docData = {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      goals: null,
      skills: [],
      strengths: []
    };
    await setDoc(uRef, docData);
    return docData;
  }
  return snap.data();
}

export async function getUserDoc(uid) {
  try {
    const uRef = doc(db, "users", uid);
    const snap = await getDoc(uRef);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("getUserDoc:", e);
    return null;
  }
}

// -------- Signing up with email --------
export async function signUpWithEmailPassword(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // -------- If displayName provided set it ---------
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }

  // ---------- If there is no profile picture of the user then a default avatar is set -----------
  if (!cred.user.photoURL) {
    await updateProfile(cred.user, {
      photoURL: "/assets/avatar-placeholder.png"
    });
  }

  await createUserDocIfNotExists(cred.user);
  return cred.user;
}

// -------- Email sign-in --------
export async function signInWithEmailPassword(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  // -------- This ensure returning users also have a photoURL ---------
  if (!cred.user.photoURL) {
    await updateProfile(cred.user, {
      photoURL: "/assets/avatar-placeholder.png"
    });
  }

  await createUserDocIfNotExists(cred.user);
  return cred.user;
}


// -------- signing-in with Google verification --------
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  await createUserDocIfNotExists(result.user);
  return result.user;
}

// -------- This is for sign out --------
export async function signOutUser() {
  await signOut(auth);
}

// --------This uploads profile photo to Cloudinary ---------
export async function uploadProfilePhoto(fileOrBlob) {
  const cloudName = "dcvmnm5ly";
  const unsignedPreset = "unsigned_profile_upload";

  const formData = new FormData();
  formData.append("file", fileOrBlob);
  formData.append("upload_preset", unsignedPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Cloudinary upload failed");
  }

  const data = await res.json();
  return data.secure_url; 
}


// -------- This exports authentication, database and storage for direct access if needed ---------
export { auth, db, storage };
