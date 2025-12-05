import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyByH3CP-mOFo7Sz07F0E1015GtzrhyDDFI",
    authDomain: "eureka-724e4.firebaseapp.com",
    projectId: "eureka-724e4",
    storageBucket: "eureka-724e4.appspot.com",
    messagingSenderId: "505365749268",
    appId: "1:505365749268:web:85565579899d3bff235101",
    measurementId: "G-VBGL25Z494"
};

const app = initializeApp(firebaseConfig);

// Exportamos los servicios para usarlos en toda la app
export const db = getFirestore(app);
export const auth = getAuth(app);
