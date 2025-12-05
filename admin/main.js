import { auth, db } from '../assets/js/firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { 
    collection, getDocs, doc, getDoc, updateDoc, query, where, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { formatearMoneda, formatearFecha, formatearPorcentaje } from '../assets/js/utils.js';

let solicitudActiva = null;
let cuotasMap = {}; // Caché de cuotas para no leer DB excesivamente

// --- 1. AUTH GUARD (SEGURIDAD) ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../login.html';
        return;
    }
    const docUser = await getDoc(doc(db, "usuarios", user.uid));
    if (!docUser.exists() || docUser.data().rol !== 'admin') {
        alert("Acceso denegado.");
        window.location.href = '../cliente/';
    } else {
        console.log("Admin autenticado");
        cargarCuotasGlobales(); // Precarga cuotas para agilizar cálculos
    }
});

// --- 2. BÚSQUEDA ---
const buscadorInput = document.getElementById('buscadorInput');
buscadorInput.addEventListener('keyup', async (e) => {
    const termino = e.target.value.toLowerCase().trim();
    if (termino.length < 2) return; // No buscar con 1 letra

    // Buscamos en 'solicitudes' (Firestore no tiene búsqueda "contains" nativa potente,
    // traemos todo y filtramos en cliente si son pocos datos, o usamos índices específicos.
    // Para MVP, asumimos volumen moderado y traemos colección).
    // *Optimización Vector*: Si crece mucho, necesitarás Algolia o ElasticSearch.
    
    const snap = await getDocs(collection(db, "solicitudes")); 
    const resultados = snap.docs
        .map(d => ({id: d.id, ...d.data()}))
        .filter(s => 
            (s.carpeta && s.carpeta.toString().includes(termino)) ||
            (s.nombre && s.nombre.toLowerCase().includes(termino)) ||
            (s.dni && s.dni.includes(termino))
        );
    
    renderResultados(resultados);
});

function renderResultados(lista) {
    const contenedor = document.getElementById('vistaResultados');
    contenedor.innerHTML = '';
    
    if (lista.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; color:#888">No se encontraron carpetas.</p>';
        return;
    }

    lista.forEach(s => {
        const div = document.createElement('div');
        div.className = 'card-resultado';
        div.innerHTML = `
            <div class="res-header">
                <span>${s.nombre}</span>
                <span>Carpeta #${s.carpeta}</span>
            </div>
            <div class="res-sub">
                ${formatearMoneda(s.capital)} • ${s.periodos} meses • ${s.ganancia}%
            </div>
        `;
        div.addEventListener('click', () => cargarDetalle(s));
        contenedor.appendChild(div);
    });
}

// --- 3. DETALLE Y EDICIÓN ---
async function cargarDetalle(solicitud) {
    solicitudActiva = solicitud;
    
    // UI Switch
    document.getElementById('vistaResultados').classList.add('hidden');
    document.getElementById('vistaDetalle').classList.remove('hidden');
    document.getElementById('buscadorInput').parentElement.classList.add('hidden');

    // Llenar datos
    document.getElementById('detalleNombre').textContent = solicitud.nombre;
    document.getElementById('dispCarpeta').textContent = solicitud.carpeta;
    document.getElementById('dispCapital').textContent = formatearMoneda(solicitud.capital);
    document.getElementById('dispGanancia').textContent = formatearPorcentaje(solicitud.ganancia);
    document.getElementById('dispPeriodos').textContent = solicitud.periodos;
    document.getElementById('inputComentario').value = solicitud.comentario || '';

    // Llenar inputs de edición (ocultos por defecto)
    document.getElementById('inputCapital').value = solicitud.capital;
    document.getElementById('inputGanancia').value = solicitud.ganancia;
    document.getElementById('inputPeriodos').value = solicitud.periodos;

    renderCalendario(solicitud);
}

// --- 4. LÓGICA DE CALENDARIO (Porting del código legacy) ---
function renderCalendario(solicitud) {
    const tbody = document.querySelector('#tablaPagos tbody');
    tbody.innerHTML = '';
    
    const pagos = calcularPagosPuros(solicitud);
    const hoyKey = new Date().toISOString().slice(0, 7); // YYYY-MM

    pagos.forEach(p => {
        const row = document.createElement('tr');
        const esPasado = p.key < hoyKey;
        const esActual = p.key === hoyKey;
        
        row.className = esPasado ? 'pago-pasado' : (esActual ? 'pago-actual' : 'pago-futuro');
        
        // Formateo de fecha legible
        const [anio, mes] = p.key.split('-');
        const fechaLegible = `${mes}/${anio}`;

        row.innerHTML = `
            <td>${fechaLegible}</td>
            <td>${p.esCapital ? 'Devolución Capital' : 'Rendimiento Mensual'}</td>
            <td>${formatearMoneda(p.monto)}</td>
            <td>${esPasado ? 'Pagado' : (esActual ? 'En curso' : 'Pendiente')}</td>
        `;
        tbody.appendChild(row);
    });
}

function calcularPagosPuros(solicitud) {
    const pagos = [];
    const { capital, ganancia, periodos, fecha } = solicitud;
    
    const cap = parseFloat(capital);
    const g = parseFloat(ganancia) / 100;
    const mensual = cap * g;
    const [y, m, d] = fecha.split('-').map(Number);
    const fIngreso = new Date(y, m - 1, d);

    for (let i = 0; i < parseInt(periodos); i++) {
        const fPago = new Date(fIngreso.getFullYear(), fIngreso.getMonth() + i + 1, 1);
        const key = `${fPago.getFullYear()}-${String(fPago.getMonth() + 1).padStart(2, '0')}`;
        
        // Ajuste primer mes (prorrateo simple si fuera necesario, aquí simplificado)
        pagos.push({ key, monto: mensual, esCapital: false });
    }
    
    // Devolución final
    const fDevol = new Date(fIngreso.getFullYear(), fIngreso.getMonth() + parseInt(periodos) + 1, 1);
    const keyDev = `${fDevol.getFullYear()}-${String(fDevol.getMonth() + 1).padStart(2, '0')}`;
    pagos.push({ key: keyDev, monto: cap, esCapital: true });

    return pagos;
}

// --- 5. GESTIÓN DE BOTONES (EDITAR / GUARDAR / SALIR) ---
document.getElementById('btnEditar').addEventListener('click', () => {
    document.body.classList.add('edit-mode'); // Opcional para CSS
    toggleEditMode(true);
});

document.getElementById('btnCancelar').addEventListener('click', () => {
    toggleEditMode(false);
});

document.getElementById('btnGuardar').addEventListener('click', async () => {
    try {
        const nuevoCap = parseFloat(document.getElementById('inputCapital').value);
        const nuevaGan = parseFloat(document.getElementById('inputGanancia').value);
        const nuevosPer = parseInt(document.getElementById('inputPeriodos').value);

        await updateDoc(doc(db, "solicitudes", solicitudActiva.id), {
            capital: nuevoCap,
            ganancia: nuevaGan,
            periodos: nuevosPer
        });

        alert("Actualizado correctamente");
        
        // Actualizar objeto local y vista
        solicitudActiva.capital = nuevoCap;
        solicitudActiva.ganancia = nuevaGan;
        solicitudActiva.periodos = nuevosPer;
        
        cargarDetalle(solicitudActiva); // Recarga vista
        toggleEditMode(false);

    } catch (e) {
        console.error(e);
        alert("Error al guardar: " + e.message);
    }
});

document.getElementById('btnGuardarNota').addEventListener('click', async () => {
    const nota = document.getElementById('inputComentario').value;
    await updateDoc(doc(db, "solicitudes", solicitudActiva.id), { comentario: nota });
    alert("Nota guardada");
});

document.getElementById('btnVolver').addEventListener('click', () => {
    document.getElementById('vistaDetalle').classList.add('hidden');
    document.getElementById('vistaResultados').classList.remove('hidden');
    document.getElementById('buscadorInput').parentElement.classList.remove('hidden');
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = '../login.html');
});

// Helpers UI
function toggleEditMode(activar) {
    const displays = document.querySelectorAll('.val-display');
    const inputs = document.querySelectorAll('.val-input');
    const btnEdit = document.getElementById('btnEditar');
    const btnSave = document.getElementById('btnGuardar');
    const btnCancel = document.getElementById('btnCancelar');

    if (activar) {
        displays.forEach(el => el.classList.add('hidden'));
        inputs.forEach(el => el.classList.remove('hidden'));
        btnEdit.classList.add('hidden');
        btnSave.classList.remove('hidden');
        btnCancel.classList.remove('hidden');
    } else {
        displays.forEach(el => el.classList.remove('hidden'));
        inputs.forEach(el => el.classList.add('hidden'));
        btnEdit.classList.remove('hidden');
        btnSave.classList.add('hidden');
        btnCancel.classList.add('hidden');
    }
}

async function cargarCuotasGlobales() {
    // Implementar si necesitas sobreescribir montos manuales como tenías antes.
    // Para esta versión limpia, usamos el cálculo puro primero.
}