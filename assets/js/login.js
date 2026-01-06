import { auth, db } from './firebase.js'; 
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc,
    query,
    collection,
    where,
    getDocs,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { mostrarNotificacion } from './utils.js';

// --- 1. ELEMENTOS DEL DOM ---
const contenedor = document.getElementById('contenedorLogin');
const opcionesInicio = document.getElementById('opcionesInicio');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const btnVolver = document.getElementById('btnVolver');
const tituloHeader = document.getElementById('tituloHeader');

// --- 2. ESTADO INICIAL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "usuarios", user.uid);
        let docSnap = null;
        let intentos = 0;
        
        try {
            docSnap = await getDoc(docRef);
            
            // Polling por si la migración demora
            while (!docSnap.exists() && intentos < 3) {
                console.log(`Esperando perfil... (${intentos+1})`);
                await new Promise(r => setTimeout(r, 1000));
                docSnap = await getDoc(docRef);
                intentos++;
            }

            if (docSnap.exists()) {
                const userData = docSnap.data();
                // FIX ROL: Si no tiene rol, asumimos cliente
                const userRol = userData.rol ? userData.rol.toLowerCase() : 'cliente';
                
                if (userRol === 'cliente' || userRol === 'admin') {
                    mostrarNotificacion(`Hola ${userData.nombre ? userData.nombre.split(' ')[0] : 'Inversor'}, ingresando...`, "success");
                    redirigirSegunRol(userRol);
                } else {
                    await signOut(auth);
                    mostrarNotificacion("Acceso no autorizado.", "error");
                    if(contenedor) contenedor.classList.remove('hidden');
                }
            } else {
                console.warn("Error de sincronización. Cerrando sesión...");
                await signOut(auth);
                mostrarNotificacion("Error al cargar perfil. Intente nuevamente.", "error");
                if(contenedor) contenedor.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error lectura:", error);
            await signOut(auth);
            if(contenedor) contenedor.classList.remove('hidden');
        }
    } else {
        if(contenedor) contenedor.classList.remove('hidden');
    }
});

// --- 3. NAVEGACIÓN UI ---
document.getElementById('btnMostrarLogin')?.addEventListener('click', () => {
    opcionesInicio.classList.add('hidden');
    loginForm.classList.remove('hidden');
    btnVolver.classList.remove('hidden');
    tituloHeader.innerText = "Iniciar Sesión";
});

document.getElementById('btnMostrarRegistro')?.addEventListener('click', () => {
    opcionesInicio.classList.add('hidden');
    registerForm.classList.remove('hidden');
    btnVolver.classList.remove('hidden');
    tituloHeader.innerText = "Crear Cuenta";
});

btnVolver?.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    btnVolver.classList.add('hidden');
    opcionesInicio.classList.remove('hidden');
    tituloHeader.innerText = "Bienvenido/a";
});

// --- 4. LOGIN CON MIGRACIÓN ---
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identificador = document.getElementById('dniLogin').value.trim();
    const password = document.getElementById('passwordLogin').value; // Ojo: A veces el usuario escribe espacios sin querer

    let email = identificador;

    try {
        mostrarNotificacion("Ingresando...", "neutral");

        if (/^\d+$/.test(identificador)) {
            email = await obtenerEmailPorDNI(identificador);
            if (!email) throw { code: 'auth/user-not-found' }; 
        }

        await signInWithEmailAndPassword(auth, email, password);

    } catch (error) {
        console.log("Fallo login standard, verificando migración...", error.code);

        if (error.code === 'auth/invalid-credential' || 
            error.code === 'auth/user-not-found' || 
            error.code === 'auth/invalid-email' || 
            error.code === 'auth/wrong-password' ||
            !email) {
            
            try {
                // Pasamos la contraseña tal cual la escribió el usuario
                const resultado = await intentarMigracionLegacy(identificador, password);
                if (resultado) return; 
            } catch (migracionError) {
                console.error("Fallo migración:", migracionError);
            }
        }

        let msg = "Error al ingresar.";
        if (error.code === 'auth/invalid-credential') msg = "Datos incorrectos.";
        mostrarNotificacion(msg, "error");
    }
});

// --- 5. REGISTRO ---
registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const nombre = document.getElementById('nombreRegister').value.trim();
    const dni = document.getElementById('dniRegister').value.trim();
    const mail = document.getElementById('mailRegister').value.trim();
    const telefono = document.getElementById('telefonoRegister').value.trim();
    const password = document.getElementById('passwordRegister').value;

    try {
        mostrarNotificacion("Verificando...", "neutral");
        const dniExiste = await verificarDniExistente(dni);
        if (dniExiste) throw new Error("El DNI ya está registrado.");

        const userCredential = await createUserWithEmailAndPassword(auth, mail, password);
        const user = userCredential.user;

        mostrarNotificacion("Creando perfil...", "neutral");

        await setDoc(doc(db, "usuarios", user.uid), {
            nombre: nombre,
            dni: dni,
            mail: mail,
            telefono: telefono,
            rol: 'cliente',
            fechaRegistro: new Date().toISOString(),
            uid: user.uid
        });

        mostrarNotificacion("¡Cuenta creada!", "success");
        setTimeout(() => { window.location.href = '../cliente/index.html'; }, 1500);

    } catch (error) {
        let msg = "Error registro.";
        if (error.code === 'auth/email-already-in-use') msg = "Email en uso.";
        if (error.message.includes("DNI")) msg = error.message;
        mostrarNotificacion(msg, "error");
    }
});

// --- HELPERS ---

function redirigirSegunRol(rol) {
    if (rol === 'admin') window.location.href = '../admin/index.html';
    else window.location.href = '../cliente/index.html';
}

async function obtenerEmailPorDNI(dni) {
    const q = query(collection(db, "usuarios"), where("dni", "==", dni));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) return querySnapshot.docs[0].data().mail;
    return null;
}

async function verificarDniExistente(dni) {
    const q = query(collection(db, "usuarios"), where("dni", "==", dni));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
}

// --- MIGRACIÓN ROBUSTA (Trim + Fix Rol) ---
async function intentarMigracionLegacy(identificadorInput, passwordIngresada) {
    let q;
    let emailParaAuth = identificadorInput;

    if (/^\d+$/.test(identificadorInput)) {
        q = query(collection(db, "usuarios"), where("dni", "==", identificadorInput));
    } else {
        q = query(collection(db, "usuarios"), where("mail", "==", identificadorInput));
    }

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        console.log("Migración: Usuario no encontrado en DB antigua.");
        return false;
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    // Evitar re-migrar si ya tiene flags (aunque haya fallado el auth)
    if (userData.migrado && userData.uid) {
         console.log("Migración: Usuario ya marcado como migrado.");
         // Si llega acá es porque la contraseña en Auth no coincide con la que puso ahora.
         return false;
    }

    if (!emailParaAuth.includes('@')) emailParaAuth = userData.mail;

    // --- AQUÍ ESTÁ EL TRUCO DEL TRIM ---
    const dbPass = String(userData.password || userData.contrasenia || userData.clave || '').trim();
    const inputPass = String(passwordIngresada).trim();

    // Verificamos si coinciden (ignorando espacios)
    if (dbPass === inputPass) {
        mostrarNotificacion("Actualizando seguridad de la cuenta...", "neutral");
        
        // 1. Crear Auth
        const userCredential = await createUserWithEmailAndPassword(auth, emailParaAuth, inputPass);
        const user = userCredential.user;

        // 2. Crear documento NUEVO (Clonación + FIX ROL)
        await setDoc(doc(db, "usuarios", user.uid), {
            ...userData,       
            uid: user.uid,     
            migrado: true,
            fechaMigracion: new Date().toISOString(),
            rol: userData.rol || 'cliente', // <--- ESTO EVITA EL "ACCESO NO AUTORIZADO"
            password: null 
        });

        // 3. Actualizar documento VIEJO
        await updateDoc(doc(db, "usuarios", userDoc.id), {
            migrado: true,
            nuevoUid: user.uid
        });
        
        mostrarNotificacion("¡Cuenta actualizada!", "success");
        await new Promise(r => setTimeout(r, 1500));
        window.location.href = '../cliente/index.html';
        return true;
    } else {
        console.warn("Migración: Contraseñas no coinciden (DB vs Input).");
        // Consejo: Si sigue fallando, descomenta la siguiente línea para ver qué llega:
        // console.log("DB:", dbPass, "Input:", inputPass);
    }
    return false;
}