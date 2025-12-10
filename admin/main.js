import { auth, db } from '../assets/js/firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { formatearMoneda } from '../assets/js/utils.js'; // Asegúrate de tener utils.js

// --- 1. AUTH GUARD (SEGURIDAD) ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../login.html';
        return;
    }
    // Verificamos rol
    const docSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (!docSnap.exists() || docSnap.data().rol !== 'admin') {
        alert("Acceso denegado: Se requiere permiso de Administrador.");
        window.location.href = '../cliente/index.html'; // Lo mandamos al cliente
    } else {
        document.getElementById('adminName').textContent = docSnap.data().nombre || 'Admin';
        console.log("Admin autenticado");
    }
});

// --- 2. BUSCADOR INTELIGENTE ---
const btnBuscar = document.getElementById('btnBuscar');
const inputBuscador = document.getElementById('inputBuscador');
const listaResultados = document.getElementById('listaResultados');

// Buscar al presionar Enter
inputBuscador.addEventListener('keyup', (e) => {
    if(e.key === 'Enter') realizarBusqueda();
});
btnBuscar.addEventListener('click', realizarBusqueda);

async function realizarBusqueda() {
    const termino = inputBuscador.value.trim().toLowerCase();
    if (termino.length < 2) return; // Mínimo 2 letras

    listaResultados.innerHTML = '<div style="padding:10px; color:#666">Buscando...</div>';
    listaResultados.classList.remove('hidden');

    try {
        // Traemos todo (Para MVP está bien, luego optimizamos con índices)
        const snap = await getDocs(collection(db, "solicitudes"));
        
        const resultados = [];
        snap.forEach(doc => {
            const data = doc.data();
            // Buscamos coincidencia en nombre, dni o carpeta
            if (
                (data.nombre && data.nombre.toLowerCase().includes(termino)) ||
                (data.dni && data.dni.includes(termino)) ||
                (data.carpeta && data.carpeta.toString().includes(termino))
            ) {
                resultados.push({ id: doc.id, ...data });
            }
        });

        renderResultados(resultados);

    } catch (e) {
        console.error(e);
        listaResultados.innerHTML = '<div style="padding:10px; color:red">Error al buscar.</div>';
    }
}

function renderResultados(lista) {
    listaResultados.innerHTML = '';
    
    if (lista.length === 0) {
        listaResultados.innerHTML = '<div style="padding:10px;">No se encontraron resultados.</div>';
        return;
    }

    lista.forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-item';
        // Estado colorizado simple
        const colorEstado = item.estado === 'Activa' ? '#2e7d32' : (item.estado === 'Pendiente' ? '#f57f17' : '#c62828');
        
        div.innerHTML = `
            <div class="result-main">
                <span>${item.nombre}</span>
                <span style="color:${colorEstado}; font-size:0.8rem; border:1px solid ${colorEstado}; padding:2px 5px; border-radius:4px;">
                    ${item.estado || 'ACTIVA'}
                </span>
            </div>
            <div class="result-sub">
                Carpeta #${item.carpeta} • ${formatearMoneda(item.capital)} • DNI: ${item.dni}
            </div>
        `;
        
        // Click para abrir editor (Lo implementaremos en el siguiente paso)
        div.addEventListener('click', () => alert('Próximamente: Abrir editor para carpeta ' + item.carpeta));
        
        listaResultados.appendChild(div);
    });
}

// --- LOGOUT ---
document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = '../login.html');
});