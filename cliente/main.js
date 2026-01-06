import { auth, db } from '../assets/js/firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { formatearMoneda, formatearFecha, formatearPorcentaje, mostrarNotificacion } from '../assets/js/utils.js';

let usuarioActual = null;

// --- HELPER SEGURIDAD ---
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// --- 1. AUTH GUARD ---
// --- 1. AUTH GUARD ---
onAuthStateChanged(auth, async (user) => {
    try {
        if (!user) { 
            window.location.href = '../login.html'; 
            return; 
        }
        
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // --- CORRECCIÓN AQUÍ ---
            // Leemos el rol, lo pasamos a minúsculas y si no existe, asumimos 'cliente'
            const userRol = data.rol ? data.rol.toLowerCase() : 'cliente';

            if (userRol === 'cliente' || userRol === 'admin') {
                // Si no tenía rol guardado, lo usamos en memoria como cliente
                usuarioActual = { uid: user.uid, ...data, rol: userRol };
                initDashboard();
            } else {
                // Rol explícitamente prohibido o desconocido
                console.error("Rol no autorizado:", userRol);
                alert("Acceso no autorizado para este perfil.");
                await signOut(auth);
                window.location.href = '../login.html';
            }
        } else { 
            console.error("Usuario Auth sin perfil en DB. Cerrando sesión...");
            await signOut(auth);
            window.location.href = '../login.html'; 
        }
    } catch (e) { 
        console.error("Auth error:", e); 
    }
});

// --- 2. INIT ---
async function initDashboard() {
    if(!usuarioActual) return;
    setText('nombreUsuario', usuarioActual.nombre ? usuarioActual.nombre.split(' ')[0] : 'Inversor');
    cargarDatosPerfil();
    await cargarInversiones();
}
// --- DENTRO DE TU initDashboard() o al final del archivo ---

// 1. Vincular Logout Móvil (Duplicamos la lógica del de escritorio)
const btnLogoutMobile = document.getElementById('btnCerrarSesionMobile');
if (btnLogoutMobile) {
    btnLogoutMobile.addEventListener('click', () => {
        // Usa la misma función de signOut que ya tienes
        signOut(auth).then(() => window.location.href = '../login.html');
    });
}

// 2. Vincular Editar Perfil Móvil
const btnPerfilMobile = document.getElementById('btnEditarPerfilMobile');
if (btnPerfilMobile) {
    btnPerfilMobile.addEventListener('click', () => {
        // Cierra el menú hamburguesa primero para que se vea el modal
        document.querySelector('.hamburger').click(); 
        
        // Abre el modal de perfil (misma lógica que el botón de escritorio)
        const modal = document.getElementById('modalPerfilOverlay');
        if (modal) modal.classList.remove('hidden');
    });
}

function cargarDatosPerfil() {
    document.getElementById('perfilNombre')?.setAttribute('value', usuarioActual.nombre || '');
    if(document.getElementById('perfilDni')) document.getElementById('perfilDni').value = usuarioActual.dni || '-'; 
    if(document.getElementById('perfilMail')) document.getElementById('perfilMail').value = usuarioActual.mail || '';
    if(document.getElementById('perfilTelefono')) document.getElementById('perfilTelefono').value = usuarioActual.telefono || '';
}

// --- 3. CARGA DE INVERSIONES ---
async function cargarInversiones() {
    const solicitudesTotales = [];
    const mensajeVacio = document.getElementById('mensajeSinInversiones');
    const gridContainer = document.getElementById('gridInversiones');
    if(gridContainer) gridContainer.innerHTML = "";

    try {
        const idsCarpetas = new Set();
        const vinculadasRef = collection(db, `usuarios/${usuarioActual.uid}/carpetasVinculadas`);
        const vinculadasSnap = await getDocs(vinculadasRef);
        vinculadasSnap.forEach(docV => idsCarpetas.add(docV.data().carpeta));
        
        let carpetasPropias = [];
        if (usuarioActual.dni) {
            const qDni = query(collection(db, "solicitudes"), where("dni", "==", usuarioActual.dni));
            const dniSnap = await getDocs(qDni);
            dniSnap.forEach(d => {
                const data = d.data();
                carpetasPropias.push({...data, id: d.id});
                idsCarpetas.add(data.carpeta);
            });
        }

        const unicosMap = new Map();
        carpetasPropias.forEach(c => unicosMap.set(c.carpeta, c));
        for (const numCarpeta of idsCarpetas) {
            if (!unicosMap.has(numCarpeta)) {
                const q = query(collection(db, "solicitudes"), where("carpeta", "==", numCarpeta));
                const match = await getDocs(q);
                match.forEach(m => unicosMap.set(numCarpeta, { ...m.data(), id: m.id }));
            }
        }
        const listaUnica = Array.from(unicosMap.values());

        for (const data of listaUnica) {
            const qId = query(collection(db, "solicitudes"), where("carpeta", "==", data.carpeta));
            const qIdSnap = await getDocs(qId);
            if (!qIdSnap.empty) {
                const docRef = qIdSnap.docs[0].ref;
                const reingresosSnap = await getDocs(collection(docRef, "reingresos"));
                solicitudesTotales.push({ ...data, reingresos: reingresosSnap.docs.map(r => r.data()) });
            }
        }

        solicitudesTotales.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (solicitudesTotales.length === 0) {
            if(mensajeVacio) mensajeVacio.classList.remove('hidden');
        } else {
            if(mensajeVacio) mensajeVacio.classList.add('hidden');
            solicitudesTotales.forEach(renderFilaInversion);
            calcularKpis(solicitudesTotales);
            cargarNotificaciones(solicitudesTotales);
        }
    } catch (error) { console.error("Error cargando:", error); }
}

// --- 4. KPIs ---
function calcularKpis(solicitudes) {
    const propias = solicitudes.filter(s => s.dni === usuarioActual.dni);
    if (propias.length === 0) { setText('kpiTotalInvertido', "-"); return; }

    const hoy = new Date();
    const mesActualKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const mesPasadoDate = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const mesPasadoKey = `${mesPasadoDate.getFullYear()}-${String(mesPasadoDate.getMonth() + 1).padStart(2, '0')}`;

    let totalEsteMes=0, totalMesPasado=0, totalInvertido=0, totalGenerado=0, totalRestante=0, sumaTasas=0;
    let mapaPagosFuturos={}; let todosLosPagosFuturosPlana=[]; let carpetasEsteMes=new Set();

    propias.forEach(s => {
        const capitalNum = parseFloat(String(s.capital).replace(/[^\d,.-]/g, '').replace(',', '.'));
        const tasaNum = parseFloat(String(s.ganancia).replace(',', '.'));
        totalInvertido += capitalNum; sumaTasas += tasaNum;

        const pagos = calcularPagosSimples(s);
        pagos.forEach(p => {
            if (p.key === mesActualKey) { totalEsteMes += p.monto; carpetasEsteMes.add(s.carpeta); }
            if (p.key === mesPasadoKey) totalMesPasado += p.monto;
            if (p.key <= mesActualKey) totalGenerado += p.monto;
            if (p.key > mesActualKey) { totalRestante += p.monto; todosLosPagosFuturosPlana.push({ ...p, carpeta: s.carpeta }); }
            if (p.key >= mesActualKey) {
                if (!mapaPagosFuturos[p.key]) mapaPagosFuturos[p.key] = { monto: 0, carpetas: new Set() };
                mapaPagosFuturos[p.key].monto += p.monto;
                mapaPagosFuturos[p.key].carpetas.add(s.carpeta);
            }
        });
    });

    const promedioTasa = propias.length > 0 ? (sumaTasas / propias.length) : 0;
    todosLosPagosFuturosPlana.sort((a, b) => a.key.localeCompare(b.key));
    let acumuladoSimulado = totalGenerado;
    let cuotasFaltantesParaBreakEven = 0;
    let breakEvenLogrado = acumuladoSimulado >= totalInvertido;

    if (!breakEvenLogrado) {
        for (let pago of todosLosPagosFuturosPlana) {
            acumuladoSimulado += pago.monto; cuotasFaltantesParaBreakEven++;
            if (acumuladoSimulado >= totalInvertido) { breakEvenLogrado = true; break; }
        }
    }
    renderKpiCards(totalEsteMes, totalMesPasado, totalInvertido, totalGenerado, totalRestante, promedioTasa, mapaPagosFuturos, carpetasEsteMes, hoy, cuotasFaltantesParaBreakEven, breakEvenLogrado);
}

function renderKpiCards(esteMes, mesPasado, capital, recuperado, restante, tasaPromedio, mapaFuturos, carpetasActivas, hoy, cuotasFaltan, breakEven) {
    const mesNombre = hoy.toLocaleString('es-ES', { month: 'long' });
    setText('lblMesActual', mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1));
    setText('dashTotalMes', formatearMoneda(esteMes));

    const badgeComp = document.getElementById('badgeComparacion');
    if(badgeComp) {
        const diff = esteMes - mesPasado;
        if (diff > 0) { badgeComp.className = 'badge-trend positive'; badgeComp.innerHTML = `↑ ${formatearMoneda(diff)}`; }
        else if (diff < 0) { badgeComp.className = 'badge-trend negative'; badgeComp.innerHTML = `↓ ${formatearMoneda(Math.abs(diff))}`; }
        else { badgeComp.className = 'badge-trend neutral'; badgeComp.textContent = '='; }
    }

    const divFuentes = document.getElementById('dashFuentesIngreso');
    if(divFuentes) divFuentes.innerHTML = carpetasActivas.size > 0 ? `De <strong>${carpetasActivas.size} carpetas</strong> propias.` : "Sin ingresos este mes.";

    setText('kpiTotalInvertido', formatearMoneda(capital));
    setText('kpiRendimientoPromedio', tasaPromedio.toFixed(1) + '%');
    setText('kpiGenerado', formatearMoneda(recuperado));
    setText('kpiRestante', formatearMoneda(restante));

    const pct = capital > 0 ? (recuperado / capital) * 100 : 0;
    setText('lblPorcentajeRecupero', pct.toFixed(1) + '%');
    const barFill = document.getElementById('barRecupero');
    if(barFill) barFill.style.width = Math.min(pct, 100) + '%';
    const lblMensaje = document.getElementById('lblMensajeRecupero');
    if(lblMensaje && barFill) {
        if (pct >= 100) { barFill.classList.add('profit-mode'); lblMensaje.textContent = "¡Inversión recuperada! Fase de ganancia pura 🚀"; lblMensaje.style.color = "#a628c2"; lblMensaje.style.fontWeight = "bold"; }
        else { barFill.classList.remove('profit-mode'); lblMensaje.textContent = `En ${cuotasFaltan} cuotas vas a haber recuperado el 100% de tu inversión.`; lblMensaje.style.color = "#888"; }
    }

    const fechasOrdenadas = Object.keys(mapaFuturos).sort();
    if (fechasOrdenadas.length > 0) {
        const keyProx = fechasOrdenadas[0];
        const datosProx = mapaFuturos[keyProx];
        const [a, m] = keyProx.split('-');
        const nMes = new Date(a, m - 1, 1).toLocaleString('es-ES', { month: 'long' });
        setText('dashProximoMonto', formatearMoneda(datosProx.monto));
        setText('dashProximoFecha', `${nMes.charAt(0).toUpperCase() + nMes.slice(1)} ${a}`);
        const bdg = document.getElementById('dashProximaCarpeta');
        if(bdg) { bdg.textContent = `Carpetas: ${Array.from(datosProx.carpetas).join('; ')}`; bdg.classList.remove('hidden'); }
    } else {
        setText('dashProximoMonto', "Finalizado"); setText('dashProximoFecha', "-");
        const bdg = document.getElementById('dashProximaCarpeta'); if(bdg) bdg.classList.add('hidden');
    }
}

function cargarNotificaciones(solicitudes) {
    const contenedor = document.getElementById('listaNotificaciones');
    if(!contenedor) return;

    // 1. Filtrar carpetas propias que tengan comentario
    const propias = solicitudes.filter(s => 
        s.dni === usuarioActual.dni && 
        s.comentario && 
        s.comentario.trim().length > 0
    );

    // 2. Si no hay, mostramos estado vacío (ya está en el HTML por defecto)
    if (propias.length === 0) {
        contenedor.innerHTML = `
            <div class="notif-empty">
                <span style="font-size: 1.5rem; opacity: 0.3;">📭</span>
                <p>No tienes notificaciones nuevas.</p>
            </div>`;
        return;
    }

    // 3. Renderizar Lista
    contenedor.innerHTML = ''; // Limpiar vacío
    
    propias.forEach(s => {
        const div = document.createElement('div');
        div.className = 'notif-item';
        div.innerHTML = `
            <div class="notif-header">
                <span>Carpeta #${s.carpeta}</span>
                <span>Aviso</span>
            </div>
            <div class="notif-body">"${s.comentario}"</div>
            <span class="notif-source">- Administración</span>
        `;
        contenedor.appendChild(div);
    });
}

// --- 5. RENDERIZADO TARJETAS ---
function renderFilaInversion(s) {
    const gridContainer = document.getElementById('gridInversiones');
    if (!gridContainer) return;

    let capitalTotal = parseFloat(String(s.capital).replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (s.reingresos && s.reingresos.length > 0) {
        s.reingresos.forEach(r => { capitalTotal += parseFloat(String(r.capital).replace(/[^\d,.-]/g, '').replace(',', '.')); });
    }

    const [y, m, d] = s.fecha.split('-').map(Number);
    const fechaInicio = new Date(y, m - 1, d);
    const hoy = new Date();
    let mesesTranscurridos = (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth());
    if (hoy.getDate() >= d) mesesTranscurridos++; 
    const totalCuotas = parseInt(s.periodos);
    let cuotaActual = Math.max(0, Math.min(mesesTranscurridos, totalCuotas));

    let estadoDB = s.estado ? s.estado : "Activa";
    let claseHeader = "header-activa"; 
    const estadoNorm = estadoDB.toLowerCase();
    if (estadoNorm === "pendiente") claseHeader = "header-pendiente";
    else if (estadoNorm === "bloqueada") claseHeader = "header-bloqueada";
    else if (estadoNorm === "finalizada") claseHeader = "header-finalizada";

    const tieneComentario = s.comentario && s.comentario.trim().length > 0;
    const bellIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>`;
    const bellBtnHtml = tieneComentario ? `<button class="btn-bell has-notification" title="Ver mensaje" onclick="toggleNotificacion('${s.id}')">${bellIcon}</button>` : '';
    const notifBoxHtml = tieneComentario ? `<div id="notif-${s.id}" class="notification-box"><p class="notif-content">"${s.comentario}"</p><span class="notif-signature">- Administración</span></div>` : '';

    const card = document.createElement('div');
    card.className = 'invest-card';
    card.innerHTML = `
        <div class="inv-card-header ${claseHeader}">
            <span class="inv-carpeta">#${s.carpeta}</span>
            <div class="header-controls"><span class="inv-status-text">${estadoDB.toUpperCase()}</span>${bellBtnHtml}</div>
        </div>
        ${notifBoxHtml}
        <div class="inv-card-body">
            <div class="inv-main-stat"><span class="inv-label">Capital Invertido</span><span class="inv-amount">${formatearMoneda(capitalTotal)}</span></div>
            <div class="inv-details-grid">
                <div class="inv-detail-item"><h5>Plazo / Avance</h5><p>${s.periodos} meses <span style="color:var(--accent); font-size:0.85rem">(${cuotaActual}/${s.periodos})</span></p></div>
                <div class="inv-detail-item"><h5>Tasa</h5><p>${formatearPorcentaje(s.ganancia)}</p></div>
                <div class="inv-detail-item"><h5>Unidad</h5><p>${s.unidad || 'General'}</p></div>
                <div class="inv-detail-item"><h5>Inicio</h5><p>${formatearFecha(s.fecha)}</p></div>
            </div>
            <button class="btn-details" data-id="${s.id}">Detalle de Cuotas</button>
        </div>
    `;
    card.querySelector('.btn-details').addEventListener('click', () => abrirModalDetalle(s));
    gridContainer.appendChild(card);
}

window.toggleNotificacion = (id) => { const box = document.getElementById(`notif-${id}`); if (box) box.classList.toggle('visible'); };

// --- HELPER: MODAL DETALLE ---
// --- MODAL DETALLE CLIENTE (ACTUALIZADO) ---
function abrirModalDetalle(solicitud) {
    const popup = document.getElementById('popupOverlay');
    const pagos = calcularPagosSimples(solicitud);
    const totalCuotasReales = parseInt(solicitud.periodos);
    
    // Obtenemos los pagos marcados por el admin
    const realizados = solicitud.pagosRealizados || []; // Array de keys

    let htmlHeader = `
        <div class="modal-header-row">
            <div>
                <span class="badge-carpeta" style="font-size:0.9rem; margin-bottom:5px; display:inline-block;">#${solicitud.carpeta}</span>
                <h3 style="color:var(--primary); margin:0; font-size:1.3rem;">${solicitud.unidad || 'Inversión'}</h3>
                <p style="color:#666; font-size:0.9rem; margin:5px 0 0 0;">Titular: <strong>${solicitud.nombre}</strong></p>
            </div>
            <span id="btnModalCloseX" class="close-x">&times;</span>
        </div>
    `;

    let htmlLista = `<div class="modal-list-container">`;
    const hoyKey = new Date().toISOString().slice(0, 7);
    
    pagos.forEach((p, index) => {
        const [anio, mes] = p.key.split('-');
        const fechaCorta = `${mes}/${anio.slice(2)}`; 
        
        let textoCentro;
        if (p.esCapital) textoCentro = "Devolución de Capital";
        else textoCentro = `Cuota ${index + 1} / ${totalCuotasReales}`;

        // LÓGICA DE ESTADO (PRIORIDAD AL ADMIN)
        let claseCard = '';
        let esPagada = realizados.includes(p.key); // ¿Está en la lista del admin?

        if (esPagada) {
            claseCard = 'paid'; // Verde check
        } else if (p.key === hoyKey) {
            claseCard = 'current';
            textoCentro = "Pago en Curso";
        } else if (p.key < hoyKey) {
            // Pasó la fecha y NO está pagada -> Pendiente/Atrasada (Visualmente pending por ahora)
            claseCard = 'pending'; 
        } else {
            claseCard = 'pending';
        }
        
        htmlLista += `
            <div class="quota-card ${claseCard}">
                <div class="quota-col left"><span class="q-date">${fechaCorta}</span></div>
                <div class="quota-col center"><span class="q-date" style="font-weight:600; font-size:0.95rem;">${textoCentro}</span></div>
                <div class="quota-col right"><span class="q-amount">${formatearMoneda(p.monto)}</span></div>
            </div>
        `;
    });
    
    htmlLista += `</div>`;
    let htmlFooter = `<button id="btnCerrarPopupInner" class="btn-primary" style="width:100%">Cerrar</button>`;

    // Render (asegura que popupOverlay esté vacío en HTML inicial o usa innerHTML)
    const container = document.getElementById('popupOverlay');
    container.innerHTML = `<div class="popup"><div class="popup-inner">${htmlHeader}${htmlLista}${htmlFooter}</div></div>`;
    
    container.classList.remove('hidden');
    
    // Listeners del nuevo DOM
    const popupEl = container.querySelector('.popup');
    popupEl.querySelector('#btnModalCloseX').addEventListener('click', () => container.classList.add('hidden'));
    popupEl.querySelector('#btnCerrarPopupInner').addEventListener('click', () => container.classList.add('hidden'));

    setTimeout(() => {
        const tarjetaActual = popupEl.querySelector('.quota-card.current');
        if(tarjetaActual) tarjetaActual.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
}

function calcularPagosSimples(solicitud) {
    const pagos = [];
    const { capital, ganancia, periodos, fecha } = solicitud;
    const cap = parseFloat(String(capital).replace(/[^\d,.-]/g, '').replace(',', '.'));
    const g = parseFloat(String(ganancia).replace(',', '.')) / 100;
    const mensual = cap * g;
    const [y, m, d] = fecha.split('-').map(Number);
    const fIngreso = new Date(y, m - 1, d);

    for (let i = 0; i < parseInt(periodos); i++) {
        const fPago = new Date(fIngreso.getFullYear(), fIngreso.getMonth() + i + 1, 1);
        const key = `${fPago.getFullYear()}-${String(fPago.getMonth() + 1).padStart(2, '0')}`;
        pagos.push({ key, monto: mensual });
    }
    const fDevol = new Date(fIngreso.getFullYear(), fIngreso.getMonth() + parseInt(periodos) + 1, 1);
    const keyDev = `${fDevol.getFullYear()}-${String(fDevol.getMonth() + 1).padStart(2, '0')}`;
    pagos.push({ key: keyDev, monto: cap, esCapital: true });
    return pagos;
}

// --- 6. EVENT LISTENERS ---
const modalPerfil = document.getElementById('modalPerfilOverlay');
document.getElementById('btnEditarPerfil')?.addEventListener('click', () => modalPerfil.classList.remove('hidden'));
document.getElementById('btnCerrarPerfilX')?.addEventListener('click', () => modalPerfil.classList.add('hidden'));
modalPerfil?.addEventListener('click', (e) => { if(e.target===modalPerfil) modalPerfil.classList.add('hidden'); });

const btnEditTel = document.getElementById('btnHabilitarEdicion');
const btnCancelTel = document.getElementById('btnCancelarEdicion');
const btnSaveTel = document.getElementById('btnGuardarEdicion');
if(btnEditTel) btnEditTel.addEventListener('click', () => { const el=document.getElementById('perfilTelefono'); el.disabled=false; el.focus(); el.style.background='#fff'; el.style.borderColor='#2E7D32'; btnEditTel.classList.add('hidden'); btnCancelTel.classList.remove('hidden'); btnSaveTel.classList.remove('hidden'); });
if(btnCancelTel) btnCancelTel.addEventListener('click', () => { const el=document.getElementById('perfilTelefono'); el.value=usuarioActual.telefono||''; el.disabled=true; el.style.background=''; el.style.borderColor=''; btnEditTel.classList.remove('hidden'); btnCancelTel.classList.add('hidden'); btnSaveTel.classList.add('hidden'); });
if(btnSaveTel) btnSaveTel.addEventListener('click', async () => {
    const val = document.getElementById('perfilTelefono').value.trim();
    if(!val) return mostrarNotificacion("Ingrese un teléfono", "error");
    btnSaveTel.textContent = "...";
    try { await updateDoc(doc(db, "usuarios", usuarioActual.uid), { telefono: val }); usuarioActual.telefono = val; mostrarNotificacion("Teléfono actualizado", "success"); btnCancelTel.click(); }
    catch(e) { mostrarNotificacion("Error al guardar", "error"); } finally { btnSaveTel.textContent = "Guardar Cambios"; }
});

const modalVinculo = document.getElementById('modalVincularOverlay');
document.getElementById('btnAgregarCarpeta')?.addEventListener('click', () => { modalVinculo.classList.remove('hidden'); document.getElementById('inputNumeroCarpeta').focus(); });
document.getElementById('btnCerrarVincularX')?.addEventListener('click', () => modalVinculo.classList.add('hidden'));
modalVinculo?.addEventListener('click', (e) => { if(e.target===modalVinculo) modalVinculo.classList.add('hidden'); });
document.getElementById('btnBuscarCarpeta')?.addEventListener('click', async () => {
    const input = document.getElementById('inputNumeroCarpeta');
    const resDiv = document.getElementById('resultadoBusquedaModal');
    const num = input.value.trim();
    resDiv.innerHTML = '<div class="spinner" style="display:block; margin:20px auto;"></div>';
    if(!num) { resDiv.innerHTML = '<p style="text-align:center; color:#d32f2f">Ingrese un número.</p>'; return; }
    try {
        const snap = await getDocs(query(collection(db, "solicitudes"), where("carpeta", "==", num)));
        if(snap.empty) resDiv.innerHTML = '<p style="text-align:center; color:#d32f2f">Carpeta no encontrada.</p>';
        else {
            const d = snap.docs[0].data();
            const tasa = d.ganancia ? `${d.ganancia}%` : '-';
            resDiv.innerHTML = `<div class="card-resultado-vinculo"><div class="card-res-header"><span class="badge-carpeta">#${num} - ${d.nombre ? d.nombre.split(' ')[0] : 'INV'}</span><div class="info-tasa"><span class="text-tasa">${tasa}</span><span class="text-plazo">${d.periodos} meses</span></div></div><div class="monto-grande">${formatearMoneda(d.capital)}</div><div class="card-res-footer"><span class="label-dato">${formatearFecha(d.fecha)}</span><span class="label-dato">${d.unidad || 'General'}</span></div></div><button id="btnConfirmarVinculo" class="btn-primary" style="width:100%">Vincular a mi perfil</button>`;
            document.getElementById('btnConfirmarVinculo').addEventListener('click', async () => {
                const btn = document.getElementById('btnConfirmarVinculo'); btn.textContent = "Vinculando..."; btn.disabled = true;
                try { await setDoc(doc(collection(db, `usuarios/${usuarioActual.uid}/carpetasVinculadas`)), { carpeta: num, fecha: new Date().toISOString() }); mostrarNotificacion("¡Vinculada con éxito!", "success"); input.value = ""; resDiv.innerHTML = ""; modalVinculo.classList.add('hidden'); cargarInversiones(); }
                catch(e) { mostrarNotificacion("Error: " + e.message, "error"); btn.textContent = "Vincular"; btn.disabled = false; }
            });
        }
    } catch(e) { resDiv.innerHTML = '<p style="text-align:center; color:red">Error de conexión.</p>'; }
});

document.getElementById('btnCerrarSesion')?.addEventListener('click', () => signOut(auth).then(() => window.location.href = '../login.html'));
document.getElementById('btnCerrarPopup')?.addEventListener('click', () => document.getElementById('popupOverlay').classList.add('hidden'));