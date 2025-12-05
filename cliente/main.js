import { auth, db } from '../assets/js/firebase.js'; // Importación correcta subiendo un nivel
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { formatearMoneda, formatearFecha, formatearPorcentaje } from '../assets/js/utils.js'; // Crearemos este helper después, o usa las locales por ahora

// --- 1. AUTH GUARD & INICIALIZACIÓN ---
let usuarioActual = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../login.html'; // Expulsar si no hay sesión
    } else {
        // Verificar rol
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().rol === 'cliente') {
            usuarioActual = { uid: user.uid, ...docSnap.data() };
            initDashboard();
        } else {
            // Si es admin intentando entrar aquí, o un usuario sin rol
            window.location.href = '../login.html';
        }
    }
});

// --- 2. FUNCIONES PRINCIPALES ---
async function initDashboard() {
    document.getElementById('nombreUsuario').textContent = usuarioActual.nombre.split(' ')[0];
    cargarDatosPerfil();
    await cargarInversiones();
}

function cargarDatosPerfil() {
    document.getElementById('perfilNombre').value = usuarioActual.nombre || '';
    document.getElementById('perfilMail').value = usuarioActual.mail || '';
    document.getElementById('perfilTelefono').value = usuarioActual.telefono || '';
}

// --- 3. LÓGICA DE INVERSIONES ---
async function cargarInversiones() {
    const solicitudesTotales = [];
    const tablaDesktop = document.querySelector('#tablaInversiones tbody');
    const listaMobile = document.getElementById('listaInversionesMobile');
    const seccionCalendario = document.getElementById('seccionCalendario');
    
    tablaDesktop.innerHTML = "";
    listaMobile.innerHTML = "";

    try {
        // A. Buscar carpetas vinculadas en subcolección
        const vinculadasRef = collection(db, `usuarios/${usuarioActual.uid}/carpetasVinculadas`);
        const vinculadasSnap = await getDocs(vinculadasRef);
        
        // B. Buscar carpetas por DNI (Legacy support)
        const qDni = query(collection(db, "solicitudes"), where("dni", "==", usuarioActual.dni));
        const dniSnap = await getDocs(qDni);

        // Unificar IDs de carpetas para no duplicar
        const idsCarpetas = new Set();
        
        // Procesar vinculadas
        for (const docV of vinculadasSnap.docs) {
            // Buscamos la solicitud real usando el numero de carpeta guardado
            const qCarpeta = query(collection(db, "solicitudes"), where("carpeta", "==", docV.data().carpeta));
            const match = await getDocs(qCarpeta);
            match.forEach(m => idsCarpetas.add(m.id));
        }
        
        // Procesar por DNI
        dniSnap.forEach(d => idsCarpetas.add(d.id));

        // C. Obtener data real y reingresos
        for (const idSolicitud of idsCarpetas) {
            const solRef = doc(db, "solicitudes", idSolicitud);
            const solSnap = await getDoc(solRef);
            const data = solSnap.data();
            
            // Obtener reingresos (subcolección)
            const reingresosSnap = await getDocs(collection(solRef, "reingresos"));
            const reingresos = reingresosSnap.docs.map(r => r.data());
            
            solicitudesTotales.push({ ...data, reingresos, id: solSnap.id });
        }

        // Ordenar por fecha reciente
        solicitudesTotales.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (solicitudesTotales.length === 0) {
            document.getElementById('mensajeSinInversiones').classList.remove('hidden');
            seccionCalendario.classList.add('hidden');
            return;
        }

        // Renderizar Tablas
        solicitudesTotales.forEach(s => {
            // Render Desktop
            const row = tablaDesktop.insertRow();
            row.innerHTML = `
                <td>${formatearMoneda(s.capital)}</td>
                <td>${s.periodos} meses</td>
                <td>${formatearPorcentaje(s.ganancia)}</td>
                <td>${s.unidad || '-'}</td>
                <td>${formatearFecha(s.fecha)}</td>
                <td><strong>${s.carpeta}</strong></td>
            `;

            // Render Reingresos Desktop
            if (s.reingresos?.length) {
                s.reingresos.forEach(r => {
                    const subRow = tablaDesktop.insertRow();
                    subRow.className = "reingreso-row";
                    subRow.innerHTML = `
                        <td>+ ${formatearMoneda(r.capital)}</td>
                        <td colspan="2">Reingreso (Tasa: ${formatearPorcentaje(r.tasa)})</td>
                        <td>-</td>
                        <td>${formatearFecha(r.fecha)}</td>
                        <td>↳</td>
                    `;
                });
            }

            // Render Mobile (Simplificado)
            const cardMobile = document.createElement('div');
            cardMobile.className = 'card';
            cardMobile.style.marginBottom = '10px';
            cardMobile.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-weight:bold;">
                    <span>Carpeta ${s.carpeta}</span>
                    <span>${formatearMoneda(s.capital)}</span>
                </div>
                <div style="font-size:0.9rem; color:#666; margin-top:5px;">
                    ${formatearFecha(s.fecha)} • ${s.ganancia}%
                </div>
            `;
            listaMobile.appendChild(cardMobile);
        });

        // D. Generar Calendario
        generarCalendario(solicitudesTotales);
        seccionCalendario.classList.remove('hidden');

    } catch (error) {
        console.error("Error cargando inversiones:", error);
    }
}

// --- 4. VINCULACIÓN DE CARPETAS ---
document.getElementById('btnAgregarCarpeta').addEventListener('click', () => {
    document.getElementById('formVincularCarpeta').classList.toggle('hidden');
});

document.getElementById('btnBuscarCarpeta').addEventListener('click', async () => {
    const input = document.getElementById('inputNumeroCarpeta');
    const numero = input.value.trim();
    const resultadoDiv = document.getElementById('resultadoBusqueda');
    
    if (!numero) return;
    
    const q = query(collection(db, "solicitudes"), where("carpeta", "==", numero));
    const snap = await getDocs(q);

    if (snap.empty) {
        resultadoDiv.innerHTML = '<p style="color:red; margin-top:10px;">Carpeta no encontrada</p>';
    } else {
        const data = snap.docs[0].data();
        resultadoDiv.innerHTML = `
            <div style="margin-top:10px; padding:10px; background:white; border-radius:4px;">
                <p><strong>Encontrada:</strong> Capital ${formatearMoneda(data.capital)}</p>
                <button id="btnConfirmarVinculo" class="btn-small" style="margin-top:5px;">Vincular a mi cuenta</button>
            </div>
        `;
        
        document.getElementById('btnConfirmarVinculo').addEventListener('click', async () => {
            try {
                // Guardar en subcolección del usuario
                await setDoc(doc(collection(db, `usuarios/${usuarioActual.uid}/carpetasVinculadas`)), {
                    carpeta: numero,
                    fechaVinculacion: new Date().toISOString()
                });
                alert("Carpeta vinculada con éxito");
                input.value = "";
                resultadoDiv.innerHTML = "";
                document.getElementById('formVincularCarpeta').classList.add('hidden');
                cargarInversiones(); // Recargar todo
            } catch (e) {
                alert("Error al vincular: " + e.message);
            }
        });
    }
});

// --- 5. CALENDARIO Y UTILS ---
// (Aquí pegas tu lógica de generarCalendarioDePagos que ya tenías, adaptada para usar 'db' importado)
// Te he resumido esta parte, si necesitas la función completa de calendario pídela, 
// pero es básicamente copiar la de tu archivo anterior y asegurarse de usar los selectores correctos.
async function generarCalendario(solicitudes) {
    // ... Tu lógica de calendario aquí ...
    // Asegúrate de limpiar el tbody antes de agregar filas
}

// --- 6. EVENTOS GLOBALES ---
document.getElementById('btnCerrarSesion').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = '../login.html');
});

document.getElementById('btnEditarPerfil').addEventListener('click', () => {
    document.getElementById('seccionPerfil').classList.toggle('hidden');
});

// --- HELPERS INTERNOS (Si no creas utils.js) ---
function formatearMoneda(valor) {
    if (!valor) return '-';
    // Limpieza básica si viene como string sucio
    const num = parseFloat(valor.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
    return isNaN(num) ? valor : `USD ${Math.round(num).toLocaleString('de-DE')}`;
}
function formatearPorcentaje(valor) { return valor ? `${valor}%` : '-'; }