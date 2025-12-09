export function formatearMoneda(valor) {
    if (!valor) return '-';
    const num = parseFloat(valor.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
    return isNaN(num) ? valor : `USD ${Math.round(num).toLocaleString('de-DE')}`;
}

export function formatearFecha(fechaStr) {
    if (!fechaStr) return "-";
    const [y, m, d] = fechaStr.split("-");
    return `${d}-${m}-${y}`;
}

export function formatearPorcentaje(valor) {
    const limpio = valor?.toString().replace(",", ".");
    const numero = parseFloat(limpio);
    if (isNaN(numero)) return "-";
    const porcentaje = numero <= 1 ? numero * 100 : numero;
    return `${porcentaje.toFixed(1)}%`;
}

/* --- SISTEMA DE NOTIFICACIONES (TOASTS) --- */
export function mostrarNotificacion(mensaje, tipo = 'neutral') {
    const popup = document.getElementById('popupMensaje');
    if (!popup) {
        console.error("El contenedor #popupMensaje no existe en el HTML.");
        return;
    }

    // 1. Inyectar texto
    popup.textContent = mensaje;

    // 2. Resetear clases (borrar 'hidden', 'success', 'error' previos)
    popup.className = ''; 
    
    // 3. Agregar tipo de mensaje
    popup.classList.add(tipo); // 'success', 'error', o 'neutral'

    // 4. Temporizador para ocultar
    setTimeout(() => {
        popup.classList.add('hidden'); // Asumiendo que en tu CSS .hidden tiene opacity: 0
    }, 4000); // 4 segundos visible
}