// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyB3kh9vwuh7Ue8XsaEaB3YskoweufPjV98",
  authDomain: "pos-system-c3b3a.firebaseapp.com",
  projectId: "pos-system-c3b3a",
  storageBucket: "pos-system-c3b3a.firebasestorage.app",
  messagingSenderId: "500696839568",
  appId: "1:500696839568:web:5db8fd395586fc9eb9af15",
  measurementId: "G-04JDVG65G6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const db = getFirestore()
export const auth = getAuth(app)
