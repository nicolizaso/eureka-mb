import { auth, db } from '../assets/js/firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { formatearMoneda, formatearFecha, formatearPorcentaje, mostrarNotificacion } from '../assets/js/utils.js';

let usuarioActual = null;
const FECHA_CORTE_LEGACY = '2025-12';

// --- HELPER UI ---
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ======================================================
// 1. AUTH GUARD & INICIALIZACIÓN
// ======================================================
onAuthStateChanged(auth, async (user) => {
    try {
        if (!user) { 
            window.location.href = '../login.html'; 
            return; 
        }
        
        // Obtenemos el perfil del usuario de la base de datos
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Normalizamos el rol (ej: "Admin" -> "admin")
            const userRol = data.rol ? data.rol.toLowerCase() : 'cliente';

            // Permitimos acceso a clientes y admins (modo vista cliente)
            if (userRol === 'cliente' || userRol === 'admin') {
                usuarioActual = { uid: user.uid, ...data, rol: userRol };
                initDashboard();
            } else {
                console.error("Rol no autorizado:", userRol);
                alert("Acceso no autorizado para este perfil.");
                await signOut(auth);
                window.location.href = '../login.html';
            }
        } else { 
            // Si el usuario existe en Auth pero no en DB (caso raro o error de registro)
            console.error("Usuario Auth sin perfil en DB. Cerrando sesión...");
            await signOut(auth);
            window.location.href = '../login.html'; 
        }
    } catch (e) { 
        console.error("Auth error:", e); 
    }
});

async function initDashboard() {
    if(!usuarioActual) return;
    
    // 1. Configurar UI básica
    setText('nombreUsuario', usuarioActual.nombre ? usuarioActual.nombre.split(' ')[0] : 'Inversor');
    cargarDatosPerfil();

    // 2. Cargar Datos Financieros
    await cargarInversiones();
}

// ======================================================
// 2. LOGICA DE PERFIL (MOBILE & DESKTOP)
// ======================================================

// Botón Logout Móvil
const btnLogoutMobile = document.getElementById('btnCerrarSesionMobile');
if (btnLogoutMobile) {
    btnLogoutMobile.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = '../login.html');
    });
}

// Botón Editar Perfil Móvil
const btnPerfilMobile = document.getElementById('btnEditarPerfilMobile');
if (btnPerfilMobile) {
    btnPerfilMobile.addEventListener('click', () => {
        // Cierra menú hamburguesa
        const hamburger = document.querySelector('.hamburger');
        if(hamburger) hamburger.click(); 
        // Abre modal
        const modal = document.getElementById('modalPerfilOverlay');
        if (modal) modal.classList.remove('hidden');
    });
}

function cargarDatosPerfil() {
    // Llena los inputs del modal de perfil
    const inputNombre = document.getElementById('perfilNombre');
    if(inputNombre) inputNombre.setAttribute('value', usuarioActual.nombre || '');
    
    if(document.getElementById('perfilDni')) document.getElementById('perfilDni').value = usuarioActual.dni || '-'; 
    if(document.getElementById('perfilMail')) document.getElementById('perfilMail').value = usuarioActual.mail || '';
    if(document.getElementById('perfilTelefono')) document.getElementById('perfilTelefono').value = usuarioActual.telefono || '';
}

// ======================================================
// 3. CARGA DE INVERSIONES (CORE FIX)
// ======================================================
// ======================================================
// 3. CARGA DE INVERSIONES (OPTIMIZADA CON CACHÉ)
// ======================================================
// ======================================================
// 3. CARGA DE INVERSIONES (CON TTL Y REFRESH)
// ======================================================
async function cargarInversiones(forzarRecarga = false) {
    const gridContainer = document.getElementById('gridInversiones');
    const mensajeVacio = document.getElementById('mensajeSinInversiones');
    const btnRefresh = document.getElementById('btnRefrescarInversiones');
    
    // Animación del botón refresh si se fuerza la recarga
    if(forzarRecarga && btnRefresh) {
        btnRefresh.style.animation = "spin 1s linear infinite";
        btnRefresh.disabled = true;
    }

    if(gridContainer) gridContainer.innerHTML = "";
    
    let solicitudesTotales = [];
    const CACHE_KEY = `inversiones_cache_${usuarioActual.uid}`;
    // TIEMPO DE VIDA DEL CACHÉ: 15 Minutos (en milisegundos)
    const CACHE_TTL = 15 * 60 * 1000; 
    
    // 1. Intentamos leer del caché
    const cachedRaw = sessionStorage.getItem(CACHE_KEY);
    
    let usarCache = false;

    if (!forzarRecarga && cachedRaw) {
        try {
            const cacheObj = JSON.parse(cachedRaw);
            const ahora = Date.now();
            
            // Verificamos si el caché es válido y no ha expirado
            if (cacheObj.timestamp && (ahora - cacheObj.timestamp < CACHE_TTL)) {
                console.log("⚡ [CACHE] Usando datos locales (Válidos por " + ((CACHE_TTL - (ahora - cacheObj.timestamp))/60000).toFixed(1) + " min más)");
                solicitudesTotales = cacheObj.data;
                usarCache = true;
            } else {
                console.log("⏰ [CACHE] Expirado. Descargando nuevos datos...");
            }
        } catch(e) {
            console.warn("Error leyendo caché, forzando recarga.");
        }
    }

    // Si el caché es válido, renderizamos y salimos
    if (usarCache) {
        procesarYRenderizar(solicitudesTotales, mensajeVacio);
        return;
    }

    // 2. Si no hay caché válido, vamos a Firebase
    try {
        console.log("🔥 [FIREBASE] Descargando datos frescos...");

        if (!usuarioActual || !usuarioActual.dni) {
            if(mensajeVacio) mensajeVacio.classList.remove('hidden');
            return;
        }

        const q = query(collection(db, "solicitudes"), where("dni", "==", usuarioActual.dni));
        const querySnapshot = await getDocs(q);

        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            const solicitud = { ...data, id: docSnap.id };
            const reingresosSnap = await getDocs(collection(docSnap.ref, "reingresos"));
            solicitud.reingresos = reingresosSnap.docs.map(r => r.data());
            solicitudesTotales.push(solicitud);
        }

        // 3. GUARDAMOS EN CACHÉ CON TIMESTAMP
        const cacheData = {
            timestamp: Date.now(),
            data: solicitudesTotales
        };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

        procesarYRenderizar(solicitudesTotales, mensajeVacio);

    } catch (error) { 
        console.error("Error cargando inversiones:", error);
        mostrarNotificacion("Error de conexión", "error");
    } finally {
        // Detener animación del botón refresh
        if(btnRefresh) {
            btnRefresh.style.animation = "none";
            btnRefresh.disabled = false;
        }
    }
}

// --- LISTENER DEL BOTÓN REFRESH ---
// Agrega esto al final del archivo o en la sección de listeners
document.getElementById('btnRefrescarInversiones')?.addEventListener('click', () => {
    cargarInversiones(true); // true = Forzar recarga (ignorar caché)
});

// --- HELPER DE RENDERIZADO (Para no repetir código) ---
function procesarYRenderizar(lista, elementoMensaje) {
    if (lista.length === 0) {
        if(elementoMensaje) elementoMensaje.classList.remove('hidden');
    } else {
        if(elementoMensaje) elementoMensaje.classList.add('hidden');
        
        // Ordenar por fecha
        lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        // Dibujar tarjetas
        lista.forEach(renderFilaInversion);
        
        // Calcular Dashboard
        calcularKpis(lista);
        
        // Notificaciones
        cargarNotificaciones(lista);
    }
}

// ======================================================
// 4. CÁLCULO DE KPIs (DASHBOARD SUPERIOR)
// ======================================================
function calcularKpis(solicitudes) {
    const propias = solicitudes.filter(s => s.dni === usuarioActual.dni);
    
    if (propias.length === 0) { 
        setText('kpiTotalInvertido', "-"); 
        return; 
    }

    const hoy = new Date();
    const mesActualKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const mesPasadoDate = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const mesPasadoKey = `${mesPasadoDate.getFullYear()}-${String(mesPasadoDate.getMonth() + 1).padStart(2, '0')}`;

    let totalEsteMes=0, totalMesPasado=0, totalInvertido=0, totalGenerado=0, totalRestante=0, sumaTasas=0;
    let mapaPagosFuturos={}; 
    let todosLosPagosFuturosPlana=[]; 
    let carpetasEsteMes=new Set();

    propias.forEach(s => {
        const capitalNum = parseFloat(String(s.capital).replace(/[^\d,.-]/g, '').replace(',', '.'));
        let capitalAcumulado = capitalNum;
        if(s.reingresos) {
            s.reingresos.forEach(r => {
                capitalAcumulado += parseFloat(String(r.capital).replace(/[^\d,.-]/g, '').replace(',', '.'));
            });
        }
        
        const tasaNum = parseFloat(String(s.ganancia).replace(',', '.'));
        totalInvertido += capitalAcumulado; 
        sumaTasas += tasaNum;

        // --- VALIDACIÓN DE ESTADO ---
        // Solo las carpetas ACTIVAS suman para el futuro.
        const estadoNorm = s.estado ? s.estado.toLowerCase() : 'activa';
        const esCarpetaActiva = estadoNorm === 'activa'; 

        const pagos = calcularPagosSimples(s);
        pagos.forEach(p => {
            // Histórico (siempre suma)
            if (p.key === mesActualKey) { 
                totalEsteMes += p.monto; 
                carpetasEsteMes.add(s.carpeta); 
            }
            if (p.key === mesPasadoKey) totalMesPasado += p.monto;
            if (p.key <= mesActualKey) totalGenerado += p.monto;

            // Futuro (Solo si es ACTIVA)
            if (p.key > mesActualKey) { 
                if (esCarpetaActiva) {
                    totalRestante += p.monto; 
                    todosLosPagosFuturosPlana.push({ ...p, carpeta: s.carpeta }); 
                    
                    if (!mapaPagosFuturos[p.key]) mapaPagosFuturos[p.key] = { monto: 0, carpetas: new Set() };
                    mapaPagosFuturos[p.key].monto += p.monto;
                    mapaPagosFuturos[p.key].carpetas.add(s.carpeta);
                }
            }
        });
    });

    const promedioTasa = propias.length > 0 ? (sumaTasas / propias.length) : 0;
    
    // Break Even
    todosLosPagosFuturosPlana.sort((a, b) => a.key.localeCompare(b.key));
    let acumuladoSimulado = totalGenerado;
    let cuotasFaltantesParaBreakEven = 0;
    let breakEvenLogrado = acumuladoSimulado >= totalInvertido;

    if (!breakEvenLogrado) {
        for (let pago of todosLosPagosFuturosPlana) {
            acumuladoSimulado += pago.monto; 
            cuotasFaltantesParaBreakEven++;
            if (acumuladoSimulado >= totalInvertido) { 
                breakEvenLogrado = true; 
                break; 
            }
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
        if (diff > 0) { 
            badgeComp.className = 'badge-trend positive'; 
            badgeComp.innerHTML = `↑ ${formatearMoneda(diff)}`; 
        } else if (diff < 0) { 
            badgeComp.className = 'badge-trend negative'; 
            badgeComp.innerHTML = `↓ ${formatearMoneda(Math.abs(diff))}`; 
        } else { 
            badgeComp.className = 'badge-trend neutral'; 
            badgeComp.textContent = '='; 
        }
    }

    const divFuentes = document.getElementById('dashFuentesIngreso');
    if(divFuentes) divFuentes.innerHTML = carpetasActivas.size > 0 ? `De <strong>${carpetasActivas.size} carpetas</strong> propias.` : "Sin ingresos este mes.";

    setText('kpiTotalInvertido', formatearMoneda(capital));
    setText('kpiRendimientoPromedio', tasaPromedio.toFixed(1) + '%');
    setText('kpiGenerado', formatearMoneda(recuperado));
    setText('kpiRestante', formatearMoneda(restante));

    // Barra de Recupero (Lógica standard)
    const pct = capital > 0 ? (recuperado / capital) * 100 : 0;
    setText('lblPorcentajeRecupero', pct.toFixed(1) + '%');
    const barFill = document.getElementById('barRecupero');
    if(barFill) barFill.style.width = Math.min(pct, 100) + '%';
    const lblMensaje = document.getElementById('lblMensajeRecupero');
    if(lblMensaje && barFill) {
        if (pct >= 100) { 
            barFill.classList.add('profit-mode'); 
            lblMensaje.textContent = "¡Inversión recuperada! Fase de ganancia pura 🚀"; 
            lblMensaje.style.color = "#a628c2"; 
            lblMensaje.style.fontWeight = "bold"; 
        } else { 
            barFill.classList.remove('profit-mode'); 
            lblMensaje.textContent = `En ${cuotasFaltan} cuotas vas a haber recuperado el 100% de tu inversión.`; 
            lblMensaje.style.color = "#888"; 
        }
    }

    // --- LÓGICA DE VISUALIZACIÓN (LEGACY VS NUEVO) ---
    // Determinamos si es un usuario con carpetas viejas basándonos en si definimos la constante de corte
    const MODO_LEGACY = (typeof FECHA_CORTE_LEGACY !== 'undefined'); 

    const cardProximo = document.getElementById('cardProximoCobro');
    const cardResumen = document.getElementById('cardResumen');
    const boxRestante = document.getElementById('boxRestante');
    const boxRecupero = document.getElementById('boxRecupero');

    if (MODO_LEGACY) {
        // 1. OCULTAR Tarjeta "Próximo Cobro"
        if (cardProximo) cardProximo.classList.add('hidden-layout');

        // 2. AJUSTAR Tarjeta "Resumen" (Quitar full-height)
        if (cardResumen) {
            cardResumen.classList.remove('full-height-card');
            cardResumen.style.height = 'auto'; 
            cardResumen.style.minHeight = '250px'; // Misma altura base que Novedades
        }

        // 3. OCULTAR métricas internas (Restante y Barra)
        if (boxRestante) boxRestante.classList.add('hidden-layout');
        if (boxRecupero) boxRecupero.classList.add('hidden-layout');

        // Ajuste cosmético de la grilla de métricas para rellenar huecos
        const metricsGrid = document.querySelector('.metrics-grid');
        if(metricsGrid) metricsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(30%, 1fr))';

    } else {
        // --- MODO STANDARD (Mostrar Próximo Cobro) ---
        const fechasOrdenadas = Object.keys(mapaFuturos).sort();
        if (fechasOrdenadas.length > 0) {
             const keyProx = fechasOrdenadas[0];
             const datosProx = mapaFuturos[keyProx];
             const [a, m] = keyProx.split('-');
             const nMes = new Date(a, m - 1, 1).toLocaleString('es-ES', { month: 'long' });
             
             setText('dashProximoMonto', formatearMoneda(datosProx.monto));
             setText('dashProximoFecha', `${nMes.charAt(0).toUpperCase() + nMes.slice(1)} ${a}`);
             
             const bdg = document.getElementById('dashProximaCarpeta');
             if(bdg) { 
                 bdg.textContent = `Carpetas: ${Array.from(datosProx.carpetas).join('; ')}`; 
                 bdg.classList.remove('hidden'); 
             }
        } else {
             setText('dashProximoMonto', "Finalizado"); 
             setText('dashProximoFecha', "-");
             const bdg = document.getElementById('dashProximaCarpeta'); 
             if(bdg) bdg.classList.add('hidden');
        }
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

    // 2. Si no hay, mostramos estado vacío
    if (propias.length === 0) {
        contenedor.innerHTML = `
            <div class="notif-empty">
                <span style="font-size: 1.5rem; opacity: 0.3;">📭</span>
                <p>No tienes notificaciones nuevas.</p>
            </div>`;
        return;
    }

    // 3. Renderizar Lista
    contenedor.innerHTML = ''; 
    
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

// ======================================================
// 5. RENDERIZADO TARJETAS DE INVERSIÓN
// ======================================================
function renderFilaInversion(s) {
    const gridContainer = document.getElementById('gridInversiones');
    if (!gridContainer) return;

    // Calcular capital total (Base + Reingresos)
    let capitalTotal = parseFloat(String(s.capital).replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (s.reingresos && s.reingresos.length > 0) {
        s.reingresos.forEach(r => { 
            capitalTotal += parseFloat(String(r.capital).replace(/[^\d,.-]/g, '').replace(',', '.')); 
        });
    }

    // Calcular progreso de cuotas
    const [y, m, d] = s.fecha.split('-').map(Number);
    const fechaInicio = new Date(y, m - 1, d);
    const hoy = new Date();
    
    let mesesTranscurridos = (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth());
    if (hoy.getDate() >= d) mesesTranscurridos++; 
    
    const totalCuotas = parseInt(s.periodos);
    let cuotaActual = Math.max(0, Math.min(mesesTranscurridos, totalCuotas));

    // Estado visual
    let estadoDB = s.estado ? s.estado : "Activa";
    let claseHeader = "header-activa"; 
    const estadoNorm = estadoDB.toLowerCase();
    
    if (estadoNorm === "pendiente") claseHeader = "header-pendiente";
    else if (estadoNorm === "bloqueada") claseHeader = "header-bloqueada";
    else if (estadoNorm === "finalizada") claseHeader = "header-finalizada";

    // Notificaciones en la tarjeta
    const tieneComentario = s.comentario && s.comentario.trim().length > 0;
    const bellIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>`;
    const bellBtnHtml = tieneComentario ? `<button class="btn-bell has-notification" title="Ver mensaje" onclick="toggleNotificacion('${s.id}')">${bellIcon}</button>` : '';
    const notifBoxHtml = tieneComentario ? `<div id="notif-${s.id}" class="notification-box"><p class="notif-content">"${s.comentario}"</p><span class="notif-signature">- Administración</span></div>` : '';

    const card = document.createElement('div');
    card.className = 'invest-card';
    card.innerHTML = `
        <div class="inv-card-header ${claseHeader}">
            <span class="inv-carpeta">#${s.carpeta}</span>
            <div class="header-controls">
                <span class="inv-status-text">${estadoDB.toUpperCase()}</span>
                ${bellBtnHtml}
            </div>
        </div>
        ${notifBoxHtml}
        <div class="inv-card-body">
            <div class="inv-main-stat">
                <span class="inv-label">Capital Invertido</span>
                <span class="inv-amount">${formatearMoneda(capitalTotal)}</span>
            </div>
            <div class="inv-details-grid">
                <div class="inv-detail-item">
                    <h5>Plazo / Avance</h5>
                    <p>${s.periodos} meses <span style="color:var(--accent); font-size:0.85rem">(${cuotaActual}/${s.periodos})</span></p>
                </div>
                <div class="inv-detail-item">
                    <h5>Tasa</h5>
                    <p>${formatearPorcentaje(s.ganancia)}</p>
                </div>
                <div class="inv-detail-item">
                    <h5>Unidad</h5>
                    <p>${s.unidad || 'General'}</p>
                </div>
                <div class="inv-detail-item">
                    <h5>Inicio</h5>
                    <p>${formatearFecha(s.fecha)}</p>
                </div>
            </div>
            <button class="btn-details" data-id="${s.id}">Detalle de Cuotas</button>
        </div>
    `;
    
    card.querySelector('.btn-details').addEventListener('click', () => abrirModalDetalle(s));
    gridContainer.appendChild(card);
}

// Función global para el botón de notificación (inline HTML)
window.toggleNotificacion = (id) => { 
    const box = document.getElementById(`notif-${id}`); 
    if (box) box.classList.toggle('visible'); 
};

// ======================================================
// 6. MODAL DETALLE (TABLA DE PAGOS)
// ======================================================
function abrirModalDetalle(solicitud) {
    const popup = document.getElementById('popupOverlay');
    
    // CAMBIO 1: Usamos 'let' en lugar de 'const' para poder filtrar el array
    let pagos = calcularPagosSimples(solicitud); 
    const totalCuotasReales = parseInt(solicitud.periodos);
    
    // Obtenemos los pagos marcados como realizados por el admin
    const realizados = solicitud.pagosRealizados || []; // Array de keys 'YYYY-MM'

    // --- LÓGICA LEGACY: FILTRADO Y TBD ---
    // Definimos la fecha de corte (si no está la variable global, usa '2025-12' por seguridad)
    const fechaCorte = (typeof FECHA_CORTE_LEGACY !== 'undefined') ? FECHA_CORTE_LEGACY : '2025-12';

    // 1. Filtramos: Solo pasan cuotas anteriores a la fecha de corte O la devolución de capital
    pagos = pagos.filter(p => p.key <= fechaCorte || p.esCapital);

    // 2. Modificamos Capital: Si es Capital, forzamos la fecha visual a TBD
    pagos.forEach(p => {
        if (p.esCapital) {
            p.fechaVisual = 'TBD'; // Bandera visual
            p.textoCentroOverride = 'Devolución de Capital (A definir)';
        }
    });
    // -------------------------------------

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
        // Lógica de visualización de fecha (CAMBIO 2: Soporte para TBD)
        let fechaMostrar;
        if (p.fechaVisual === 'TBD') {
            fechaMostrar = '<span style="font-weight:800; color:var(--accent);">TBD</span>';
        } else {
            const [anio, mes] = p.key.split('-');
            fechaMostrar = `${mes}/${anio.slice(2)}`;
        }
        
        let textoCentro;
        // (CAMBIO 3: Prioridad al texto override si existe)
        if (p.textoCentroOverride) {
            textoCentro = p.textoCentroOverride;
        } else if (p.esCapital) {
            textoCentro = "Devolución de Capital";
        } else {
            // Simplificamos el texto ya que cortamos el total de cuotas visibles
            textoCentro = `Cuota ${index + 1}`; 
        }

        // LÓGICA DE ESTADO
        let claseCard = '';
        let esPagada = realizados.includes(p.key); // Verificación real contra DB

        if (esPagada) {
            claseCard = 'paid'; // Verde
        } else if (p.key === hoyKey && !p.esCapital) {
            claseCard = 'current'; // Borde destacado
            textoCentro = "Pago en Curso";
        } else if (p.key < hoyKey && !p.esCapital) {
            claseCard = 'pending'; // Pendiente/Atrasado
        } else {
            claseCard = 'pending'; // Futuro
            // Si es Capital TBD, le damos un estilo visual distinto (opcional)
            if(p.fechaVisual === 'TBD') claseCard = 'future-capital';
        }
        
        htmlLista += `
            <div class="quota-card ${claseCard}">
                <div class="quota-col left"><span class="q-date">${fechaMostrar}</span></div>
                <div class="quota-col center"><span class="q-date" style="font-weight:600; font-size:0.95rem;">${textoCentro}</span></div>
                <div class="quota-col right"><span class="q-amount">${formatearMoneda(p.monto)}</span></div>
            </div>
        `;
    });
    
    htmlLista += `</div>`;
    let htmlFooter = `<button id="btnCerrarPopupInner" class="btn-primary" style="width:100%">Cerrar</button>`;

    // Insertar en DOM
    const container = document.getElementById('popupOverlay');
    container.innerHTML = `<div class="popup"><div class="popup-inner">${htmlHeader}${htmlLista}${htmlFooter}</div></div>`;
    
    container.classList.remove('hidden');
    
    // Listeners del modal generado dinámicamente
    const popupEl = container.querySelector('.popup');
    popupEl.querySelector('#btnModalCloseX').addEventListener('click', () => container.classList.add('hidden'));
    popupEl.querySelector('#btnCerrarPopupInner').addEventListener('click', () => container.classList.add('hidden'));

    // Scroll automático a la cuota actual
    setTimeout(() => {
        const tarjetaActual = popupEl.querySelector('.quota-card.current');
        if(tarjetaActual) tarjetaActual.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
}

function calcularPagosSimples(solicitud) {
    const pagos = [];
    const { capital, ganancia, periodos, fecha } = solicitud;
    
    // Limpieza de datos
    const cap = parseFloat(String(capital).replace(/[^\d,.-]/g, '').replace(',', '.'));
    
    let capitalTotalCalculo = cap;
    if(solicitud.reingresos) {
        solicitud.reingresos.forEach(r => {
             capitalTotalCalculo += parseFloat(String(r.capital).replace(/[^\d,.-]/g, '').replace(',', '.'));
        });
    }

    const g = parseFloat(String(ganancia).replace(',', '.')) / 100;
    const mensual = capitalTotalCalculo * g;
    
    const [y, m, d] = fecha.split('-').map(Number);
    const fIngreso = new Date(y, m - 1, d);

    // Generar cuotas de interés
    for (let i = 0; i < parseInt(periodos); i++) {
        const fPago = new Date(fIngreso.getFullYear(), fIngreso.getMonth() + i + 1, 1);
        const key = `${fPago.getFullYear()}-${String(fPago.getMonth() + 1).padStart(2, '0')}`;
        pagos.push({ key, monto: mensual });
    }
    
    // Generar devolución de capital (última)
    const fDevol = new Date(fIngreso.getFullYear(), fIngreso.getMonth() + parseInt(periodos) + 1, 1);
    const keyDev = `${fDevol.getFullYear()}-${String(fDevol.getMonth() + 1).padStart(2, '0')}`;
    pagos.push({ key: keyDev, monto: capitalTotalCalculo, esCapital: true });
    
    return pagos;
}

// ======================================================
// 7. EVENT LISTENERS GENERALES
// ======================================================

// Modal Perfil
const modalPerfilOverlay = document.getElementById('modalPerfilOverlay');
document.getElementById('btnEditarPerfil')?.addEventListener('click', () => modalPerfilOverlay.classList.remove('hidden'));
document.getElementById('btnCerrarPerfilX')?.addEventListener('click', () => modalPerfilOverlay.classList.add('hidden'));
modalPerfilOverlay?.addEventListener('click', (e) => { if(e.target===modalPerfilOverlay) modalPerfilOverlay.classList.add('hidden'); });

// Edición de Teléfono
const btnEditTel = document.getElementById('btnHabilitarEdicion');
const btnCancelTel = document.getElementById('btnCancelarEdicion');
const btnSaveTel = document.getElementById('btnGuardarEdicion');

if(btnEditTel) {
    btnEditTel.addEventListener('click', () => { 
        const el = document.getElementById('perfilTelefono'); 
        el.disabled = false; 
        el.focus(); 
        el.style.background = '#fff'; 
        el.style.borderColor = '#2E7D32'; 
        btnEditTel.classList.add('hidden'); 
        btnCancelTel.classList.remove('hidden'); 
        btnSaveTel.classList.remove('hidden'); 
    });
}

if(btnCancelTel) {
    btnCancelTel.addEventListener('click', () => { 
        const el = document.getElementById('perfilTelefono'); 
        el.value = usuarioActual.telefono || ''; 
        el.disabled = true; 
        el.style.background = ''; 
        el.style.borderColor = ''; 
        btnEditTel.classList.remove('hidden'); 
        btnCancelTel.classList.add('hidden'); 
        btnSaveTel.classList.add('hidden'); 
    });
}

if(btnSaveTel) {
    btnSaveTel.addEventListener('click', async () => {
        const val = document.getElementById('perfilTelefono').value.trim();
        if(!val) return mostrarNotificacion("Ingrese un teléfono válido", "error");
        
        btnSaveTel.textContent = "...";
        try { 
            await updateDoc(doc(db, "usuarios", usuarioActual.uid), { telefono: val }); 
            usuarioActual.telefono = val; 
            mostrarNotificacion("Teléfono actualizado", "success"); 
            btnCancelTel.click(); 
        } catch(e) { 
            mostrarNotificacion("Error al guardar en base de datos", "error"); 
        } finally { 
            btnSaveTel.textContent = "Guardar Cambios"; 
        }
    });
}

// Botón Cerrar Sesión Desktop
document.getElementById('btnCerrarSesion')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = '../login.html');
});

// Listener genérico para cerrar cualquier popup overlay
document.getElementById('btnCerrarPopup')?.addEventListener('click', () => {
    document.getElementById('popupOverlay').classList.add('hidden');
});