/* --- CONFIGURACIÓN DE UNIDADES DE NEGOCIO (HOME) --- */

const unidadesNegocio = [
    {
        id: "oro",
        titulo: "Eternity (Oro Activo)",
        descripcion: "Modelo de Arbitraje Comercial + Renta Financiera. Eliminamos el riesgo de mercado respaldando el capital en oro físico y generando una rentabilidad extra mediante bonos.",
        imagen: "assets/img/un-oro.jpg",
        icono: "👑"
    },
    {
        id: "dropshipping",
        titulo: "Smart Fulfillment (Dropshipping)",
        descripcion: "Participación en operaciones de e-commerce global (MercadoLibre y Amazon). Gestión de stock y logística 100% tercerizada sin costos fijos de estructura.",
        imagen: "assets/img/un-dropshipping.jpg",
        icono: "📦"
    },
    {
        id: "realestate",
        titulo: "Bienes Raíces",
        descripcion: "Tres modelos de negocio: Capitalización, Smart Flipping (remodelación y venta rápida) y Pools de Renta Temporaria administrados por Eureka.",
        imagen: "assets/img/un-realestate.jpg",
        icono: "🏢"
    },
    {
        id: "vehiculos",
        titulo: "Mundo Vehículos",
        descripcion: "Trade-In & Capitalización. Transformamos vehículos en capital activo. Tomamos unidades por debajo del valor de mercado para inyectar liquidez en otras unidades.",
        imagen: "assets/img/un-autos.jpg",
        icono: "🚗"
    },
    {
        id: "financiera",
        titulo: "Mesa Financiera (Letras y Bonos)",
        descripcion: "Gestión activa de tesorería mediante Bonos CER, Obligaciones Negociables y estrategias de Carry Trade Táctico para maximizar el flujo de caja.",
        imagen: "assets/img/un-finanzas.jpg",
        icono: "📈"
    },
    {
        id: "agro",
        titulo: "Pool de Siembra (Agro-Digital)",
        descripcion: "Financiación de campaña agrícola (Soja/Maíz) tercerizada en contratistas rurales. Modelo de devolución de capital más tasa preferida y reparto de utilidades.",
        imagen: "assets/img/un-agro.jpg",
        icono: "🌱"
    },
    {
        id: "legales",
        titulo: "Financiación de Litigios",
        descripcion: "Inversión 'Legal Tech'. Compra de derechos de juicios con sentencia firme a descuento. Alta rentabilidad proyectada por paciencia en el cobro.",
        imagen: "assets/img/un-legales.jpg",
        icono: "⚖️"
    },
    {
        id: "franquicias",
        titulo: "Pool de Franquicias",
        descripcion: "Crowdfunding para la apertura de locales de marcas reconocidas con gestión profesionalizada. El inversor recibe dividendos mensuales de la utilidad.",
        imagen: "assets/img/un-franquicias.jpg",
        icono: "🏪"
    },
    {
        id: "ganaderia",
        titulo: "Ganadería (Capitalización de Hacienda)",
        descripcion: "Compra de terneros para engorde (Invernada) y posterior venta a frigorífico. Resguardo de valor en activos biológicos tangibles con ciclo de 12 meses.",
        imagen: "assets/img/un-ganaderia.jpg",
        icono: "🐄"
    },
    {
        id: "parking",
        titulo: "Parking & Storage",
        descripcion: "Renta Inmobiliaria + Explotación Comercial. Participación de por vida en la utilidad neta de Garages y Depósitos, con gestión a cargo de Eureka.",
        imagen: "assets/img/un-parking.jpg",
        icono: "🅿️"
    }
];

/* --- RENDERIZADO DE TARJETAS EN HOME --- */
document.addEventListener('DOMContentLoaded', () => {
    // Buscamos el contenedor en index.html
    const contenedor = document.getElementById('contenedorUnidades');

    if (!contenedor) {
        console.error("No se encontró el contenedor #contenedorUnidades en el HTML.");
        return;
    }

    let htmlContent = '';

    unidadesNegocio.forEach((un, index) => {
        // Fallback visual si no hay imagen (usa el icono)
        const imagenHtml = un.imagen
            ? `<div class="card-img" style="background-image: url('${un.imagen}');"></div>`
            : `<div class="card-icon-placeholder">${un.icono}</div>`;

        // Generamos la tarjeta con animación stagger
        htmlContent += `
            <article class="card-un" style="animation-delay: ${index * 0.1}s">
                ${imagenHtml}
                <div class="card-content">
                    <h3>${un.titulo}</h3>
                    <p>${un.descripcion}</p>
                    <a href="detalle.html?id=${un.id}" class="btn-link">Ver modelo de negocio &rarr;</a>
                </div>
            </article>
        `;
    });

    contenedor.innerHTML = htmlContent;

    // Intersection Observer para animaciones al entrar en viewport
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1
    });

    document.querySelectorAll('.card-un').forEach(card => {
        observer.observe(card);
    });

    // Efecto de scroll en el header
    const header = document.querySelector('header');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    });

    // Smooth scroll para enlaces internos
    const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
    smoothScrollLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href !== '#' && href.length > 1) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const offsetTop = target.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
});