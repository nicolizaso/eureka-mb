// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyByH3CP-mOFo7Sz07F0E1015GtzrhyDDFI",
    authDomain: "eureka-724e4.firebaseapp.com",
    projectId: "eureka-724e4",
    storageBucket: "eureka-724e4.appspot.com",
    messagingSenderId: "505365749268",
    appId: "1:505365749268:web:85565579899d3bff235101",
    measurementId: "G-VBGL25Z494"
};

// Inicializamos una sola vez para toda la app
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Exportamos para usar en otros archivos
export { db, auth };