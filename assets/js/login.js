import { auth, db } from './firebase.js'; 
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
import { mostrarNotificacion } from './utils.js';

// --- ELEMENTOS DEL DOM ---
const contenedor = document.getElementById('contenedorLogin');
const opcionesInicio = document.getElementById('opcionesInicio');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const btnVolver = document.getElementById('btnVolver');
const tituloHeader = document.getElementById('tituloHeader');
const popup = document.getElementById('popupMensaje');

// --- ESTADO INICIAL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // ARQUITECTURA SÓLIDA: Buscamos directamente por UID.
        // Esto es instantáneo y seguro.
        const docRef = doc(db, "usuarios", user.uid);
        
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const userData = docSnap.data();
                mostrarNotificacion(`Hola ${userData.nombre.split(' ')[0]}, ingresando...`, "success");
                redirigirSegunRol(userData.rol);
            } else {
                console.warn("Usuario Auth existe, pero no tiene perfil en Firestore.");
                // Esto pasa solo si el registro falló a medias. 
                // Dejamos que el usuario vea el login para intentar de nuevo o contactar soporte.
                contenedor.classList.remove('hidden');
                mostrarNotificacion("Error de perfil. Contacte soporte.", "error");
            }
        } catch (error) {
            console.error("Error crítico leyendo perfil:", error);
            mostrarNotificacion("Error de conexión.", "error");
        }
    } else {
        // Nadie logueado, mostrar opciones
        contenedor.classList.remove('hidden');
    }
});

// --- NAVEGACIÓN UI ---
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
    tituloHeader.innerText = "Bienvenido/a";
});

// --- LOGIN ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identificador = document.getElementById('dniLogin').value.trim();
    const password = document.getElementById('passwordLogin').value;

    try {
        let email = identificador;
        // Si ingresó DNI, buscamos su mail
        if (/^\d+$/.test(identificador)) {
            email = await obtenerEmailPorDNI(identificador);
            if (!email) throw new Error("DNI no encontrado en el sistema.");
        }

        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged se encarga del resto

    } catch (error) {
        console.error("Login fallo:", error);
        let msg = "Error al ingresar.";
        if (error.code === 'auth/invalid-credential') msg = "Credenciales incorrectas.";
        if (error.message.includes("DNI")) msg = error.message;
        mostrarNotificacion(msg, "error");
    }
});

// --- REGISTRO ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const nombre = document.getElementById('nombreRegister').value.trim();
    const dni = document.getElementById('dniRegister').value.trim();
    const mail = document.getElementById('mailRegister').value.trim();
    const telefono = document.getElementById('telefonoRegister').value.trim();
    const password = document.getElementById('passwordRegister').value;

    if (!nombre || !dni || !mail || !password) {
        mostrarNotificacion("Completa todos los campos obligatorios.", "error");
        return;
    }

    try {
        mostrarNotificacion("Verificando datos...", "neutral");

        // 1. Validar unicidad del DNI
        const dniExiste = await verificarDniExistente(dni);
        if (dniExiste) throw new Error("El DNI ya está registrado.");

        // 2. Crear usuario en Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, mail, password);
        const user = userCredential.user;

        mostrarNotificacion("Creando perfil...", "neutral");

        // 3. Crear documento en Firestore usando el UID como llave maestra
        await setDoc(doc(db, "usuarios", user.uid), {
            nombre: nombre,
            dni: dni,
            mail: mail,
            telefono: telefono,
            rol: 'cliente', // Rol por defecto
            fechaRegistro: new Date().toISOString(),
            uid: user.uid // Redundancia útil
        });

        mostrarNotificacion("¡Cuenta creada con éxito!", "success");
        
        // Redirección forzada por seguridad UX
        setTimeout(() => {
            window.location.href = '../cliente/index.html';
        }, 1500);

    } catch (error) {
        console.error("Error Registro:", error);
        let msg = "No se pudo registrar.";
        if (error.code === 'auth/email-already-in-use') msg = "El email ya está en uso.";
        if (error.message.includes("DNI")) msg = error.message;
        mostrarNotificacion(msg, "error");
    }
});

// --- HELPERS ---

function redirigirSegunRol(rol) {
    if (rol === 'admin') {
        window.location.href = '../admin/index.html';
    } else {
        window.location.href = '../cliente/index.html';
    }
}

async function obtenerEmailPorDNI(dni) {
    const q = query(collection(db, "usuarios"), where("dni", "==", dni));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data().mail;
    }
    return null;
}

async function verificarDniExistente(dni) {
    const q = query(collection(db, "usuarios"), where("dni", "==", dni));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
}