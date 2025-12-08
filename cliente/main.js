// IMPORTANTE: Asegúrate que la ruta a utils.js y firebase.js sea correcta
import { auth, db } from '../assets/js/firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
// Importamos los helpers. NO volver a declararlos abajo.
import { formatearMoneda, formatearFecha, formatearPorcentaje } from '../assets/js/utils.js';

let usuarioActual = null;

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
            // Permitimos acceso a clientes y admins (para que el admin pueda testear vista de usuario si quisiera, o filtramos estricto)
            // Aquí lo dejamos estricto para cliente:
             if (docSnap.data().rol === 'cliente' || docSnap.data().rol === 'admin') { 
                // Nota: dejo pasar al admin también para que no tengas que crear cuenta nueva para probar
                usuarioActual = { uid: user.uid, ...docSnap.data() };
                initDashboard();
            } else {
                window.location.href = '../login.html';
            }
        } else {
            // Usuario en Auth pero no en DB (raro)
            console.error("Usuario sin registro en base de datos");
            signOut(auth);
        }
    } catch (e) {
        // Captura errores silenciosos de extensiones
        console.error("Error en auth state:", e);
    }
});

// --- 2. FUNCIONES PRINCIPALES ---
async function initDashboard() {
    if(!usuarioActual) return;
    
    // UI Update seguro
    const nombreEl = document.getElementById('nombreUsuario');
    if(nombreEl) nombreEl.textContent = usuarioActual.nombre ? usuarioActual.nombre.split(' ')[0] : 'Inversor';

    cargarDatosPerfil();
    await cargarInversiones();
}

function cargarDatosPerfil() {
    document.getElementById('perfilNombre')?.setAttribute('value', usuarioActual.nombre || '');
    // Aseguramos que el DNI se muestre (si existe en DB)
    if(document.getElementById('perfilDni')) document.getElementById('perfilDni').value = usuarioActual.dni || '-'; 
    if(document.getElementById('perfilMail')) document.getElementById('perfilMail').value = usuarioActual.mail || '';
    if(document.getElementById('perfilTelefono')) document.getElementById('perfilTelefono').value = usuarioActual.telefono || '';
}

// --- 3. LÓGICA DE INVERSIONES ---
async function cargarInversiones() {
    const solicitudesTotales = [];
    const tablaDesktop = document.querySelector('#tablaInversiones tbody');
    const listaMobile = document.getElementById('listaInversionesMobile');
    const seccionCalendario = document.getElementById('seccionCalendario');
    const mensajeVacio = document.getElementById('mensajeSinInversiones');
    
    // Limpieza
    if(tablaDesktop) tablaDesktop.innerHTML = "";
    if(listaMobile) listaMobile.innerHTML = "";

    try {
        // A. Carpetas Vinculadas
        const vinculadasRef = collection(db, `usuarios/${usuarioActual.uid}/carpetasVinculadas`);
        const vinculadasSnap = await getDocs(vinculadasRef);
        
        // B. Carpetas por DNI (Legacy)
        let dniSnap = { docs: [] };
        if (usuarioActual.dni) {
            const qDni = query(collection(db, "solicitudes"), where("dni", "==", usuarioActual.dni));
            dniSnap = await getDocs(qDni);
        }

        const idsCarpetas = new Set();
        
        // Recolectar IDs
        vinculadasSnap.forEach(docV => {
            // Guardamos el NÚMERO de carpeta para buscarlo luego, o si guardaste el ID del doc úsalo.
            // Asumo que guardaste { carpeta: "123" }
            idsCarpetas.add(docV.data().carpeta); 
        });
        
        // Las del DNI ya tienen el ID del documento, pero necesitamos buscar por campo 'carpeta' para unificar lógica
        // O mejor, procesamos los docs del DNI directamente
        const carpetasPorDni = dniSnap.docs.map(d => d.data());

        // Ahora buscamos los detalles de las carpetas vinculadas (que solo tenemos el número)
        for (const numCarpeta of idsCarpetas) {
            const q = query(collection(db, "solicitudes"), where("carpeta", "==", numCarpeta));
            const match = await getDocs(q);
            match.forEach(m => carpetasPorDni.push({ ...m.data(), id: m.id }));
        }

        // Eliminar duplicados (si vinculó una carpeta que ya era suya por DNI)
        const unicosMap = new Map();
        carpetasPorDni.forEach(item => unicosMap.set(item.carpeta, item));
        const listaUnica = Array.from(unicosMap.values());

        // C. Obtener reingresos y armar objeto final
        for (const data of listaUnica) {
            // Necesitamos el ID del documento para buscar la subcolección
            // Si vino por DNI ya lo tenemos. Si vino por vínculo, necesitamos buscar el doc ID de nuevo si no lo guardamos.
            // Para simplificar, buscamos el doc ID basado en el numero de carpeta
            const qId = query(collection(db, "solicitudes"), where("carpeta", "==", data.carpeta));
            const qIdSnap = await getDocs(qId);
            
            if (!qIdSnap.empty) {
                const docRef = qIdSnap.docs[0].ref;
                const reingresosSnap = await getDocs(collection(docRef, "reingresos"));
                const reingresos = reingresosSnap.docs.map(r => r.data());
                
                solicitudesTotales.push({ ...data, reingresos });
            }
        }

        // Ordenar
        solicitudesTotales.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (solicitudesTotales.length === 0) {
            mensajeVacio.classList.remove('hidden');
            seccionCalendario.classList.add('hidden');
            return; // Salimos si no hay datos
        } else {
            mensajeVacio.classList.add('hidden');
        }

        // Renderizar
        solicitudesTotales.forEach(s => {
            // DESKTOP ROW
            if(tablaDesktop) {
                const row = tablaDesktop.insertRow();
                row.innerHTML = `
                    <td>${formatearMoneda(s.capital)}</td>
                    <td>${s.periodos} meses</td>
                    <td>${formatearPorcentaje(s.ganancia)}</td>
                    <td>${s.unidad || '-'}</td>
                    <td>${formatearFecha(s.fecha)}</td>
                    <td><strong>${s.carpeta}</strong></td>
                `;
                // Reingresos Desktop
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
            }

            // MOBILE CARD
            if(listaMobile) {
                const cardMobile = document.createElement('div');
                cardMobile.className = 'card';
                cardMobile.style.marginBottom = '15px';
                cardMobile.style.padding = '15px';
                cardMobile.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <div>
                            <span style="background:#eee; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">#${s.carpeta}</span>
                            <div style="font-weight:bold; font-size:1.1rem; margin-top:5px;">${formatearMoneda(s.capital)}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.9rem; color:#2e7d32; font-weight:bold;">${s.ganancia}%</div>
                            <div style="font-size:0.8rem; color:#666;">${s.periodos} meses</div>
                        </div>
                    </div>
                    <div style="border-top:1px solid #eee; padding-top:10px; font-size:0.9rem; color:#666; display:flex; justify-content:space-between;">
                        <span>Fecha: ${formatearFecha(s.fecha)}</span>
                        <span>${s.unidad || ''}</span>
                    </div>
                `;
                listaMobile.appendChild(cardMobile);
            }
        });

        // Generar Calendario
        generarCalendario(solicitudesTotales);
        seccionCalendario.classList.remove('hidden');

    } catch (error) {
        console.error("Error cargando inversiones:", error);
    }
}

// --- 4. LÓGICA DE CALENDARIO ---
function generarCalendario(solicitudes) {
    const headerRow = document.getElementById("headerCalendario");
    const tbody = document.querySelector("#tablaCalendario tbody");
    
    if(!headerRow || !tbody) return;

    tbody.innerHTML = "";
    
    // 1. Recolectar todas las fechas de pago posibles
    let fechasPagosSet = new Set();
    
    const datosPorCarpeta = solicitudes.map(s => {
        const pagos = [];
        const { carpeta, capital, ganancia, periodos, fecha } = s;
        if (!carpeta || !capital || !fecha) return null;

        const capInicial = parseFloat(String(capital).replace(/[^\d,.-]/g, '').replace(',', '.'));
        const tasa = parseFloat(String(ganancia).replace(',', '.')) / 100;
        const [y, m, d] = fecha.split("-").map(Number);
        const fechaInicio = new Date(y, m - 1, d); // Mes 0-indexado

        for (let i = 0; i < parseInt(periodos); i++) {
            const fechaPago = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() + i + 1, 1);
            const key = `${fechaPago.getFullYear()}-${String(fechaPago.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
            fechasPagosSet.add(key);

            // Calculo simple de cuota (ajustar si tienes lógica compleja de días)
            const monto = capInicial * tasa; 
            pagos.push({ key, monto });
        }
        return { carpeta, pagos };
    }).filter(Boolean);

    // 2. Ordenar columnas (Meses)
    const mesesOrdenados = Array.from(fechasPagosSet).sort();

    // 3. Renderizar Header
    // Limpiamos header dejando solo la primera columna
    while (headerRow.children.length > 1) {
        headerRow.removeChild(headerRow.lastChild);
    }
    
    mesesOrdenados.forEach(k => {
        const th = document.createElement("th");
        const [anio, mes] = k.split("-");
        // Formato corto: 05/24
        th.textContent = `${mes}/${anio.slice(2)}`;
        headerRow.appendChild(th);
    });

    // 4. Renderizar Filas
    const hoyKey = new Date().toISOString().slice(0, 7); // YYYY-MM actual

    datosPorCarpeta.forEach(({ carpeta, pagos }) => {
        const row = document.createElement("tr");
        
        // Columna Carpeta (Sticky)
        const celdaCarpeta = document.createElement("td");
        celdaCarpeta.textContent = carpeta;
        celdaCarpeta.style.fontWeight = "bold";
        row.appendChild(celdaCarpeta);

        // Mapa de pagos para acceso rápido
        const pagosMap = {};
        pagos.forEach(p => pagosMap[p.key] = p.monto);

        mesesOrdenados.forEach(k => {
            const td = document.createElement("td");
            if (pagosMap[k]) {
                td.textContent = formatearMoneda(pagosMap[k]);
                
                if (k < hoyKey) td.className = "cuota-pasada";
                else if (k === hoyKey) td.className = "cuota-actual";
                else td.className = "cuota-futura";
            } else {
                td.textContent = "-";
                td.style.color = "#eee";
            }
            row.appendChild(td);
        });

        tbody.appendChild(row);
    });
}

// --- 5. EVENT LISTENERS ---
// Usamos addEventListener seguro
const btnAgregar = document.getElementById('btnAgregarCarpeta');
if(btnAgregar) {
    btnAgregar.addEventListener('click', () => {
        document.getElementById('formVincularCarpeta').classList.toggle('hidden');
    });
}

const btnBuscar = document.getElementById('btnBuscarCarpeta');
if(btnBuscar) {
    btnBuscar.addEventListener('click', async () => {
        const input = document.getElementById('inputNumeroCarpeta');
        const resultadoDiv = document.getElementById('resultadoBusqueda');
        const numero = input.value.trim();

        resultadoDiv.innerHTML = '<div class="spinner"></div>'; // Feedback de carga

        if (!numero) {
            resultadoDiv.textContent = "Ingresa un número.";
            return;
        }

        const q = query(collection(db, "solicitudes"), where("carpeta", "==", numero));
        const snap = await getDocs(q);

        if (snap.empty) {
            resultadoDiv.innerHTML = '<p style="color:#d32f2f">No encontrada.</p>';
        } else {
            const data = snap.docs[0].data();
            resultadoDiv.innerHTML = `
                <div style="padding:10px; background:#e8f5e9; border-radius:4px; border:1px solid #c8e6c9;">
                    <p><strong>Encontrada:</strong> Capital ${formatearMoneda(data.capital)}</p>
                    <button id="btnConfirmarVinculo" class="btn-primary" style="margin-top:10px; width:100%">Vincular ahora</button>
                </div>
            `;
            
            // Listener dinámico para el botón creado
            document.getElementById('btnConfirmarVinculo').addEventListener('click', async () => {
                try {
                    await setDoc(doc(collection(db, `usuarios/${usuarioActual.uid}/carpetasVinculadas`)), {
                        carpeta: numero,
                        fechaVinculacion: new Date().toISOString()
                    });
                    alert("¡Vinculada con éxito!");
                    input.value = "";
                    resultadoDiv.innerHTML = "";
                    document.getElementById('formVincularCarpeta').classList.add('hidden');
                    cargarInversiones(); // Recargar datos
                } catch (e) {
                    alert("Error: " + e.message);
                }
            });
        }
    });
}

const btnCerrar = document.getElementById('btnCerrarSesion');
if(btnCerrar) {
    btnCerrar.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = '../login.html');
    });
}

// --- EVENT LISTENERS ACTUALIZADOS ---

// 1. Botón "Mis Datos" (Abre el Modal)
const btnEditar = document.getElementById('btnEditarPerfil');
if(btnEditar) {
    btnEditar.addEventListener('click', () => {
        // Mostramos el overlay del perfil
        document.getElementById('modalPerfilOverlay').classList.remove('hidden');
    });
}

// 2. Botón "Cerrar" (Boton Gris dentro del modal)
const btnCerrarPerfil = document.getElementById('btnCerrarPerfil');
if(btnCerrarPerfil) {
    btnCerrarPerfil.addEventListener('click', () => {
        document.getElementById('modalPerfilOverlay').classList.add('hidden');
    });
}

// 3. La "X" para cerrar (Opcional pero recomendado para UX)
const btnCerrarX = document.getElementById('btnCerrarPerfilX');
if(btnCerrarX) {
    btnCerrarX.addEventListener('click', () => {
        document.getElementById('modalPerfilOverlay').classList.add('hidden');
    });
}

// 4. Cerrar al hacer clic fuera del modal (Overlay click)
const overlayPerfil = document.getElementById('modalPerfilOverlay');
if(overlayPerfil) {
    overlayPerfil.addEventListener('click', (e) => {
        if (e.target === overlayPerfil) {
            overlayPerfil.classList.add('hidden');
        }
    });
}

const btnCerrarPopup = document.getElementById('btnCerrarPopup');
if(btnCerrarPopup) {
    btnCerrarPopup.addEventListener('click', () => {
        document.getElementById('popupOverlay').classList.add('hidden');
    });
}

// --- LÓGICA DE EDICIÓN DE PERFIL (Solo Teléfono) ---

const btnHabilitar = document.getElementById('btnHabilitarEdicion');
const btnCancelar = document.getElementById('btnCancelarEdicion');
const btnGuardar = document.getElementById('btnGuardarEdicion');

// IMPORTANTE: Solo listamos los inputs que permitimos tocar
const inputsEditables = ['perfilTelefono']; 

// 1. Botón "Editar": Desbloquea solo el teléfono
if(btnHabilitar) {
    btnHabilitar.addEventListener('click', () => {
        inputsEditables.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.disabled = false;
                el.style.backgroundColor = '#fff'; 
                el.style.borderColor = '#2e7d32'; // Verde para indicar foco
                el.focus();
            }
        });
        
        btnHabilitar.classList.add('hidden');
        btnCancelar.classList.remove('hidden');
        btnGuardar.classList.remove('hidden');
    });
}

// 2. Botón "Cancelar": Revertir cambios
if(btnCancelar) {
    btnCancelar.addEventListener('click', () => {
        // Volvemos a poner el valor original que tenemos en memoria
        if(document.getElementById('perfilTelefono')) {
            document.getElementById('perfilTelefono').value = usuarioActual.telefono || '';
        }
        bloquearInputs();
    });
}

// 3. Botón "Guardar": Escribir SOLO el teléfono en Firestore
if(btnGuardar) {
    btnGuardar.addEventListener('click', async () => {
        const nuevoTel = document.getElementById('perfilTelefono').value.trim();

        if(!nuevoTel) {
            alert("El teléfono no puede estar vacío.");
            return;
        }

        try {
            btnGuardar.textContent = "Guardando...";
            btnGuardar.disabled = true;

            // Actualizamos Firestore - SOLO EL TELÉFONO
            const docRef = doc(db, "usuarios", usuarioActual.uid);
            await updateDoc(docRef, {
                telefono: nuevoTel
            });

            // Actualizamos memoria local
            usuarioActual.telefono = nuevoTel;

            alert("Teléfono actualizado correctamente.");
            bloquearInputs();

        } catch (error) {
            console.error("Error al actualizar:", error);
            alert("Error al guardar los cambios.");
        } finally {
            btnGuardar.textContent = "Guardar Cambios";
            btnGuardar.disabled = false;
        }
    });
}

function bloquearInputs() {
    inputsEditables.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.disabled = true;
            el.style.backgroundColor = ''; 
            el.style.borderColor = '';
        }
    });
    btnHabilitar.classList.remove('hidden');
    btnCancelar.classList.add('hidden');
    btnGuardar.classList.add('hidden');
}