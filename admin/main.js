import { auth, db } from '../assets/js/firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { formatearMoneda, formatearFecha } from '../assets/js/utils.js';

// --- VARIABLES GLOBALES ---
let cacheSolicitudes = [];
let datosAgrupados = [];
let numeroFijoID = null;
let idCarpetaEditando = null;
let carpetaSeleccionadaReingreso = null;

const unidadesNegocio = [
    { id: 1, nombre: "Parking" },
    { id: 2, nombre: "Departamento" },
    { id: 3, nombre: "DropShipping" },
    { id: 4, nombre: "Fondo Común" }
];

// ======================================================
// 1. INICIALIZACIÓN
// ======================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../login.html';
        return;
    }
    const docSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (!docSnap.exists() || docSnap.data().rol !== 'admin') {
        alert("Acceso denegado.");
        window.location.href = '../cliente/index.html';
    } else {
        document.getElementById('adminName').textContent = docSnap.data().nombre || 'Admin';
        initAdmin();
    }
});

async function initAdmin() {
    await cargarBaseDeDatos();
    cargarSelectUnidades();
    setupAutocomplete();
}

// ======================================================
// 2. CARGA DE BASE DE DATOS (CRÍTICO: DEEP LOAD)
// ======================================================
async function cargarBaseDeDatos() {
    try {
        const snap = await getDocs(collection(db, "solicitudes"));
        
        // Carga profunda: Traemos reingresos para cada carpeta
        const promesas = snap.docs.map(async (d) => {
            const data = d.data();
            const id = d.id;
            // Traer subcolección de reingresos
            const reingresosSnap = await getDocs(collection(db, `solicitudes/${id}/reingresos`));
            const reingresos = reingresosSnap.docs.map(r => r.data());
            return { id, ...data, reingresos }; 
        });

        cacheSolicitudes = await Promise.all(promesas);
        
        // Agrupar por Cliente
        const mapa = {};
        cacheSolicitudes.forEach(sol => {
            const dni = sol.dni || 'SIN_DNI';
            if (!mapa[dni]) {
                mapa[dni] = { 
                    nombre: sol.nombre || 'Desconocido', 
                    dni: dni, 
                    capitalTotal: 0, 
                    tasasAcumuladas: 0, 
                    carpetasActivas: 0, 
                    listaCarpetas: [] 
                };
            }
            
            // Calcular Capital Real (Base + Reingresos)
            let cap = parseFloat(String(sol.capital).replace(/[^\d,.-]/g,'').replace(',','.'));
            if(sol.reingresos) {
                sol.reingresos.forEach(r => {
                    cap += parseFloat(String(r.capital).replace(/[^\d,.-]/g,'').replace(',','.'));
                });
            }
            
            // Tasa Base
            const tasa = parseFloat(String(sol.ganancia).replace(',', '.'));

            mapa[dni].capitalTotal += cap;
            mapa[dni].tasasAcumuladas += tasa;
            
            if ((sol.estado || 'Activa').toLowerCase() === 'activa') {
                mapa[dni].carpetasActivas++;
            }
            mapa[dni].listaCarpetas.push(sol);
        });

        datosAgrupados = Object.values(mapa);
        calcularTesoreriaDashboard();
        console.log("Datos actualizados correctamente.");

    } catch (e) {
        console.error("Error DB:", e);
        mostrarFeedback("Error", "Fallo al cargar base de datos.", true);
    }
}

// ======================================================
// 3. NUEVA INVERSIÓN (ALTA)
// ======================================================
document.getElementById('btnNuevaInversion').addEventListener('click', () => {
    preCargarInversion("", ""); 
});

window.preCargarInversion = (nombre, dni) => {
    document.getElementById('formNuevaCarpeta').reset();
    document.getElementById('newFecha').valueAsDate = new Date();
    document.getElementById('divPlazoOtro').style.display = 'none';
    
    document.getElementById('newNombre').value = nombre || "";
    document.getElementById('newDni').value = dni || "";
    
    numeroFijoID = null; 
    document.getElementById('idDisplay').textContent = "SELECCIONE UNIDAD";
    document.getElementById('idDisplay').style.color = "#888";
    document.getElementById('newUnidad').value = ""; 
    
    document.getElementById('adminModal').classList.add('hidden');
    document.getElementById('modalNuevaInversion').classList.remove('hidden');
    
    if(nombre) actualizarVistaPreviaID();
};

const inputNombre = document.getElementById('newNombre');
const selectUnidad = document.getElementById('newUnidad');

const actualizarVistaPreviaID = () => {
    const unidadVal = selectUnidad.value;
    const display = document.getElementById('idDisplay');

    if (!unidadVal || unidadVal === "") {
        display.textContent = "SELECCIONE UNIDAD";
        display.style.color = "#888";
        return;
    }
    if (!numeroFijoID) numeroFijoID = Math.floor(100000 + Math.random() * 900000);

    const nombre = inputNombre.value.trim();
    let iniciales = "XX";
    if (nombre.length > 0) {
        const partes = nombre.split(' ').filter(p => p.length > 0);
        if (partes.length >= 2) {
            iniciales = (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
        } else if (partes.length === 1) {
            iniciales = (partes[0][0] + 'X').toUpperCase();
        }
    }

    display.textContent = `${numeroFijoID} - ${iniciales}/${unidadVal}`;
    display.style.color = "#fff";
};

inputNombre.addEventListener('input', actualizarVistaPreviaID);
selectUnidad.addEventListener('change', actualizarVistaPreviaID);

function setupAutocomplete() {
    const inpNombre = document.getElementById('newNombre');
    const inpDni = document.getElementById('newDni');
    const listNombre = document.getElementById('listaSugNombre');
    const listDni = document.getElementById('listaSugDni');

    inpNombre.addEventListener('input', function() {
        const val = this.value; cerrarListas(); if (!val) return;
        const matches = datosAgrupados.filter(c => c.nombre.toLowerCase().includes(val.toLowerCase()));
        renderSugerencias(matches, listNombre, inpNombre, inpDni);
    });

    inpDni.addEventListener('input', function() {
        const val = this.value; cerrarListas(); if (!val) return;
        const matches = datosAgrupados.filter(c => c.dni.includes(val));
        renderSugerencias(matches, listDni, inpNombre, inpDni);
    });

    document.addEventListener('click', (e) => { if(!e.target.matches('.admin-input')) cerrarListas(); });
}

function renderSugerencias(matches, contenedor, inpNombre, inpDni) {
    if (matches.length === 0) return;
    contenedor.classList.remove('hidden');
    matches.slice(0, 5).forEach(c => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `<strong>${c.nombre}</strong> <small>${c.dni}</small>`;
        item.addEventListener('click', () => {
            inpNombre.value = c.nombre; inpDni.value = c.dni; cerrarListas();
            inpNombre.dispatchEvent(new Event('input')); 
        });
        contenedor.appendChild(item);
    });
}

function cerrarListas() {
    document.getElementById('listaSugNombre').classList.add('hidden');
    document.getElementById('listaSugDni').classList.add('hidden');
}

function cargarSelectUnidades() {
    const select = document.getElementById('newUnidad');
    select.innerHTML = '<option value="" disabled selected>Selecciona una Unidad de Negocio</option>';
    unidadesNegocio.forEach(un => {
        const opt = document.createElement('option');
        opt.value = un.id; opt.textContent = `${un.id} - ${un.nombre}`; select.appendChild(opt);
    });
}

const selectPlazo = document.getElementById('newPlazoSelect');
selectPlazo.addEventListener('change', () => {
    const div = document.getElementById('divPlazoOtro');
    const input = document.getElementById('newPlazoInput');
    if (selectPlazo.value === 'otro') { div.style.display = 'block'; input.required = true; } 
    else { div.style.display = 'none'; input.required = false; }
});

document.getElementById('formNuevaCarpeta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Procesando...";

    try {
        const nombre = document.getElementById('newNombre').value.trim();
        const dni = document.getElementById('newDni').value.trim();
        const capital = document.getElementById('newCapital').value;
        const tasa = document.getElementById('newTasa').value;
        const fecha = document.getElementById('newFecha').value;
        
        let periodos = selectPlazo.value;
        if (periodos === 'otro') periodos = document.getElementById('newPlazoInput').value;

        const idFinal = document.getElementById('idDisplay').textContent;
        if (idFinal === "SELECCIONE UNIDAD") throw new Error("Falta seleccionar Unidad.");

        const idUnidad = selectUnidad.value;
        const objUnidad = unidadesNegocio.find(u => u.id == idUnidad);
        const nombreUnidadFull = objUnidad ? `${idUnidad} - ${objUnidad.nombre}` : `${idUnidad} - General`;

        const nuevaSolicitud = {
            carpeta: idFinal, nombre, dni, capital: parseFloat(capital), ganancia: parseFloat(tasa),
            periodos: parseInt(periodos), fecha, unidad: nombreUnidadFull, estado: "Activa",
            comentario: "", pagosRealizados: []
        };

        await addDoc(collection(db, "solicitudes"), nuevaSolicitud);
        
        document.getElementById('modalNuevaInversion').classList.add('hidden');
        mostrarFeedback("¡Carpeta Creada!", `Se generó: ${idFinal}`);

        await cargarBaseDeDatos();
        const clienteActualizado = datosAgrupados.find(c => c.dni === dni);
        if (clienteActualizado) setTimeout(() => abrirModalPerfil(clienteActualizado), 800);

    } catch (error) { mostrarFeedback("Error", error.message, true); } 
    finally { btn.disabled = false; btn.textContent = "Crear Carpeta"; }
});

// ======================================================
// 4. REINGRESO (LÓGICA CORREGIDA)
// ======================================================

const step1 = document.getElementById('paso1_Busqueda');
const step2 = document.getElementById('paso2_Seleccion');
const listaResReingreso = document.getElementById('listaResultadosReingreso');
const listaCarpetasUser = document.getElementById('listaCarpetasDelUsuario');
const tituloModalReingreso = document.getElementById('tituloModalReingreso');

// A. Abrir Buscador
document.getElementById('btnAbrirBuscadorReingreso').addEventListener('click', () => {
    document.getElementById('inputBuscarReingreso').value = '';
    renderizarListaReingreso(datosAgrupados); // Muestra todos de una
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    tituloModalReingreso.textContent = "Seleccionar Inversor";
    document.getElementById('modalBuscadorReingreso').classList.remove('hidden');
    document.getElementById('inputBuscarReingreso').focus();
});

// B. Filtro
document.getElementById('inputBuscarReingreso').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    if (val.length === 0) { renderizarListaReingreso(datosAgrupados); return; }
    const matches = datosAgrupados.filter(c => (c.nombre && c.nombre.toLowerCase().includes(val)) || (c.dni && c.dni.includes(val)));
    renderizarListaReingreso(matches);
});

function renderizarListaReingreso(lista) {
    listaResReingreso.innerHTML = '';
    if (lista.length === 0) { listaResReingreso.innerHTML = '<div style="padding:20px; color:#666; text-align:center">No se encontraron inversores.</div>'; return; }
    lista.forEach(cliente => {
        const div = document.createElement('div');
        div.className = 'result-card-profile';
        const badge = cliente.carpetasActivas > 0 ? 'badge-activo' : 'badge-inactivo';
        div.innerHTML = `<div class="profile-left"><div class="profile-name">${cliente.nombre}</div><div class="profile-dni">DNI: ${cliente.dni}</div></div><div class="profile-right"><div class="profile-capital">${formatearMoneda(cliente.capitalTotal)}</div><span class="profile-badge ${badge}">${cliente.carpetasActivas} Activas</span></div>`;
        div.addEventListener('click', () => mostrarCarpetasParaReingreso(cliente));
        listaResReingreso.appendChild(div);
    });
}

function mostrarCarpetasParaReingreso(cliente) {
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    tituloModalReingreso.textContent = `Carpetas de ${cliente.nombre.split(' ')[0]}`;
    listaCarpetasUser.innerHTML = '';
    
    const carpetas = cliente.listaCarpetas.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    
    if (carpetas.length === 0) { listaCarpetasUser.innerHTML = '<div style="padding:15px; text-align:center; color:#666">Sin carpetas activas.</div>'; return; }
    
    carpetas.forEach(s => {
        // Cálculo visual capital real
        const capitalReal = calcularCapitalTotal(s);
        
        const div = document.createElement('div');
        div.className = 'select-folder-card';
        div.innerHTML = `
            <div class="folder-info">
                <h4>#${s.carpeta} - ${s.unidad}</h4>
                <p>Capital Actual: <strong>${formatearMoneda(capitalReal)}</strong></p>
                <p style="font-size:0.8rem; color:#888">Inicio: ${formatearFecha(s.fecha)}</p>
            </div>
            <button class="btn-admin-primary btn-sm">Cargar Reingreso</button>
        `;
        div.querySelector('button').addEventListener('click', () => abrirFormularioReingreso(s));
        listaCarpetasUser.appendChild(div);
    });
}

document.getElementById('btnVolverBusqueda').addEventListener('click', () => {
    step2.classList.add('hidden');
    step1.classList.remove('hidden');
    tituloModalReingreso.textContent = "Seleccionar Inversor";
    const val = document.getElementById('inputBuscarReingreso').value;
    if(val) document.getElementById('inputBuscarReingreso').dispatchEvent(new Event('input'));
    else renderizarListaReingreso(datosAgrupados);
    document.getElementById('inputBuscarReingreso').focus();
});

// C. Abrir Formulario Final (Con precarga TASA y PLAZO)
function abrirFormularioReingreso(solicitud) {
    carpetaSeleccionadaReingreso = solicitud;
    document.getElementById('modalBuscadorReingreso').classList.add('hidden');
    document.getElementById('adminModal').classList.add('hidden');
    
    document.getElementById('formReingreso').reset();
    document.getElementById('reingresoFecha').valueAsDate = new Date();
    
    // PRECARGA: Tasa Actual y Plazo 12
    const tasaActual = obtenerTasaActual(solicitud);
    document.getElementById('reingresoTasa').value = tasaActual;
    document.getElementById('reingresoPlazo').value = "12"; // Extensión default
    
    const header = document.getElementById('headerReingreso');
    header.innerHTML = `
        <div style="font-weight:bold; color:var(--admin-accent)">#${solicitud.carpeta}</div>
        <div>${solicitud.nombre}</div>
        <div style="font-size:0.85rem; color:#666">Tasa Vigente: ${tasaActual}% | Plazo Actual: ${solicitud.periodos} meses</div>
    `;
    
    actualizarImpactoFecha();
    document.getElementById('modalFormReingreso').classList.remove('hidden');
}

// Wrapper global
window.abrirFormularioReingresoManual = (id) => {
    const s = cacheSolicitudes.find(x => x.id === id);
    if(s) abrirFormularioReingreso(s);
};

const inpFechaReingreso = document.getElementById('reingresoFecha');
inpFechaReingreso.addEventListener('change', actualizarImpactoFecha);

function actualizarImpactoFecha() {
    const fechaInput = inpFechaReingreso.value;
    if(!fechaInput) return;
    const [y, m, d] = fechaInput.split('-').map(Number);
    const fechaIngreso = new Date(y, m - 1, d);
    const fechaImpacto = new Date(fechaIngreso.getFullYear(), fechaIngreso.getMonth() + 2, 1);
    const mesImpacto = fechaImpacto.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    document.getElementById('txtImpactoFecha').textContent = `La cuota aumentará a partir de: ${mesImpacto.toUpperCase()}`;
    document.getElementById('txtImpactoFecha').dataset.impacto = fechaImpacto.toISOString().slice(0, 7);
}

// D. GUARDAR (CORREGIDO PLAZO)
document.getElementById('formReingreso').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!carpetaSeleccionadaReingreso) return;
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Guardando...";

    try {
        const monto = parseFloat(document.getElementById('reingresoMonto').value);
        const tasa = parseFloat(document.getElementById('reingresoTasa').value);
        const fecha = document.getElementById('reingresoFecha').value;
        const impactoKey = document.getElementById('txtImpactoFecha').dataset.impacto;
        
        // Conversión segura de Plazo
        const plazoExtra = parseInt(document.getElementById('reingresoPlazo').value) || 0;

        const nuevoReingreso = {
            fecha: fecha,
            capital: monto,
            tasa: tasa,
            impactoDesde: impactoKey,
            fechaCarga: new Date().toISOString()
        };

        // 1. Guardar subcolección
        const ref = collection(db, `solicitudes/${carpetaSeleccionadaReingreso.id}/reingresos`);
        await addDoc(ref, nuevoReingreso);

        // 2. Actualizar Plazo en Documento Padre (CORREGIDO)
        if (plazoExtra > 0) {
            const plazoActual = parseInt(carpetaSeleccionadaReingreso.periodos);
            const nuevoPlazo = plazoActual + plazoExtra;
            
            await updateDoc(doc(db, "solicitudes", carpetaSeleccionadaReingreso.id), {
                periodos: nuevoPlazo
            });
        }

        mostrarFeedback("¡Reingreso Exitoso!", `Capital agregado. Plazo extendido ${plazoExtra} meses.`);
        document.getElementById('modalFormReingreso').classList.add('hidden');
        
        // 3. Recargar y Redirigir
        await cargarBaseDeDatos();
        const clienteActualizado = datosAgrupados.find(c => c.dni === carpetaSeleccionadaReingreso.dni);
        if (clienteActualizado) setTimeout(() => abrirModalPerfil(clienteActualizado), 800);

    } catch (err) {
        mostrarFeedback("Error", err.message, true);
    } finally {
        btn.disabled = false; btn.textContent = "Confirmar Reingreso";
    }
});

// ======================================================
// 5. BUSCADOR PRINCIPAL (GESTIÓN)
// ======================================================
const inputBuscador = document.getElementById('inputBuscador');
const listaMain = document.getElementById('listaResultados');

inputBuscador.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    if (val.length === 0) { listaMain.classList.add('hidden'); return; }
    const resultados = datosAgrupados.filter(c => (c.nombre && c.nombre.toLowerCase().includes(val)) || (c.dni && c.dni.includes(val)));
    renderMainResults(resultados);
});

function renderMainResults(lista) {
    listaMain.innerHTML = '';
    if (lista.length === 0) { listaMain.innerHTML = '<div style="padding:15px; text-align:center;">No encontrado.</div>'; listaMain.classList.remove('hidden'); return; }
    lista.forEach(cliente => {
        const div = document.createElement('div');
        div.className = 'result-card-profile';
        const badge = cliente.carpetasActivas > 0 ? 'badge-activo' : 'badge-inactivo';
        div.innerHTML = `<div class="profile-left"><div class="profile-name">${cliente.nombre}</div><div class="profile-dni">DNI: ${cliente.dni}</div></div><div class="profile-right"><div class="profile-capital">${formatearMoneda(cliente.capitalTotal)}</div><span class="profile-badge ${badge}">${cliente.carpetasActivas} Activas</span></div>`;
        div.addEventListener('click', () => abrirModalPerfil(cliente));
        listaMain.appendChild(div);
    });
    listaMain.classList.remove('hidden');
}

// ======================================================
// 6. PERFIL INVERSOR (VISUALIZACIÓN TACHADA CORREGIDA)
// ======================================================
function abrirModalPerfil(cliente) {
    const modal = document.getElementById('adminModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    title.textContent = cliente.nombre;
    
    const hoyKey = new Date().toISOString().slice(0, 7);
    let totalCobrar = 0;
    cliente.listaCarpetas.forEach(c => {
        if((c.estado||'Activa')==='Activa') {
            const pagos = calcularPagosSimples(c);
            const p = pagos.find(p=>p.key===hoyKey);
            if(p) totalCobrar += p.monto;
        }
    });

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <button class="btn-profile-new" onclick="preCargarInversion('${cliente.nombre}', '${cliente.dni}')"><span>✨</span> Nueva Carpeta</button>
        </div>
        <div class="profile-summary-grid">
            <div class="p-stat-box"><span class="p-stat-label">Capital Total</span><span class="p-stat-val">${formatearMoneda(cliente.capitalTotal)}</span></div>
            <div class="p-stat-box"><span class="p-stat-label">Carpetas Activas</span><span class="p-stat-val">${cliente.carpetasActivas}</span></div>
            <div class="p-stat-box"><span class="p-stat-label">A Pagar este Mes</span><span class="p-stat-val" style="color:#2e7d32">${formatearMoneda(totalCobrar)}</span></div>
        </div>
        <h4 style="margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:5px;">Carpetas Asociadas</h4>
        <div class="admin-folders-container">
    `;
    
    const carpetas = [...cliente.listaCarpetas].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    
    carpetas.forEach(c => {
        const est = c.estado||'Activa';
        const info = calcularInfoCuota(c); // Trae "Cuota X / TOTAL_NUEVO"
        const bell = (c.comentario && c.comentario.trim().length > 0) ? 'active-bell' : '';
        
        // --- VISUALIZACIÓN CAPITAL (Base vs Total) ---
        const capitalBase = parseFloat(String(c.capital).replace(/[^\d,.-]/g,'').replace(',','.'));
        const capitalTotal = calcularCapitalTotal(c);
        let displayCapital = formatearMoneda(capitalBase);
        
        if(capitalTotal > capitalBase) {
            displayCapital = `<span class="val-old">${formatearMoneda(capitalBase)}</span> <span class="val-new">${formatearMoneda(capitalTotal)}</span>`;
        }

        // --- VISUALIZACIÓN TASA (Base vs Actual) ---
        const tasaBase = parseFloat(String(c.ganancia).replace(',', '.'));
        const tasaActual = obtenerTasaActual(c);
        let displayTasa = `${tasaBase}%`;
        
        if(tasaActual !== tasaBase) {
            displayTasa = `<span class="val-old">${tasaBase}%</span> <span class="val-new">${tasaActual}%</span>`;
        }

        // --- VISUALIZACIÓN FECHA ---
        let displayFecha = formatearFecha(c.fecha);
        // Si hay reingreso, mostrar la fecha del último
        if(c.reingresos && c.reingresos.length > 0) {
            const ult = [...c.reingresos].sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).pop();
            displayFecha += `<br><span style="font-size:0.75rem; color:#2e7d32; font-style:italic;">Reingreso: ${formatearFecha(ult.fecha)}</span>`;
        }

        html += `
            <div class="admin-folder-card">
                <div class="af-header">
                    <span class="af-id">#${c.carpeta}</span>
                    <select class="status-select ${est.toLowerCase()}" onchange="cambiarEstado('${c.id}', this)">
                        <option value="Activa" ${est==='Activa'?'selected':''}>Activa</option>
                        <option value="Pendiente" ${est==='Pendiente'?'selected':''}>Pendiente</option>
                        <option value="Bloqueada" ${est==='Bloqueada'?'selected':''}>Bloqueada</option>
                        <option value="Finalizada" ${est==='Finalizada'?'selected':''}>Finalizada</option>
                    </select>
                </div>
                <div class="af-grid">
                    <div class="af-item"><label>Capital</label><span>${displayCapital}</span></div>
                    <div class="af-item"><label>Cuota Actual</label><span>${info}</span></div>
                    <div class="af-item"><label>Tasa</label><span>${displayTasa}</span></div>
                    <div class="af-item"><label>Inicio</label><span>${displayFecha}</span></div>
                </div>
                <div class="af-actions">
                    <button class="btn-history" onclick="abrirHistorialPagos('${c.id}')">📅 Historial</button>
                    <button class="btn-icon-action ${bell}" onclick="editarNotificacion('${c.id}', '${c.comentario||''}')">🔔</button>
                    <button class="btn-reinvest" onclick="abrirFormularioReingresoManual('${c.id}')">Cargar Reingreso</button>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    body.innerHTML = html;
    modal.classList.remove('hidden');
    listaMain.classList.add('hidden');
}

// --- 7. PAGOS (MODIFICADO: Muestra "Cuota X/XX" en el listado) ---
window.abrirHistorialPagos = (id) => {
    const c = cacheSolicitudes.find(s => s.id === id);
    if (!c) return;

    const modal = document.getElementById('modalPagosAdmin');
    document.getElementById('headerPagosInfo').innerHTML = `<h3 style="margin:0">Gestión Pagos</h3><p style="margin:0; color:#666">Carpeta #${c.carpeta}</p>`;
    
    const pagos = calcularPagosSimples(c);
    const realizados = c.pagosRealizados || [];
    const lista = document.getElementById('listaPagosAdmin');
    
    // Obtener mes actual para el borde negro
    const hoyKey = new Date().toISOString().slice(0, 7);
    const totalCuotas = parseInt(c.periodos); // Total para mostrar "/12"

    lista.innerHTML = '';
    
    // Agregamos 'index' al forEach para saber el número de cuota
    pagos.forEach((p, index) => {
        const done = realizados.includes(p.key);
        const [a, m] = p.key.split('-');
        
        // LÓGICA DE TEXTO CUOTA
        let labelCuota;
        if (p.esCapital) {
            labelCuota = "Devolución Capital";
        } else {
            // El índice arranca en 0, así que sumamos 1.
            // Ejemplo: index 0 -> Cuota 1 / 12
            labelCuota = `Cuota ${index + 1} / ${totalCuotas}`;
        }

        // Lógica visual (Mes actual y Pagado)
        const esMesActual = p.key === hoyKey;
        const claseCurrent = esMesActual ? 'current-month' : '';
        const clasePagada = done ? 'marked-paid' : '';

        const row = document.createElement('div');
        row.className = `payment-row ${clasePagada} ${claseCurrent}`;
        
        row.innerHTML = `
            <div class="payment-info">
                <div style="display:flex; gap:10px; align-items:center;">
                    <span class="pay-date">${m}/${a.slice(2)}</span>
                    <span style="font-size:0.8rem; color:#666; font-weight:600;">${labelCuota}</span>
                </div>
                <div>
                    <span class="pay-amount">${formatearMoneda(p.monto)}</span>
                    <span class="pay-status">${done ? 'ABONADA' : 'PENDIENTE'}</span>
                </div>
            </div>
            <label class="payment-check-group">
                <input type="checkbox" ${done ? 'checked' : ''} onchange="togglePago('${c.id}', '${p.key}', this)">
            </label>
        `;
        lista.appendChild(row);

        if(esMesActual) {
            setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
        }
    });
    
    modal.classList.remove('hidden');
};

window.togglePago = async (id, key, chk) => {
    const done = chk.checked; const row = chk.closest('.payment-row'); const span = row.querySelector('.pay-status');
    if(done) { row.classList.add('marked-paid'); span.textContent="ABONADA"; } else { row.classList.remove('marked-paid'); span.textContent="PENDIENTE"; }
    try {
        if(done) await updateDoc(doc(db,"solicitudes",id), {pagosRealizados: arrayUnion(key)});
        else await updateDoc(doc(db,"solicitudes",id), {pagosRealizados: arrayRemove(key)});
        const item = cacheSolicitudes.find(x=>x.id===id);
        if(item) { if(!item.pagosRealizados) item.pagosRealizados=[]; if(done) item.pagosRealizados.push(key); else item.pagosRealizados = item.pagosRealizados.filter(k=>k!==key); }
    } catch(e) { alert("Error"); chk.checked=!done; }
};

// --- HELPERS ---
function mostrarFeedback(title, msg, isErr=false) {
    const m = document.getElementById('modalFeedback');
    document.getElementById('fbIcon').textContent = isErr?'❌':'✅';
    document.getElementById('fbTitle').textContent = title;
    document.getElementById('fbMessage').textContent = msg;
    m.classList.remove('hidden');
}

function calcularCapitalTotal(s) {
    let total = parseFloat(String(s.capital).replace(/[^\d,.-]/g,'').replace(',','.'));
    if(s.reingresos) s.reingresos.forEach(r => total += parseFloat(String(r.capital).replace(/[^\d,.-]/g,'').replace(',','.')));
    return total;
}

function obtenerTasaActual(s) {
    let tasa = parseFloat(String(s.ganancia).replace(',', '.'));
    if(s.reingresos && s.reingresos.length > 0) {
        // Ordenar por impacto
        const ult = [...s.reingresos].sort((a,b) => a.impactoDesde.localeCompare(b.impactoDesde)).pop();
        if(ult && ult.tasa) tasa = parseFloat(String(ult.tasa));
    }
    return tasa;
}

function calcularPagosSimples(solicitud) {
    const pagos = [];
    let capitalBase = parseFloat(String(solicitud.capital).replace(/[^\d,.-]/g,'').replace(',','.'));
    let tasaBase = parseFloat(String(solicitud.ganancia).replace(',', '.')) / 100;
    const [y, m, d] = solicitud.fecha.split('-').map(Number);
    const fInicio = new Date(y, m - 1, d);
    const reingresos = solicitud.reingresos || [];
    
    // IMPORTANTE: periodos viene actualizado de DB si se extendió
    for (let i = 0; i < parseInt(solicitud.periodos); i++) {
        const fPago = new Date(fInicio.getFullYear(), fInicio.getMonth() + i + 1, 1);
        const keyPago = `${fPago.getFullYear()}-${String(fPago.getMonth() + 1).padStart(2, '0')}`;
        
        let capitalVigente = capitalBase;
        let tasaVigente = tasaBase;
        
        reingresos.forEach(r => {
            // Si la fecha de impacto ya llegó
            if (r.impactoDesde <= keyPago) {
                capitalVigente += parseFloat(String(r.capital));
                tasaVigente = parseFloat(String(r.tasa)) / 100;
            }
        });
        const montoCuota = capitalVigente * tasaVigente;
        pagos.push({ key: keyPago, monto: montoCuota });
    }
    const fDevol = new Date(fInicio.getFullYear(), fInicio.getMonth() + parseInt(solicitud.periodos) + 1, 1);
    const keyDev = `${fDevol.getFullYear()}-${String(fDevol.getMonth() + 1).padStart(2, '0')}`;
    
    let capitalFinal = capitalBase;
    reingresos.forEach(r => capitalFinal += parseFloat(String(r.capital)));
    pagos.push({ key: keyDev, monto: capitalFinal, esCapital: true });
    return pagos;
}

function calcularInfoCuota(s) {
    const pagos = calcularPagosSimples(s);
    const [y, m, d] = s.fecha.split('-').map(Number);
    const inicio = new Date(y, m - 1, d);
    const hoy = new Date();
    let meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
    if(hoy.getDate() >= d) meses++;
    const total = parseInt(s.periodos);
    const actual = Math.max(0, Math.min(meses, total));
    
    if (actual > total) return "Finalizada";
    
    const fPagoAprox = new Date(inicio.getFullYear(), inicio.getMonth() + actual, 1);
    const keyAprox = `${fPagoAprox.getFullYear()}-${String(fPagoAprox.getMonth() + 1).padStart(2, '0')}`;
    const pagoObj = pagos.find(p => p.key === keyAprox) || pagos[actual-1] || {monto:0};
    return `${actual}/${total} • ${formatearMoneda(pagoObj.monto)}`;
}

// --- LÓGICA DEL MODAL TESORERÍA (DETALLE MENSUAL) ---
// --- TESORERÍA CON BUSCADOR ---
let itemsTesoreriaCache = []; // Variable para guardar la lista completa

function calcularTesoreriaDashboard() {
    const hoyKey = new Date().toISOString().slice(0, 7);
    let totalMes = 0;
    cacheSolicitudes.forEach(c => {
        if ((c.estado || 'Activa') === 'Activa') {
            const pagos = calcularPagosSimples(c);
            const pago = pagos.find(p => p.key === hoyKey);
            if (pago) totalMes += pago.monto;
        }
    });
    const kpi = document.getElementById('kpiTesoreriaMes');
    if (kpi) kpi.textContent = formatearMoneda(totalMes);
}

// 1. ABRIR Y CARGAR DATOS
document.getElementById('btnAbrirTesoreria').addEventListener('click', () => {
    const hoyKey = new Date().toISOString().slice(0, 7);
    const totalHeader = document.getElementById('totalTesoreriaModal');
    
    // Limpiar input filtro
    const inputFiltro = document.getElementById('filtroTesoreria');
    if(inputFiltro) inputFiltro.value = '';

    let totalLiquidar = 0;
    itemsTesoreriaCache = []; // Reiniciamos caché

    cacheSolicitudes.forEach(c => {
        if ((c.estado || 'Activa') === 'Activa') {
            const pagos = calcularPagosSimples(c);
            const pagoDelMes = pagos.find(p => p.key === hoyKey);
            if (pagoDelMes) {
                totalLiquidar += pagoDelMes.monto;
                itemsTesoreriaCache.push({ folder: c, pago: pagoDelMes });
            }
        }
    });

    if(totalHeader) totalHeader.textContent = formatearMoneda(totalLiquidar);
    
    // Ordenar alfabéticamente
    itemsTesoreriaCache.sort((a, b) => a.folder.nombre.localeCompare(b.folder.nombre));
    
    // Renderizar todo
    renderizarListaTesoreria(itemsTesoreriaCache);
    document.getElementById('modalTesoreria').classList.remove('hidden');
    
    // Foco en el buscador
    setTimeout(() => inputFiltro.focus(), 100);
});

// 2. ESCUCHAR FILTRO (BÚSQUEDA)
document.getElementById('filtroTesoreria')?.addEventListener('input', (e) => {
    const texto = e.target.value.toLowerCase();
    
    if (texto.length === 0) {
        renderizarListaTesoreria(itemsTesoreriaCache); // Mostrar todo
        return;
    }

    const filtrados = itemsTesoreriaCache.filter(item => 
        item.folder.nombre.toLowerCase().includes(texto) || 
        item.folder.carpeta.toLowerCase().includes(texto)
    );
    
    renderizarListaTesoreria(filtrados);
});

// 3. FUNCIÓN DE RENDERIZADO (SEPARADA)
function renderizarListaTesoreria(lista) {
    const contenedor = document.getElementById('listaTesoreria');
    contenedor.innerHTML = '';

    if (lista.length === 0) {
        contenedor.innerHTML = '<div style="padding:30px; text-align:center; color:#999; font-style:italic;">No se encontraron pagos.</div>';
        return;
    }

    lista.forEach(item => {
        const s = item.folder;
        const p = item.pago;
        const realizados = s.pagosRealizados || [];
        const done = realizados.includes(p.key);
        
        const labelTipo = p.esCapital ? "Devolución de Capital" : "Renta Mensual";
        const rowClass = done ? 'marked-paid' : '';
        const statusText = done ? 'ABONADA' : 'PENDIENTE';

        const row = document.createElement('div');
        row.className = `payment-row ${rowClass}`;
        
        row.innerHTML = `
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-weight:700; color:var(--admin-accent); font-size:1rem;">${s.nombre}</span>
                    <span style="font-size:0.75rem; background:#eee; padding:2px 6px; border-radius:4px; color:#555;">#${s.carpeta}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.85rem; color:#666;">${labelTipo}</span>
                    <div style="text-align:right; margin-right:15px;">
                        <span class="pay-amount" style="font-size:1rem;">${formatearMoneda(p.monto)}</span>
                        <span class="pay-status">${statusText}</span>
                    </div>
                </div>
            </div>
            <label class="payment-check-group" style="padding-left:15px; border-left:1px solid #eee;">
                <input type="checkbox" ${done ? 'checked' : ''} onchange="togglePago('${s.id}', '${p.key}', this)">
            </label>
        `;
        contenedor.appendChild(row);
    });
}

    modal.classList.remove('hidden');

window.cambiarEstado = async (id, sel) => { try { await updateDoc(doc(db,"solicitudes",id), {estado:sel.value}); sel.className = `status-select ${sel.value.toLowerCase()}`; } catch(e) { mostrarFeedback("Error", "No se cambió el estado", true); } };
window.editarNotificacion = (id, txt) => { idCarpetaEditando = id; document.getElementById('txtNotificacion').value = (txt && txt!=='undefined') ? txt : ''; document.getElementById('modalNotificacion').classList.remove('hidden'); };
document.getElementById('btnSaveNotif').addEventListener('click', async()=>{ if(!idCarpetaEditando) return; const val = document.getElementById('txtNotificacion').value.trim(); try { await updateDoc(doc(db,"solicitudes",idCarpetaEditando), {comentario: val}); const item = cacheSolicitudes.find(x=>x.id===idCarpetaEditando); if(item) item.comentario = val; const btn = document.querySelector(`button[onclick*="${idCarpetaEditando}"]`); if(btn) { val.length>0 ? btn.classList.add('active-bell') : btn.classList.remove('active-bell'); btn.setAttribute('onclick', `editarNotificacion('${idCarpetaEditando}', '${val.replace(/'/g, "\\'")}')`); } mostrarFeedback("Guardado", "Mensaje actualizado"); document.getElementById('modalNotificacion').classList.add('hidden'); } catch(e) { mostrarFeedback("Error", e.message, true); } });

// Close handlers
document.getElementById('closeModal').addEventListener('click',()=>document.getElementById('adminModal').classList.add('hidden'));
document.getElementById('closeModalPagos').addEventListener('click',()=>document.getElementById('modalPagosAdmin').classList.add('hidden'));
document.getElementById('closeNotif').addEventListener('click',()=>document.getElementById('modalNotificacion').classList.add('hidden'));
document.getElementById('btnCancelNotif').addEventListener('click',()=>document.getElementById('modalNotificacion').classList.add('hidden'));
document.getElementById('btnLogout').addEventListener('click',()=>signOut(auth).then(()=>window.location.href='../login.html'));