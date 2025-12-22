// Theme Toggle System
(function() {
    'use strict';

    // Initialize theme on page load (before first paint)
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('theme-dark');
    }

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        initThemeToggle();
        initMobileMenu();
    });

    function initThemeToggle() {
        const themeToggle = document.querySelector('.theme-toggle');
        if (!themeToggle) return;

        const lightBtn = themeToggle.querySelector('[data-theme="light"]');
        const darkBtn = themeToggle.querySelector('[data-theme="dark"]');

        // Set initial state
        updateThemeButtons();

        // Add click handlers
        if (lightBtn) {
            lightBtn.addEventListener('click', () => setTheme('light'));
        }
        if (darkBtn) {
            darkBtn.addEventListener('click', () => setTheme('dark'));
        }

        function setTheme(theme) {
            if (theme === 'dark') {
                document.body.classList.add('theme-dark');
            } else {
                document.body.classList.remove('theme-dark');
            }
            localStorage.setItem('theme', theme);
            updateThemeButtons();
        }

        function updateThemeButtons() {
            const isDark = document.body.classList.contains('theme-dark');
            if (lightBtn) {
                lightBtn.classList.toggle('active', !isDark);
            }
            if (darkBtn) {
                darkBtn.classList.toggle('active', isDark);
            }
        }
    }

    function initMobileMenu() {
        const hamburger = document.querySelector('.hamburger');
        const mobileNav = document.querySelector('.mobile-nav');
        const mobileOverlay = document.querySelector('.mobile-overlay');

        if (!hamburger || !mobileNav) return;

        hamburger.addEventListener('click', toggleMenu);
        
        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', closeMenu);
        }

        // Close menu when clicking a link
        const mobileLinks = mobileNav.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', closeMenu);
        });

        // Close menu on escape key
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
            document.body.style.overflow = 'hidden';
        }

        function closeMenu() {
            hamburger.classList.remove('active');
            mobileNav.classList.remove('active');
            if (mobileOverlay) {
                mobileOverlay.classList.remove('active');
            }
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
    }
})();
