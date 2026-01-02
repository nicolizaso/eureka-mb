/* --- BASE DE DATOS DE UNIDADES (10 MODELOS) --- */
const dataUN = {
    "oro": {
        titulo: "Oro Activo",
        subtitle: "Arbitraje Comercial + Renta Financiera.",
        stats: [
            { label: "Rentabilidad", val: "8% - 18% Anual" },
            { label: "Plazo Mínimo", val: "12 Meses" },
            { label: "Riesgo", val: "Bajo (Blindado)" }
        ],
        descripcion: "Un sistema híbrido donde tu capital compra oro físico al costo mayorista (respaldo real inmediato) y el excedente financiero se invierte en bonos. Al finalizar, te llevas la apreciación del oro más los intereses generados.",
        timeline: [
            { time: "Día 1", text: "Inversión y Compra de Oro Físico" },
            { time: "Mes 1-11", text: "El excedente genera intereses en Bonos" },
            { time: "Mes 12", text: "Venta/Retiro del Oro + Cobro Intereses" }
        ],
        tiers: [
            { name: "SILVER", min: 10000, tasa: 8.0, desc: "Excedente 30/70" },
            { name: "GOLD", min: 30000, tasa: 13.3, desc: "Excedente 50/50" },
            { name: "BLACK", min: 100000, tasa: 18.7, desc: "Excedente 70/30" }
        ],
        riesgos: ["Respaldo físico en Oro.", "Sin riesgo de mercado.", "Opción de retiro físico."],
        imagenHero: "linear-gradient(135deg, #FFD700 0%, #B8860B 100%)"
    },
    "fulfillment": {
        titulo: "Smart Fulfillment",
        subtitle: "E-Commerce Global sin barreras operativas.",
        stats: [
            { label: "Rentabilidad", val: "12% - 37% Anual" },
            { label: "Plazo", val: "6 Meses" },
            { label: "Mercado", val: "USA / LATAM" }
        ],
        descripcion: "Invertimos en stock de productos de alta rotación. La logística es 100% tercerizada en Amazon (FBA) y MercadoLibre (Full). Vos pones el capital, nosotros la gestión.",
        timeline: [
            { time: "Semana 1", text: "Análisis y Compra de Stock" },
            { time: "Semana 4", text: "Arribo a depósitos Amazon/ML" },
            { time: "Mes 2-6", text: "Venta Automática y Rotación" }
        ],
        tiers: [
            { name: "SILVER", min: 10000, tasa: 12.0, desc: "Renta Fija (6% Sem)" },
            { name: "GOLD", min: 25000, tasa: 18.0, desc: "Renta Fija (9% Sem)" },
            { name: "BLACK", min: 60000, tasa: 37.5, desc: "Profit Share (Socio)" }
        ],
        riesgos: ["Stock propio.", "Diversificación de productos.", "Ventas en dólares."],
        imagenHero: "linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)"
    },
    "realestate": {
        titulo: "Real Estate (Smart Flipping)",
        subtitle: "Remodelación y venta estratégica.",
        stats: [
            { label: "Rentabilidad", val: "20% - 30% Anual" },
            { label: "Plazo", val: "6 - 12 Meses" },
            { label: "Activo", val: "Ladrillo" }
        ],
        descripcion: "Compramos propiedades deterioradas por debajo del valor de mercado, inyectamos capital para remodelación express y vendemos rápido. Valor agregado real.",
        timeline: [
            { time: "Mes 1", text: "Adquisición de Propiedad" },
            { time: "Mes 2-4", text: "Obra y Remodelación" },
            { time: "Mes 6+", text: "Venta y Realización" }
        ],
        tiers: [
            { name: "PARTICIPANTE", min: 20000, tasa: 20.0, desc: "Pool de Remodelación" },
            { name: "SOCIO", min: 50000, tasa: 30.0, desc: "Proporcional a capital" }
        ],
        riesgos: ["Respaldo en Inmueble.", "Gestión de obra propia.", "Análisis previo de tasación."],
        imagenHero: "linear-gradient(135deg, #2C3E50 0%, #4CA1AF 100%)"
    },
    "vehiculos": {
        titulo: "Mundo Vehículos",
        subtitle: "Trade-In & Capitalización Automotriz.",
        stats: [
            { label: "Rentabilidad", val: "~18% Anual" },
            { label: "Plazo", val: "Inmediato" },
            { label: "Activo", val: "Rodado / Capital" }
        ],
        descripcion: "Tu auto parado pierde dinero. Lo tomamos, lo tasamos y transformamos ese valor en capital activo invertido en nuestras unidades de negocio más rentables.",
        timeline: [
            { time: "Día 1", text: "Tasación y Toma del Vehículo" },
            { time: "Día 7", text: "Venta y Liquidez del Activo" },
            { time: "Mes 1+", text: "Generación de Intereses (18% Anual)" }
        ],
        tiers: [
            { name: "ESTÁNDAR", min: 10000, tasa: 18.0, desc: "Valor del vehículo capitalizado" }
        ],
        riesgos: ["Evita depreciación del auto.", "Elimina gastos de patente/seguro.", "Renta inmediata."],
        imagenHero: "linear-gradient(135deg, #3E5151 0%, #DECBA4 100%)"
    },
    "financiera": {
        titulo: "Mesa Financiera",
        subtitle: "Bonos, CER y Estrategias de Cobertura.",
        stats: [
            { label: "Rentabilidad", val: "8% - 18% Anual" },
            { label: "Liquidez", val: "Alta (48hs)" },
            { label: "Moneda", val: "USD / ARS" }
        ],
        descripcion: "Gestión activa de tesorería. No dejamos el dinero quieto. Utilizamos Bonos Soberanos, Obligaciones Negociables y estrategias de Carry Trade para maximizar rendimientos.",
        timeline: [
            { time: "Día 1", text: "Suscripción de Activos" },
            { time: "Mensual", text: "Pago de Cupones / Intereses" },
            { time: "Final", text: "Rescate de Capital" }
        ],
        tiers: [
            { name: "COBERTURA", min: 5000, tasa: 8.0, desc: "Bonos CER + ONs" },
            { name: "RENTA DÓLAR", min: 15000, tasa: 12.0, desc: "Bonos Globales" },
            { name: "AGRESIVO", min: 50000, tasa: 18.0, desc: "Carry Trade Táctico" }
        ],
        riesgos: ["Diversificación de cartera.", "Activos líquidos de mercado.", "Gestión profesional."],
        imagenHero: "linear-gradient(135deg, #134E5E 0%, #71B280 100%)"
    },
    "agro": {
        titulo: "Pool de Siembra",
        subtitle: "Financiación de campaña agrícola.",
        stats: [
            { label: "Rentabilidad", val: "17.5% Estimado" },
            { label: "Plazo", val: "Campaña (6-9 Meses)" },
            { label: "Activo", val: "Commodities" }
        ],
        descripcion: "Financiación de insumos y labores para campañas de Soja/Maíz. Modelo de Devolución de Capital + Tasa Preferida del 10% + Reparto de utilidades (50/50).",
        timeline: [
            { time: "Mes 1", text: "Siembra y Compra de Insumos" },
            { time: "Mes 6", text: "Cosecha y Acopio" },
            { time: "Mes 7", text: "Venta y Liquidación" }
        ],
        tiers: [
            { name: "SOCIO AGRO", min: 15000, tasa: 17.5, desc: "Pref 10% + Split 50%" }
        ],
        riesgos: ["Contratistas de primera línea.", "Seguros climáticos.", "Commodities dolarizados."],
        imagenHero: "linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)"
    },
    "legales": {
        titulo: "Financiación de Litigios",
        subtitle: "Legal Tech: Compra de derechos litigiosos.",
        stats: [
            { label: "Rentabilidad", val: "~50% Anual" },
            { label: "Plazo", val: "24 Meses (Variable)" },
            { label: "Tipo", val: "High Yield" }
        ],
        descripcion: "Compramos derechos de juicios con sentencia firme a un fuerte descuento. Es una inversión de paciencia con retornos multiplicadores (2x o más).",
        timeline: [
            { time: "Mes 1", text: "Due Diligence y Cesión de Derechos" },
            { time: "Mes 12-24", text: "Ejecución de Sentencia" },
            { time: "Final", text: "Cobro Judicial y Ganancia" }
        ],
        tiers: [
            { name: "FONDO LEGAL", min: 20000, tasa: 50.0, desc: "Retorno 2x en 24 meses" }
        ],
        riesgos: ["Sentencias firmes revisadas.", "Diversificación de causas.", "Alta rentabilidad por iliquidez."],
        imagenHero: "linear-gradient(135deg, #3a7bd5 0%, #3a6073 100%)"
    },
    "franquicias": {
        titulo: "Pool de Franquicias",
        subtitle: "Crowdfunding de locales comerciales.",
        stats: [
            { label: "Rentabilidad", val: "~20% Anual" },
            { label: "Plazo", val: "24 - 36 Meses" },
            { label: "Flujo", val: "Mensual" }
        ],
        descripcion: "Apertura de locales de marcas reconocidas con gestión profesionalizada. Eureka se encarga de la operación, el inversor recibe dividendos de la utilidad neta.",
        timeline: [
            { time: "Mes 1-2", text: "Obra y Puesta a Punto" },
            { time: "Mes 3", text: "Apertura al Público" },
            { time: "Mensual", text: "Cobro de Dividendos" }
        ],
        tiers: [
            { name: "ACCIONISTA", min: 15000, tasa: 20.0, desc: "Dividendos sobre utilidad" }
        ],
        riesgos: ["Marcas probadas.", "Gestión profesional (no dueño directo).", "Flujo de caja constante."],
        imagenHero: "linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)"
    },
    "ganaderia": {
        titulo: "Ganadería",
        subtitle: "Capitalización de Hacienda (Engorde).",
        stats: [
            { label: "Rentabilidad", val: "Carne + Valor" },
            { label: "Plazo", val: "12 Meses" },
            { label: "Activo", val: "Ganado" }
        ],
        descripcion: "Compra de terneros (Invernada) para engorde a campo o feedlot. El animal gana kilos (carne) y valor de mercado. Resguardo de valor tangible.",
        timeline: [
            { time: "Mes 1", text: "Compra de Terneros (180kg)" },
            { time: "Mes 2-11", text: "Proceso de Engorde" },
            { time: "Mes 12", text: "Venta a Frigorífico (320kg)" }
        ],
        tiers: [
            { name: "GANADERO", min: 10000, tasa: 12.0, desc: "Kilos ganados + Valor" }
        ],
        riesgos: ["Activo biológico asegurado.", "Demanda de alimentos constante.", "Exportación."],
        imagenHero: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
    },
    "parking": {
        titulo: "Parking & Storage",
        subtitle: "Renta Inmobiliaria + Explotación Comercial.",
        stats: [
            { label: "Rentabilidad", val: "8% - 10% Anual" },
            { label: "Plazo", val: "Vitalicio" },
            { label: "Tipo", val: "Renta Pasiva" }
        ],
        descripcion: "Participación en la utilidad de Garages y Depósitos. El cliente pone el capital/terreno, Eureka pone el proyecto y la gestión. Rentabilidad estable y recurrente.",
        timeline: [
            { time: "Mes 1-6", text: "Desarrollo / Adecuación" },
            { time: "Mes 7", text: "Inicio de Operaciones" },
            { time: "Mensual", text: "Renta por Explotación" }
        ],
        tiers: [
            { name: "INVERSOR", min: 25000, tasa: 10.0, desc: "70% Utilidad Neta" }
        ],
        riesgos: ["Activo inmobiliario.", "Demanda urbana creciente.", "Gestión automatizada."],
        imagenHero: "linear-gradient(135deg, #232526 0%, #414345 100%)"
    }
};

/* --- LÓGICA DE INICIALIZACIÓN --- */
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id || !dataUN[id]) {
        // Si no existe el ID, volver al home (Fail-safe)
        alert("Unidad no encontrada. Redirigiendo...");
        window.location.href = 'index.html';
        return;
    }

    const data = dataUN[id];
    renderPage(data);
    initCalculator(data.tiers);
});

/* --- RENDERIZADO DE LA PÁGINA --- */
function renderPage(data) {
    // Hero
    document.title = `${data.titulo} | MB Eureka`;
    document.getElementById('heroTitle').textContent = data.titulo;
    document.getElementById('heroSubtitle').textContent = data.subtitle;
    
    // Gradiente de fondo dinámico
    document.getElementById('heroSection').style.background = data.imagenHero;

    // Stats Hero
    const statsContainer = document.getElementById('heroStats');
    statsContainer.innerHTML = ''; // Limpiar
    data.stats.forEach(s => {
        statsContainer.innerHTML += `
            <div class="stat-item">
                <span class="stat-val">${s.val}</span>
                <span class="stat-label">${s.label}</span>
            </div>
        `;
    });

    // Descripción
    document.getElementById('descLarga').textContent = data.descripcion;

    // Timeline
    const timelineContainer = document.getElementById('timelineContainer');
    timelineContainer.innerHTML = '';
    data.timeline.forEach(t => {
        timelineContainer.innerHTML += `
            <div class="tl-item">
                <div class="tl-time">${t.time}</div>
                <div class="tl-text">${t.text}</div>
            </div>
        `;
    });

    // Tiers (Tabla de Precios)
    const tiersContainer = document.getElementById('tiersContainer');
    tiersContainer.innerHTML = '';
    data.tiers.forEach(t => {
        tiersContainer.innerHTML += `
            <div class="tier-card">
                <h4>${t.name}</h4>
                <div class="tier-price">Desde USD ${t.min.toLocaleString('de-DE')}</div>
                <div class="tier-rate">Tasa: ~${t.tasa}%</div>
                <p class="tier-desc">${t.desc}</p>
            </div>
        `;
    });

    // Riesgos
    const riskList = document.getElementById('riskList');
    riskList.innerHTML = '';
    data.riesgos.forEach(r => {
        riskList.innerHTML += `<li>${r}</li>`;
    });
}

/* --- CALCULADORA DE ROI --- */
function initCalculator(tiers) {
    const input = document.getElementById('calcInput');
    const range = document.getElementById('calcRange');
    
    // Configurar rangos dinámicos según el producto
    // Mínimo del tier más bajo, Máximo arbitrario (ej: 100k o 200k)
    const minVal = tiers[0].min;
    const maxVal = Math.max(100000, tiers[tiers.length-1].min * 2);
    
    input.min = minVal;
    input.value = minVal;
    range.min = minVal;
    range.max = maxVal;
    range.value = minVal;

    // Eventos
    const update = (val) => {
        input.value = val;
        range.value = val;
        calcular(val, tiers);
    };

    input.addEventListener('input', () => update(input.value));
    range.addEventListener('input', () => update(range.value));

    // Cálculo inicial
    calcular(minVal, tiers);
}

function calcular(monto, tiers) {
    const inversion = parseFloat(monto);
    if (!inversion) return;

    // Buscar el tier correspondiente
    // Ordenamos de mayor a menor para encontrar el "piso" más alto que cumple
    const tierMatch = [...tiers].sort((a,b) => b.min - a.min).find(t => inversion >= t.min);

    const resNivel = document.getElementById('resNivel');
    const resTasa = document.getElementById('resTasa');
    const resGanancia = document.getElementById('resGanancia');

    if (tierMatch) {
        resNivel.textContent = tierMatch.name;
        resNivel.style.color = "var(--accent)";
        
        resTasa.textContent = `${tierMatch.tasa}% Anual`;
        
        const ganancia = inversion * (tierMatch.tasa / 100);
        resGanancia.textContent = `USD ${Math.round(ganancia).toLocaleString('de-DE')}`;
    } else {
        // Menos que el mínimo del primer tier
        const minTier = tiers.sort((a,b) => a.min - b.min)[0];
        resNivel.textContent = "Monto Insuficiente";
        resNivel.style.color = "#999";
        resTasa.textContent = "-";
        resGanancia.textContent = `Mínimo: USD ${minTier.min.toLocaleString('de-DE')}`;
    }
}