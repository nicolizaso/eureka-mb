// Theme Toggle System
(function() {
    'use strict';

    // 1. Cargar tema guardado antes de pintar el DOM (evita parpadeos)
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('theme-dark');
    }

    // 2. Esperar a que el DOM esté listo
    document.addEventListener('DOMContentLoaded', function() {
        initThemeToggle();
        initMobileMenu();
        updateLogo();
    });

    function initThemeToggle() {
        // CORRECCIÓN: Usamos querySelectorAll para buscar TODOS los botones, 
        // no solo los del primer contenedor que encuentre.
        const lightBtns = document.querySelectorAll('[data-theme="light"]');
        const darkBtns = document.querySelectorAll('[data-theme="dark"]');

        // Sincronizar estado inicial
        updateThemeButtons();

        // Asignar evento click a TODOS los botones de modo claro
        lightBtns.forEach(btn => {
            btn.addEventListener('click', () => setTheme('light'));
        });

        // Asignar evento click a TODOS los botones de modo oscuro
        darkBtns.forEach(btn => {
            btn.addEventListener('click', () => setTheme('dark'));
        });

        function setTheme(theme) {
            if (theme === 'dark') {
                document.body.classList.add('theme-dark');
            } else {
                document.body.classList.remove('theme-dark');
            }
            localStorage.setItem('theme', theme);
            
            // Actualizar UI en todos lados
            updateThemeButtons();
            updateLogo();
        }

        function updateThemeButtons() {
            const isDark = document.body.classList.contains('theme-dark');
            
            // Actualizar estado activo en todos los botones claros
            lightBtns.forEach(btn => {
                btn.classList.toggle('active', !isDark);
            });
            
            // Actualizar estado activo en todos los botones oscuros
            darkBtns.forEach(btn => {
                btn.classList.toggle('active', isDark);
            });
        }
    }

    function updateLogo() {
        const isDark = document.body.classList.contains('theme-dark');
        // Busca todas las imágenes que parezcan logos
        const logoImgs = document.querySelectorAll('.logo img, .navbar-brand img, header img[alt*="Eureka"], header img[alt*="MB"], .footer-logo');

        logoImgs.forEach(logoImg => {
            if (logoImg) {
                const currentSrc = logoImg.getAttribute('src');
                if (!currentSrc) return;

                // Determinar ruta base relativa
                let basePath = 'assets/img/';
                if (currentSrc.includes('../assets')) {
                    basePath = '../assets/img/';
                } else if (currentSrc.startsWith('assets/')) {
                    basePath = 'assets/img/';
                }

                // Cambiar el archivo de imagen
                logoImg.src = isDark ? basePath + 'logo-blanco.png' : basePath + 'logo-negro.png';
            }
        });
    }

    function initMobileMenu() {
        const hamburger = document.querySelector('.hamburger');
        const mobileNav = document.querySelector('.mobile-nav');
        const mobileOverlay = document.querySelector('.mobile-overlay');

        // Si no existen en esta página, no hacer nada
        if (!hamburger || !mobileNav) return;

        hamburger.addEventListener('click', toggleMenu);
        
        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', closeMenu);
        }

        // Cerrar menú al hacer clic en un enlace interno
        const mobileLinks = mobileNav.querySelectorAll('a, button.nav-link'); // Incluimos botones también
        mobileLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Si es solo un toggle de tema, no cerramos el menú
                if(link.classList.contains('theme-toggle-btn')) return;
                closeMenu();
            });
        });

        // Cerrar con tecla ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
                closeMenu();
            }
        });

        function toggleMenu() {
            const isActive = mobileNav.classList.contains('active');
            if (isActive) {
                closeMenu();
            } else {
                openMenu();
            }
        }

        function openMenu() {
            hamburger.classList.add('active');
            mobileNav.classList.add('active');
            if (mobileOverlay) {
                mobileOverlay.classList.add('active');
            }
            hamburger.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden'; // Bloquear scroll del body
        }

        function closeMenu() {
            hamburger.classList.remove('active');
            mobileNav.classList.remove('active');
            if (mobileOverlay) {
                mobileOverlay.classList.remove('active');
            }
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = ''; // Restaurar scroll
        }
    }
})();