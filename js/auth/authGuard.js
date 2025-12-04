// js/auth/authGuard.js
import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

// --- LISTA BLANCA DE ADMINISTRADORES ---
// Solo estos correos podrán ver la pantalla. ¡Edítalo!
const ADMINS = [
    "nicolizaso@ejemplo.com", 
    "cliente@financiera.com"
];

const PROTECTED_REDIRECT = '/index.html'; // A dónde van los no autorizados

// 1. Ocultar todo el contenido inmediatamente para evitar "flashes" de información
document.body.style.display = 'none';

// 2. Verificar estado
onAuthStateChanged(auth, (user) => {
    if (user) {
        // A. El usuario está logueado, verificamos si es Admin
        if (ADMINS.includes(user.email)) {
            console.log("Acceso Autorizado: Admin detectado.");
            document.body.style.display = 'block'; // Mostramos la web
        } else {
            // B. Es usuario, pero NO admin. ¡Fuera!
            console.warn("Acceso Denegado: Usuario no es admin.");
            window.location.href = PROTECTED_REDIRECT;
        }
    } else {
        // C. No hay usuario logueado. ¡Fuera!
        console.warn("Acceso Denegado: No logueado.");
        window.location.href = '/login.html'; // O redirigir al login
    }
});