// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; 


const firebaseConfig = {
  apiKey: "AIzaSyCIScTel5OABC3A4e0cv19QZBbCO2RchUI",
  authDomain: "ownly-protocol.firebaseapp.com",
  projectId: "ownly-protocol",
  storageBucket: "ownly-protocol.firebasestorage.app",
  messagingSenderId: "462314596286",
  appId: "1:462314596286:web:acd0ca3584e705cfb8bbef"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export const auth = getAuth(app);
export { db };