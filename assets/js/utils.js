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