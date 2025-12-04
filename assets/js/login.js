import { auth, db } from './firebase-config.js'; // Importamos la config que creamos arriba
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc,
    query,
    collection,
    where,
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

// --- ELEMENTOS DEL DOM ---
const contenedor = document.getElementById('contenedorLogin');
const opcionesInicio = document.getElementById('opcionesInicio');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const btnVolver = document.getElementById('btnVolver');
const tituloHeader = document.getElementById('tituloHeader');
const popup = document.getElementById('popupMensaje');

// --- ESTADO INICIAL: REVISAR SI YA ESTÁ LOGUEADO ---
// Esto evita que el usuario tenga que loguearse cada vez que recarga
onAuthStateChanged(auth, async (user) => {
    if (user) {
        mostrarMensaje("Sesión activa, redirigiendo...", "success");
        await redirigirSegunRol(user.uid);
    } else {
        // Si no hay usuario, nos quedamos tranquilos en el login
        contenedor.classList.remove('hidden');
    }
});

// --- FUNCIONES DE NAVEGACIÓN UI ---
document.getElementById('btnMostrarLogin').addEventListener('click', () => {
    opcionesInicio.classList.add('hidden');
    loginForm.classList.remove('hidden');
    btnVolver.classList.remove('hidden');
    tituloHeader.innerText = "Iniciar Sesión";
});

document.getElementById('btnMostrarRegistro').addEventListener('click', () => {
    opcionesInicio.classList.add('hidden');
    registerForm.classList.remove('hidden');
    btnVolver.classList.remove('hidden');
    tituloHeader.innerText = "Crear Cuenta";
});

btnVolver.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    btnVolver.classList.add('hidden');
    opcionesInicio.classList.remove('hidden');
    tituloHeader.innerText = "Bienvenido";
});

// --- LÓGICA DE LOGIN ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identificador = document.getElementById('dniLogin').value.trim(); // Puede ser DNI o Email
    const password = document.getElementById('passwordLogin').value;

    try {
        let email = identificador;

        // Si el usuario ingresó un DNI (solo números), buscamos su email en Firestore
        if (/^\d+$/.test(identificador)) {
            email = await obtenerEmailPorDNI(identificador);
            if (!email) throw new Error("DNI no encontrado.");
        }

        // Autenticamos con Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // El onAuthStateChanged de arriba manejará la redirección, 
        // pero podemos forzar un feedback visual aquí.
        mostrarMensaje("Ingreso exitoso", "success");

    } catch (error) {
        console.error(error);
        let msg = "Error al ingresar.";
        if (error.code === 'auth/invalid-credential') msg = "Datos incorrectos.";
        if (error.message === "DNI no encontrado.") msg = "El DNI no está registrado.";
        mostrarMensaje(msg, "error");
    }
});

// --- LÓGICA DE REGISTRO (Solo Clientes) ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombreRegister').value.trim();
    const dni = document.getElementById('dniRegister').value.trim();
    const mail = document.getElementById('mailRegister').value.trim();
    const telefono = document.getElementById('telefonoRegister').value.trim();
    const password = document.getElementById('passwordRegister').value;

    try {
        // 1. Validar si el DNI ya existe en Firestore para evitar duplicados lógicos
        const dniExiste = await verificarDniExistente(dni);
        if (dniExiste) throw new Error("El DNI ya está registrado.");

        // 2. Crear usuario en Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, mail, password);
        const user = userCredential.user;

        // 3. Guardar datos adicionales en Firestore
        // IMPORTANTE: Definimos el rol como 'cliente' por defecto
        await setDoc(doc(db, "usuarios", user.uid), {
            nombre: nombre,
            dni: dni,
            mail: mail,
            telefono: telefono,
            rol: 'cliente', // <--- AQUÍ SE DEFINE EL ROL
            fechaRegistro: new Date().toISOString()
        });

        mostrarMensaje("Cuenta creada. Redirigiendo...", "success");
        // La redirección ocurrirá automáticamente por el onAuthStateChanged

    } catch (error) {
        console.error(error);
        let msg = "Error al registrarse.";
        if (error.code === 'auth/email-already-in-use') msg = "El correo ya está en uso.";
        if (error.message === "El DNI ya está registrado.") msg = error.message;
        mostrarMensaje(msg, "error");
    }
});

// --- HELPERS (Utilidades) ---

// Redirección inteligente basada en el rol
async function redirigirSegunRol(uid) {
    try {
        const docRef = doc(db, "usuarios", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.rol === 'admin') {
                window.location.href = '/admin/index.html';
            } else {
                window.location.href = '/cliente/index.html';
            }
        } else {
            // Caso borde: Usuario en Auth pero sin doc en Firestore
            mostrarMensaje("Error: Perfil de usuario no encontrado.", "error");
        }
    } catch (error) {
        console.error("Error al obtener rol:", error);
    }
}

// Buscar Email usando DNI (para permitir login con DNI)
async function obtenerEmailPorDNI(dni) {
    const q = query(collection(db, "usuarios"), where("dni", "==", dni));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data().mail;
    }
    return null;
}

// Verificar si DNI ya existe (para registro)
async function verificarDniExistente(dni) {
    const q = query(collection(db, "usuarios"), where("dni", "==", dni));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
}

function mostrarMensaje(texto, tipo = "neutral") {
    popup.innerText = texto;
    popup.className = ""; // Reset clases
    popup.classList.add(tipo); // 'success' o 'error'
    popup.classList.remove('hidden');
    
    setTimeout(() => {
        popup.classList.add('hidden');
    }, 3000);
}