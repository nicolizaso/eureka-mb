import { auth, db } from '../assets/js/firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { formatearMoneda, formatearFecha } from '../assets/js/utils.js';

let cacheSolicitudes = [];
let datosAgrupados = [];
let numeroFijoID = null;
let idCarpetaEditando = null;

const unidadesNegocio = [
    { id: 1, nombre: "Parking" },
    { id: 2, nombre: "Departamento" },
    { id: 3, nombre: "DropShipping" },
    { id: 4, nombre: "Fondo Común" }
];

// --- 1. AUTH GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../login.html'; return; }
    const docSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (!docSnap.exists() || docSnap.data().rol !== 'admin') {
        alert("Acceso denegado."); window.location.href = '../cliente/index.html';
    } else {
        document.getElementById('adminName').textContent = docSnap.data().nombre || 'Admin';
        initAdmin();
    }
});

async function initAdmin() {
    await cargarBaseDeDatos();
    cargarSelectUnidades();
    setupAutocomplete(); // Iniciamos los escuchas del predictivo
}

// --- 2. CARGA DE DATOS ---
async function cargarBaseDeDatos() {
    try {
        const snap = await getDocs(collection(db, "solicitudes"));
        cacheSolicitudes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const mapaClientes = {};
        cacheSolicitudes.forEach(sol => {
            const dni = sol.dni || 'SIN_DNI';
            if (!mapaClientes[dni]) {
                mapaClientes[dni] = {
                    nombre: sol.nombre || 'Desconocido',
                    dni: dni,
                    capitalTotal: 0,
                    tasasAcumuladas: 0,
                    carpetasActivas: 0,
                    listaCarpetas: []
                };
            }
            const cap = parseFloat(String(sol.capital).replace(/[^\d,.-]/g, '').replace(',', '.'));
            const tasa = parseFloat(String(sol.ganancia).replace(',', '.'));
            
            mapaClientes[dni].capitalTotal += cap;
            mapaClientes[dni].tasasAcumuladas += tasa;
            if ((sol.estado || 'Activa').toLowerCase() === 'activa') mapaClientes[dni].carpetasActivas++;
            mapaClientes[dni].listaCarpetas.push(sol);
        });

        datosAgrupados = Object.values(mapaClientes);
    } catch (e) { console.error("Error DB:", e); }
}

// --- 3. AUTOCOMPLETE & PREDICTIVO (NUEVO) ---
function setupAutocomplete() {
    const inpNombre = document.getElementById('newNombre');
    const inpDni = document.getElementById('newDni');
    const listNombre = document.getElementById('listaSugNombre');
    const listDni = document.getElementById('listaSugDni');

    // Listener Nombre
    inpNombre.addEventListener('input', function() {
        const val = this.value;
        cerrarListas();
        if (!val) return;
        
        // Buscar coincidencias
        const matches = datosAgrupados.filter(c => c.nombre.toLowerCase().includes(val.toLowerCase()));
        renderSugerencias(matches, listNombre, inpNombre, inpDni);
    });

    // Listener DNI
    inpDni.addEventListener('input', function() {
        const val = this.value;
        cerrarListas();
        if (!val) return;
        
        const matches = datosAgrupados.filter(c => c.dni.includes(val));
        renderSugerencias(matches, listDni, inpNombre, inpDni);
    });

    // Cerrar si click afuera
    document.addEventListener('click', function (e) {
        if(!e.target.matches('.admin-input')) cerrarListas();
    });
}

function renderSugerencias(matches, contenedor, inpNombre, inpDni) {
    if (matches.length === 0) return;
    
    contenedor.classList.remove('hidden');
    matches.slice(0, 5).forEach(c => { // Max 5 sugerencias
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `<strong>${c.nombre}</strong> <small>${c.dni}</small>`;
        
        // Al hacer clic en la sugerencia
        item.addEventListener('click', () => {
            inpNombre.value = c.nombre;
            inpDni.value = c.dni;
            cerrarListas();
            // Disparar evento para actualizar ID preview si ya hay unidad
            inpNombre.dispatchEvent(new Event('input')); 
        });
        
        contenedor.appendChild(item);
    });
}

function cerrarListas() {
    document.getElementById('listaSugNombre').innerHTML = '';
    document.getElementById('listaSugNombre').classList.add('hidden');
    document.getElementById('listaSugDni').innerHTML = '';
    document.getElementById('listaSugDni').classList.add('hidden');
}

// --- 4. NUEVA INVERSIÓN (MODALES) ---

// A. Abrir Modal (Limpio)
document.getElementById('btnNuevaInversion').addEventListener('click', () => {
    preCargarInversion("", ""); // Abrir vacío
});

// B. Abrir Modal (Pre-cargado desde Perfil) - NUEVA FUNCIÓN GLOBAL
window.preCargarInversion = (nombre, dni) => {
    document.getElementById('formNuevaCarpeta').reset();
    document.getElementById('newFecha').valueAsDate = new Date();
    document.getElementById('divPlazoOtro').style.display = 'none';
    
    // Inyectar datos
    document.getElementById('newNombre').value = nombre || "";
    document.getElementById('newDni').value = dni || "";
    
    // Reset ID
    numeroFijoID = null; 
    document.getElementById('idDisplay').textContent = "SELECCIONE UNIDAD";
    document.getElementById('idDisplay').style.color = "#888";
    document.getElementById('newUnidad').value = ""; 
    
    // Cerrar otros modales si están abiertos (ej: Perfil)
    document.getElementById('adminModal').classList.add('hidden');
    
    document.getElementById('modalNuevaInversion').classList.remove('hidden');
    
    // Si viene con nombre, actualizamos el ID preview simulando input
    if(nombre) actualizarVistaPreviaID();
};

// C. Lógica ID Dinámico
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
        if (partes.length >= 2) iniciales = (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
        else if (partes.length === 1) iniciales = (partes[0][0] + 'X').toUpperCase();
    }

    display.textContent = `${numeroFijoID} - ${iniciales}/${unidadVal}`;
    display.style.color = "#fff";
};

inputNombre.addEventListener('input', actualizarVistaPreviaID);
selectUnidad.addEventListener('change', actualizarVistaPreviaID);

function cargarSelectUnidades() {
    const select = document.getElementById('newUnidad');
    select.innerHTML = '<option value="" disabled selected>Selecciona una Unidad de Negocio</option>';
    unidadesNegocio.forEach(un => {
        const opt = document.createElement('option');
        opt.value = un.id;
        opt.textContent = `${un.id} - ${un.nombre}`;
        select.appendChild(opt);
    });
}

const selectPlazo = document.getElementById('newPlazoSelect');
selectPlazo.addEventListener('change', () => {
    const div = document.getElementById('divPlazoOtro');
    const input = document.getElementById('newPlazoInput');
    if (selectPlazo.value === 'otro') { div.style.display = 'block'; input.required = true; } 
    else { div.style.display = 'none'; input.required = false; }
});

// GUARDAR
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
            carpeta: idFinal, nombre: nombre, dni: dni, capital: parseFloat(capital), ganancia: parseFloat(tasa),
            periodos: parseInt(periodos), fecha: fecha, unidad: nombreUnidadFull, estado: "Activa",
            comentario: "", pagosRealizados: []
        };

        await addDoc(collection(db, "solicitudes"), nuevaSolicitud);
        document.getElementById('modalNuevaInversion').classList.add('hidden');
        mostrarFeedback("¡Carpeta Creada!", `Se generó correctamente: ${idFinal}`);

        await cargarBaseDeDatos();
        const clienteActualizado = datosAgrupados.find(c => c.dni === dni);
        if (clienteActualizado) setTimeout(() => abrirModalPerfil(clienteActualizado), 800);

    } catch (error) { mostrarFeedback("Error", error.message, true); } 
    finally { btn.disabled = false; btn.textContent = "Crear Carpeta"; }
});

// --- 5. BUSCADOR ---
const inputSearch = document.getElementById('inputBuscador');
const listaResultados = document.getElementById('listaResultados');

inputSearch.addEventListener('input', (e) => {
    const termino = e.target.value.trim().toLowerCase();
    if (termino.length === 0) { listaResultados.classList.add('hidden'); return; }
    const resultados = datosAgrupados.filter(c => (c.nombre && c.nombre.toLowerCase().includes(termino)) || (c.dni && c.dni.includes(termino)));
    renderResultados(resultados);
});

function renderResultados(lista) {
    listaResultados.innerHTML = '';
    if (lista.length === 0) { listaResultados.innerHTML = '<div style="padding:15px; text-align:center;">No encontrado.</div>'; listaResultados.classList.remove('hidden'); return; }
    lista.forEach(cliente => {
        const div = document.createElement('div');
        div.className = 'result-card-profile';
        const badge = cliente.carpetasActivas > 0 ? 'badge-activo' : 'badge-inactivo';
        div.innerHTML = `<div class="profile-left"><div class="profile-name">${cliente.nombre}</div><div class="profile-dni">DNI: ${cliente.dni}</div></div><div class="profile-right"><div class="profile-capital">${formatearMoneda(cliente.capitalTotal)}</div><span class="profile-badge ${badge}">${cliente.carpetasActivas} Activas</span></div>`;
        div.addEventListener('click', () => abrirModalPerfil(cliente));
        listaResultados.appendChild(div);
    });
    listaResultados.classList.remove('hidden');
}

// --- 6. MODAL PERFIL (CON BOTÓN NUEVA CARPETA) ---
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
            <button class="btn-profile-new" onclick="preCargarInversion('${cliente.nombre}', '${cliente.dni}')">
                <span>✨</span> Nueva Carpeta
            </button>
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
        const info = calcularInfoCuota(c);
        const bell = (c.comentario && c.comentario.trim().length > 0) ? 'active-bell' : '';
        html += `<div class="admin-folder-card"><div class="af-header"><span class="af-id">#${c.carpeta}</span><select class="status-select ${est.toLowerCase()}" onchange="cambiarEstado('${c.id}', this)"><option value="Activa" ${est==='Activa'?'selected':''}>Activa</option><option value="Pendiente" ${est==='Pendiente'?'selected':''}>Pendiente</option><option value="Bloqueada" ${est==='Bloqueada'?'selected':''}>Bloqueada</option><option value="Finalizada" ${est==='Finalizada'?'selected':''}>Finalizada</option></select></div><div class="af-grid"><div class="af-item"><label>Capital</label><span>${formatearMoneda(c.capital)}</span></div><div class="af-item"><label>Cuota Actual</label><span>${info}</span></div><div class="af-item"><label>Tasa</label><span>${c.ganancia}%</span></div><div class="af-item"><label>Inicio</label><span>${formatearFecha(c.fecha)}</span></div></div><div class="af-actions"><button class="btn-history" onclick="abrirHistorialPagos('${c.id}')">📅 Historial</button><button class="btn-icon-action ${bell}" onclick="editarNotificacion('${c.id}', '${c.comentario||''}')">🔔</button><button class="btn-reinvest" onclick="abrirReingreso('${c.id}')">Cargar Reingreso</button></div></div>`;
    });
    html += `</div>`;
    body.innerHTML = html;
    modal.classList.remove('hidden');
    listaResultados.classList.add('hidden');
}

// ... Resto de funciones (abrirHistorialPagos, togglePago, helpers, etc) se mantienen igual ...
// (Para ahorrar espacio, asume que el resto del archivo es idéntico a la versión anterior que te pasé completa. 
// Solo cambiamos la parte de arriba y agregamos setupAutocomplete).

// --- HELPERS REQUERIDOS PARA COMPLETAR EL ARCHIVO ---
function mostrarFeedback(titulo, mensaje, esError = false) {
    const modal = document.getElementById('modalFeedback');
    document.getElementById('fbIcon').textContent = esError ? '❌' : '✅';
    document.getElementById('fbTitle').textContent = titulo;
    document.getElementById('fbMessage').textContent = mensaje;
    modal.classList.remove('hidden');
}

window.abrirHistorialPagos = (id) => {
    const c = cacheSolicitudes.find(s=>s.id===id); if(!c) return;
    const modal = document.getElementById('modalPagosAdmin');
    document.getElementById('headerPagosInfo').innerHTML=`<h3 style="margin:0">Gestión Pagos</h3><p style="margin:0; color:#666">Carpeta #${c.carpeta}</p>`;
    const pagos = calcularPagosSimples(c); const realizados = c.pagosRealizados || [];
    const lista = document.getElementById('listaPagosAdmin'); lista.innerHTML='';
    pagos.forEach(p => {
        const done = realizados.includes(p.key);
        const [a,m] = p.key.split('-'); const lbl = p.esCapital ? "Devolución" : "Cuota";
        const row = document.createElement('div');
        row.className = `payment-row ${done?'marked-paid':''}`;
        row.innerHTML = `<div class="payment-info"><div style="display:flex; gap:10px;"><span class="pay-date">${m}/${a.slice(2)}</span><span style="font-size:0.8rem; color:#666">${lbl}</span></div><div><span class="pay-amount">${formatearMoneda(p.monto)}</span><span class="pay-status">${done?'ABONADA':'PENDIENTE'}</span></div></div><label class="payment-check-group"><input type="checkbox" ${done?'checked':''} onchange="togglePago('${c.id}', '${p.key}', this)"></label>`;
        lista.appendChild(row);
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

function calcularPagosSimples(s) {
    const p=[]; const cap=parseFloat(String(s.capital).replace(/[^\d,.-]/g,'').replace(',','.'));
    const g=parseFloat(String(s.ganancia).replace(',','.'))/100; const m=cap*g;
    const [y,mo,d]=s.fecha.split('-').map(Number); const fi=new Date(y,mo-1,d);
    for(let i=0; i<parseInt(s.periodos); i++){ const fp=new Date(fi.getFullYear(),fi.getMonth()+i+1,1); const k=`${fp.getFullYear()}-${String(fp.getMonth()+1).padStart(2,'0')}`; p.push({key:k,monto:m}); }
    const fd=new Date(fi.getFullYear(),fi.getMonth()+parseInt(s.periodos)+1,1); const kd=`${fd.getFullYear()}-${String(fd.getMonth()+1).padStart(2,'0')}`; p.push({key:kd,monto:cap,esCapital:true});
    return p;
}
function calcularInfoCuota(s) {
    const [y,mo,d]=s.fecha.split('-').map(Number); const fi=new Date(y,mo-1,d); const hoy=new Date();
    let m=(hoy.getFullYear()-fi.getFullYear())*12+(hoy.getMonth()-fi.getMonth()); if(hoy.getDate()>=d) m++;
    const t=parseInt(s.periodos); const act=Math.max(0,Math.min(m,t));
    if(act>t) return "Finalizada";
    const cap=parseFloat(String(s.capital).replace(/[^\d,.-]/g,'').replace(',','.')); const g=parseFloat(String(s.ganancia).replace(',','.'));
    return `${act}/${t} • ${formatearMoneda(cap*(g/100))}`;
}
window.cambiarEstado = async(id,sel)=>{ try{ await updateDoc(doc(db,"solicitudes",id),{estado:sel.value}); sel.className=`status-select ${sel.value.toLowerCase()}`; }catch(e){alert("Error");}};
let idEditando = null;
window.editarNotificacion = (id, txt) => { idEditando = id; document.getElementById('txtNotificacion').value = (txt && txt!=='undefined') ? txt : ''; document.getElementById('modalNotificacion').classList.remove('hidden'); };
document.getElementById('btnSaveNotif').addEventListener('click', async()=>{ if(!idEditando) return; const val = document.getElementById('txtNotificacion').value.trim(); try { await updateDoc(doc(db,"solicitudes",idEditando), {comentario: val}); const item = cacheSolicitudes.find(x=>x.id===idEditando); if(item) item.comentario = val; mostrarFeedback("Guardado", "Notificación actualizada"); document.getElementById('modalNotificacion').classList.add('hidden'); } catch(e) { mostrarFeedback("Error", e.message, true); } });
const cerrarNotif = () => document.getElementById('modalNotificacion').classList.add('hidden');
document.getElementById('closeNotif').addEventListener('click', cerrarNotif);
document.getElementById('btnCancelNotif').addEventListener('click', cerrarNotif);
window.abrirReingreso = (id)=> alert("Próximamente");
document.getElementById('closeModal').addEventListener('click',()=>document.getElementById('adminModal').classList.add('hidden'));
document.getElementById('closeModalPagos').addEventListener('click',()=>document.getElementById('modalPagosAdmin').classList.add('hidden'));
document.getElementById('btnLogout').addEventListener('click',()=>signOut(auth).then(()=>window.location.href='../login.html'));