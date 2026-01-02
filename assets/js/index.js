/* --- CONFIGURACIÓN DE UNIDADES DE NEGOCIO (HOME) --- */

const unidadesNegocio = [
    {
        id: "oro",
        titulo: "Oro Activo",
        descripcion: "Modelo de Arbitraje Comercial + Renta Financiera. Eliminamos el riesgo de mercado respaldando el capital en oro físico y generando una rentabilidad extra mediante bonos.",
        imagen: "assets/img/un-oro.jpg",
        icono: "👑"
    },
    {
        id: "fulfillment",
        titulo: "Smart Fulfillment",
        descripcion: "Participación en operaciones de e-commerce global (MercadoLibre y Amazon). Gestión de stock y logística 100% tercerizada sin costos fijos de estructura.",
        imagen: "assets/img/un-fulfillment.jpg",
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
        // Si no estamos en la home, no hacemos nada (evita errores en otras páginas)
        return;
    }

    let htmlContent = '';
    const LIMITE_VISIBLE = 3; // Cantidad de unidades a mostrar inicialmente

    unidadesNegocio.forEach((un, index) => {
        // Definimos las rutas de las 3 imágenes basadas en el ID y la carpeta nueva
        const imgSquare = `assets/img/uns/${un.id}3.png`;
        const imgHoriz1 = `assets/img/uns/${un.id}1.png`;
        const imgHoriz2 = `assets/img/uns/${un.id}2.png`;
    
        // Lógica de ocultamiento (se mantiene igual que lo que tenías)
        const estaOculto = index >= LIMITE_VISIBLE;
        const estiloDisplay = estaOculto ? 'display: none;' : '';
        const claseExtra = estaOculto ? 'unidad-oculta' : '';
    
        htmlContent += `
            <article class="card-un ${claseExtra}" style="animation-delay: ${index * 0.1}s; ${estiloDisplay}">
                
                <div class="card-img-wrapper">
                    <img src="${imgSquare}" class="img-static-square" alt="${un.titulo}" loading="lazy">
                    
                    <div class="img-rotator">
                        <img src="${imgHoriz1}" class="img-slide slide-1" alt="${un.titulo} 1">
                        <img src="${imgHoriz2}" class="img-slide slide-2" alt="${un.titulo} 2">
                    </div>
                </div>
    
                <div class="card-content">
                    <h3>${un.titulo}</h3>
                    <p>${un.descripcion}</p>
                    <a href="detalle.html?id=${un.id}" class="btn-link">Ver modelo de negocio &rarr;</a>
                </div>
            </article>
        `;
    });

    contenedor.innerHTML = htmlContent;

    // --- LÓGICA DEL BOTÓN "VER MÁS" ---
    if (unidadesNegocio.length > LIMITE_VISIBLE) {
        // Creamos el contenedor del botón para centrarlo
        const btnWrapper = document.createElement('div');
        btnWrapper.style.width = '100%';
        btnWrapper.style.textAlign = 'center';
        btnWrapper.style.marginTop = '40px';
        btnWrapper.style.gridColumn = '1 / -1'; // Para que ocupe todo el ancho si es grid

        // Creamos el botón
        const btnVerMas = document.createElement('button');
        btnVerMas.innerText = 'Ver más unidades de negocio';
        btnVerMas.className = 'btn btn-outline'; // Usamos tus clases existentes
        
        // Evento Click
        btnVerMas.addEventListener('click', () => {
            const ocultas = document.querySelectorAll('.unidad-oculta');
            ocultas.forEach(card => {
                card.style.display = ''; // Quitamos el display:none para que el CSS mande (flex/grid)
                // Pequeño truco para reiniciar la animación al aparecer
                card.style.animationName = 'none';
                void card.offsetWidth; // Trigger reflow
                card.style.animationName = ''; 
                card.classList.add('visible'); // Forzamos visibilidad del observer
            });
            // Ocultamos el botón una vez pulsado
            btnWrapper.style.display = 'none';
        });

        btnWrapper.appendChild(btnVerMas);
        
        // Insertamos el botón DESPUÉS del contenedor de las unidades
        contenedor.parentNode.insertBefore(btnWrapper, contenedor.nextSibling);
    }

    // --- INTERSECTION OBSERVER (Animaciones al scrollear) ---
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

    // --- LÓGICA DE HEADER Y SCROLL ---
    const header = document.querySelector('header');
    if (header) {
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
    }

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